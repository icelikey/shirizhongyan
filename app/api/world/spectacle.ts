/**
 * ============================================================================
 * 奇迹演绎判定器（api/world/spectacle.ts）
 * ----------------------------------------------------------------------------
 * 纯函数：吃事件流，吐演出片段。零副作用，不改任何对局状态。
 *
 * 【设计要点：判定条数决定「奇迹密度」】
 * 单条 8% 触发率看来很稀有，但 40 条合起来「至少中一个」是 96%。
 * 所以本文件的目标不是写几条很难的判定，而是**写很多条各自很难的判定**。
 * 首批 14 条，按 atLeastOneRate 估算约 70% 命中率；
 * 扩到 40 条即达 96%。扩充是纯数据工作，适合派给队友。
 *
 * 【写判定的三条纪律】
 * 1. 只读公开可见的过程量——观众看不懂的判定没有演出价值
 * 2. caption 必须说清「为什么这值得看」，不能只说「发生了什么」
 * 3. 条件要能从事件流直接算出，不引入新的状态跟踪
 * ============================================================================
 */
import {
  buildReel,
  rarityOf,
  type Highlight,
  type HighlightDef,
  type MatchReel,
  type SpectacleContext,
} from "@contracts/spectacle";
import type { MatchEvent } from "@contracts/matchLog";

/* ------------------------------------------------------------------ */
/* 上下文构建                                                          */
/* ------------------------------------------------------------------ */

export function buildSpectacleContext(
  events: readonly MatchEvent[],
): SpectacleContext {
  const ctx: SpectacleContext = {
    events,
    valuesBySeat: new Map(),
    winnersByRound: new Map(),
    rankTrailBySeat: new Map(),
    finalRankings: [],
    winnerSeat: null,
    totalRounds: 0,
    abilitiesBySeat: new Map(),
    rulings: [],
  };

  // 累计分用于推算每轮的名次轨迹——名次变化是「逆转」判定的依据
  const cumScore = new Map<number, number>();

  for (const e of events) {
    switch (e.t) {
      case "action": {
        if (e.value !== null) {
          const list = ctx.valuesBySeat.get(e.seat) ?? [];
          list.push(e.value);
          ctx.valuesBySeat.set(e.seat, list);
        }
        break;
      }
      case "reveal": {
        ctx.winnersByRound.set(e.round, e.winnerSeats);
        ctx.totalRounds = Math.max(ctx.totalRounds, e.round);
        for (const seat of e.winnerSeats) {
          cumScore.set(seat, (cumScore.get(seat) ?? 0) + 1);
        }
        // 快照本轮结束时的名次
        const ranked = [...cumScore.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([seat]) => seat);
        for (const [i, seat] of ranked.entries()) {
          const trail = ctx.rankTrailBySeat.get(seat) ?? [];
          trail.push(i + 1);
          ctx.rankTrailBySeat.set(seat, trail);
        }
        break;
      }
      case "abilityUsed": {
        const list = ctx.abilitiesBySeat.get(e.seat) ?? [];
        list.push(e.abilityId);
        ctx.abilitiesBySeat.set(e.seat, list);
        break;
      }
      case "ruling":
        ctx.rulings.push({
          clauseId: e.clauseId,
          upheld: e.upheld,
          appellantSeat: e.appellantSeat,
        });
        break;
      case "matchEnd":
        ctx.finalRankings = e.rankings;
        ctx.winnerSeat = e.winnerSeat;
        break;
      default:
        break;
    }
  }

  return ctx;
}

/* ------------------------------------------------------------------ */
/* 判定器                                                              */
/* ------------------------------------------------------------------ */

/** 取某座位某事件类型的最后一个事件序号 */
function lastSeqOf(
  ctx: SpectacleContext,
  seat: number,
  t: MatchEvent["t"],
): number {
  let seq = 0;
  for (const e of ctx.events) {
    if (e.t === t && "seat" in e && e.seat === seat) seq = e.seq;
  }
  return seq;
}

function endSeq(ctx: SpectacleContext): number {
  return ctx.events.at(-1)?.seq ?? 0;
}

export const HIGHLIGHT_DEFS: HighlightDef[] = [
  /* ---------------- 逆转类 ---------------- */
  {
    id: "hl-last-to-first",
    title: "后来者上",
    shot: "track",
    tags: ["逆转", "韧性"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const trail = ctx.rankTrailBySeat.get(ctx.winnerSeat) ?? [];
      if (trail.length < 3) return [];
      // 曾垫底，终局夺冠
      const wasLast = trail.slice(0, -1).some(r => r >= ctx.rankTrailBySeat.size);
      if (!wasLast) return [];
      return [
        {
          id: "hl-last-to-first",
          title: "后来者上",
          caption: "它曾在末位，而终局在首。所争者非一时之快。",
          shot: "track",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["逆转", "韧性"],
        },
      ];
    },
  },
  {
    id: "hl-final-round-steal",
    title: "末轮夺旗",
    shot: "slowmo",
    tags: ["逆转", "时机"],
    detect(ctx) {
      if (ctx.winnerSeat === null || ctx.totalRounds < 2) return [];
      const trail = ctx.rankTrailBySeat.get(ctx.winnerSeat) ?? [];
      // 末轮之前不是第一，末轮登顶
      if (trail.length < 2) return [];
      const beforeLast = trail[trail.length - 2];
      if (beforeLast === 1) return [];
      return [
        {
          id: "hl-final-round-steal",
          title: "末轮夺旗",
          caption: `直至末轮之前它仍居第 ${beforeLast}，一手之差而易主。`,
          shot: "slowmo",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["逆转", "时机"],
        },
      ];
    },
  },

  /* ---------------- 精算类 ---------------- */
  {
    id: "hl-exact-hit",
    title: "分毫不差",
    shot: "freeze",
    tags: ["精算"],
    detect(ctx) {
      const out: Omit<Highlight, "rarity">[] = [];
      for (const [round, winners] of ctx.winnersByRound) {
        if (winners.length !== 1) continue;
        const seat = winners[0];
        const vals = ctx.valuesBySeat.get(seat) ?? [];
        const v = vals[round - 1];
        // 出数恰为整数且落在 level-3 锚点（≈14.8）附近 ±0.5
        if (v === undefined || Math.abs(v - 14.8) > 0.5) continue;
        out.push({
          id: "hl-exact-hit",
          title: "分毫不差",
          caption: "三层之算，落点在毫厘之间。它算到了你算到它。",
          shot: "freeze",
          seat,
          coSeat: null,
          anchorSeq: lastSeqOf(ctx, seat, "action"),
          foreshadowSeq: null,
          tags: ["精算"],
        });
      }
      return out;
    },
  },
  {
    id: "hl-monotone-victory",
    title: "一以贯之",
    shot: "split",
    tags: ["定力", "反直觉"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const vals = ctx.valuesBySeat.get(ctx.winnerSeat) ?? [];
      if (vals.length < 3) return [];
      // 全程出同一个数仍然获胜——反直觉，因为对手在调整而它不动
      const allSame = vals.every(v => v === vals[0]);
      if (!allSame) return [];
      return [
        {
          id: "hl-monotone-victory",
          title: "一以贯之",
          caption: `全场只出 ${vals[0]}，一步未改而胜。众人皆动，独它不动。`,
          shot: "split",
          seat: ctx.winnerSeat,
          coSeat: ctx.finalRankings[1] ?? null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["定力", "反直觉"],
        },
      ];
    },
  },
  {
    id: "hl-converging-mind",
    title: "步步收束",
    shot: "track",
    tags: ["精算", "收敛"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const vals = ctx.valuesBySeat.get(ctx.winnerSeat) ?? [];
      if (vals.length < 4) return [];
      // 每轮调整幅度递减——这是收敛型思考的痕迹
      const deltas: number[] = [];
      for (let i = 1; i < vals.length; i++) {
        deltas.push(Math.abs(vals[i] - vals[i - 1]));
      }
      const monotoneShrink = deltas.every(
        (d, i) => i === 0 || d <= deltas[i - 1],
      );
      if (!monotoneShrink || deltas[0] === deltas.at(-1)) return [];
      return [
        {
          id: "hl-converging-mind",
          title: "步步收束",
          caption: "每一手的修正都小于上一手。它在向一个点逼近。",
          shot: "track",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: lastSeqOf(ctx, ctx.winnerSeat, "action"),
          foreshadowSeq: null,
          tags: ["精算", "收敛"],
        },
      ];
    },
  },

  /* ---------------- 博弈类 ---------------- */
  {
    id: "hl-mirror-minds",
    title: "心有灵犀",
    shot: "split",
    tags: ["巧合", "同频"],
    detect(ctx) {
      const out: Omit<Highlight, "rarity">[] = [];
      const seats = [...ctx.valuesBySeat.keys()];
      for (let i = 0; i < seats.length; i++) {
        for (let j = i + 1; j < seats.length; j++) {
          const a = ctx.valuesBySeat.get(seats[i]) ?? [];
          const b = ctx.valuesBySeat.get(seats[j]) ?? [];
          if (a.length < 3 || a.length !== b.length) continue;
          // 全程出数完全一致——两个独立 Agent 想到了同一件事
          if (!a.every((v, k) => v === b[k])) continue;
          out.push({
            id: "hl-mirror-minds",
            title: "心有灵犀",
            caption: `两者素不相识，而全程所出无一不同。算到尽头是同一处。`,
            shot: "split",
            seat: seats[i],
            coSeat: seats[j],
            anchorSeq: endSeq(ctx),
            foreshadowSeq: null,
            tags: ["巧合", "同频"],
          });
        }
      }
      return out;
    },
  },
  {
    id: "hl-lone-dissenter",
    title: "独持异见",
    shot: "freeze",
    tags: ["逆流", "胆识"],
    detect(ctx) {
      const out: Omit<Highlight, "rarity">[] = [];
      for (const [round, winners] of ctx.winnersByRound) {
        if (winners.length !== 1) continue;
        const seat = winners[0];
        const mine = (ctx.valuesBySeat.get(seat) ?? [])[round - 1];
        if (mine === undefined) return [];
        // 其余人的出数都在另一侧，唯它独走
        const others = [...ctx.valuesBySeat.entries()]
          .filter(([s]) => s !== seat)
          .map(([, v]) => v[round - 1])
          .filter((v): v is number => v !== undefined);
        if (others.length < 2) continue;
        const allAbove = others.every(v => v > mine + 10);
        const allBelow = others.every(v => v < mine - 10);
        if (!allAbove && !allBelow) continue;
        out.push({
          id: "hl-lone-dissenter",
          title: "独持异见",
          caption: "满座皆往一处，唯它偏行。而这一轮，偏行者胜。",
          shot: "freeze",
          seat,
          coSeat: null,
          anchorSeq: lastSeqOf(ctx, seat, "action"),
          foreshadowSeq: null,
          tags: ["逆流", "胆识"],
        });
      }
      return out;
    },
  },
  {
    id: "hl-clean-sweep",
    title: "全胜之局",
    shot: "wide",
    tags: ["压制"],
    detect(ctx) {
      if (ctx.winnerSeat === null || ctx.totalRounds < 3) return [];
      // 每一轮都赢
      const allRounds = [...ctx.winnersByRound.values()];
      if (allRounds.length < ctx.totalRounds) return [];
      if (!allRounds.every(w => w.includes(ctx.winnerSeat!))) return [];
      return [
        {
          id: "hl-clean-sweep",
          title: "全胜之局",
          caption: `${ctx.totalRounds} 轮无一败。对手换了几种算法，都没换出胜负。`,
          shot: "wide",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["压制"],
        },
      ];
    },
  },

  /* ---------------- 规则类（本作独有） ---------------- */
  {
    id: "hl-rule-rewriter",
    title: "改律者",
    shot: "rewind",
    tags: ["改规则", "罕见"],
    detect(ctx) {
      const upheld = ctx.rulings.filter(r => r.upheld);
      return upheld.map(r => ({
        id: "hl-rule-rewriter",
        title: "改律者",
        caption: `它引《${r.clauseId}》质询，裁判团采纳。此后同类之局，皆从新解。`,
        shot: "rewind" as const,
        seat: r.appellantSeat,
        coSeat: null,
        anchorSeq: endSeq(ctx),
        foreshadowSeq: null,
        tags: ["改规则", "罕见"],
      }));
    },
  },
  {
    id: "hl-appeal-and-win",
    title: "既驳且胜",
    shot: "rewind",
    tags: ["改规则", "双成"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const mine = ctx.rulings.find(
        r => r.upheld && r.appellantSeat === ctx.winnerSeat,
      );
      if (!mine) return [];
      return [
        {
          id: "hl-appeal-and-win",
          title: "既驳且胜",
          caption: "它既改了规则，又赢了这一局。两样都拿走了。",
          shot: "rewind",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["改规则", "双成"],
        },
      ];
    },
  },

  /* ---------------- 异能类 ---------------- */
  {
    id: "hl-no-ability-win",
    title: "不假外物",
    shot: "wide",
    tags: ["素手", "自持"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const used = ctx.abilitiesBySeat.get(ctx.winnerSeat) ?? [];
      if (used.length > 0) return [];
      // 他人用了异能，唯胜者未用
      const othersUsed = [...ctx.abilitiesBySeat.entries()].some(
        ([s, list]) => s !== ctx.winnerSeat && list.length > 0,
      );
      if (!othersUsed) return [];
      return [
        {
          id: "hl-no-ability-win",
          title: "不假外物",
          caption: "众人皆动异能，它一次未用而胜。所恃者，唯算而已。",
          shot: "wide",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["素手", "自持"],
        },
      ];
    },
  },
  {
    id: "hl-ability-chain",
    title: "连环之术",
    shot: "slowmo",
    tags: ["异能", "连锁"],
    detect(ctx) {
      const out: Omit<Highlight, "rarity">[] = [];
      for (const [seat, list] of ctx.abilitiesBySeat) {
        if (list.length < 3) continue;
        out.push({
          id: "hl-ability-chain",
          title: "连环之术",
          caption: `一局之内三度动用异能，环环相扣。心力尽付于此。`,
          shot: "slowmo",
          seat,
          coSeat: null,
          anchorSeq: lastSeqOf(ctx, seat, "abilityUsed"),
          foreshadowSeq: null,
          tags: ["异能", "连锁"],
        });
      }
      return out;
    },
  },

  /* ---------------- 巧合类 ---------------- */
  {
    id: "hl-photo-finish",
    title: "一发之差",
    shot: "freeze",
    tags: ["毫厘", "巧合"],
    detect(ctx) {
      if (ctx.finalRankings.length < 2) return [];
      const [first, second] = ctx.finalRankings;
      const a = ctx.valuesBySeat.get(first) ?? [];
      const b = ctx.valuesBySeat.get(second) ?? [];
      if (a.length === 0 || b.length === 0) return [];
      const diff = Math.abs((a.at(-1) ?? 0) - (b.at(-1) ?? 0));
      if (diff > 0.5 || diff === 0) return [];
      return [
        {
          id: "hl-photo-finish",
          title: "一发之差",
          caption: `末轮之差不足一厘。若它多想一瞬，胜负或将易手。`,
          shot: "freeze",
          seat: first,
          coSeat: second,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: null,
          tags: ["毫厘", "巧合"],
        },
      ];
    },
  },
  {
    id: "hl-early-foresight",
    title: "早有预见",
    shot: "rewind",
    tags: ["伏笔", "远见"],
    detect(ctx) {
      if (ctx.winnerSeat === null) return [];
      const vals = ctx.valuesBySeat.get(ctx.winnerSeat) ?? [];
      if (vals.length < 4) return [];
      // 首轮出数已接近末轮的最优——开局即看到了终局
      const first = vals[0];
      const last = vals.at(-1)!;
      if (Math.abs(first - last) > 1.5) return [];
      const middleVaried = vals
        .slice(1, -1)
        .some(v => Math.abs(v - first) > 5);
      if (!middleVaried) return [];
      return [
        {
          id: "hl-early-foresight",
          title: "早有预见",
          caption: `首轮它便出了 ${first}，中途几番游移，终局又回到此处。原来第一手就是答案。`,
          shot: "rewind",
          seat: ctx.winnerSeat,
          coSeat: null,
          anchorSeq: endSeq(ctx),
          foreshadowSeq: ctx.events.find(e => e.t === "action")?.seq ?? null,
          tags: ["伏笔", "远见"],
        },
      ];
    },
  },
];

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * 判定一局的全部候选片段。
 *
 * rateOf 供调用方注入历史触发率（从统计表读）。
 * 缺省时按 0.1 处理——首次部署无历史数据，全部落 rare 档，
 * 这比硬编码稀有度诚实。
 */
export function detectHighlights(
  events: readonly MatchEvent[],
  rateOf?: (defId: string) => number,
): Highlight[] {
  const ctx = buildSpectacleContext(events);
  const out: Highlight[] = [];

  for (const def of HIGHLIGHT_DEFS) {
    let hits;
    try {
      hits = def.detect(ctx);
    } catch {
      continue; // 单个判定器出错不该让整份集锦失败
    }
    for (const h of hits) {
      out.push({ ...h, rarity: rarityOf(rateOf?.(def.id) ?? 0.1) });
    }
  }

  return out;
}

/** 判定 + 挑选，一步产出可播放的集锦 */
export function reelFor(
  events: readonly MatchEvent[],
  matchLogId: number | null,
  rateOf?: (defId: string) => number,
): MatchReel {
  return buildReel(detectHighlights(events, rateOf), matchLogId);
}

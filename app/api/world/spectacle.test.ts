/**
 * 奇迹演绎判定单测（api/world/spectacle.test.ts）
 *
 * 纯逻辑，不碰数据库。断言四件事：
 *   1. 「大概率出现小概率事件」的数学成立且可验算
 *   2. 集锦按稀有度挑选、按时序播放（挑选与播放是两个顺序）
 *   3. 判定器只读事件流，单个出错不影响整份集锦
 *   4. 稀有度由触发率决定，而非设计者硬编码
 */
import { describe, it, expect } from "vitest";
import {
  atLeastOneRate,
  buildReel,
  rarityMeta,
  rarityOf,
  signatureFrom,
  MAX_HIGHLIGHTS_PER_MATCH,
  RARITY_THRESHOLDS,
  SHOT_META,
  type Highlight,
  type Rarity,
} from "@contracts/spectacle";
import type { MatchEvent } from "@contracts/matchLog";
import {
  HIGHLIGHT_DEFS,
  buildSpectacleContext,
  detectHighlights,
  reelFor,
} from "./spectacle";

/** 造一局猜数对局的事件流 */
function match(opts: {
  seats: number[];
  /** 座位 → 各轮出数 */
  values: Record<number, number[]>;
  /** 每轮胜者 */
  winnersByRound: number[][];
  winnerSeat: number;
  rankings: number[];
  abilities?: Record<number, string[]>;
  rulings?: { clauseId: string; upheld: boolean; seat: number }[];
}): MatchEvent[] {
  const ev: MatchEvent[] = [];
  let seq = 0;
  const push = (e: Omit<MatchEvent, "seq">) =>
    ev.push({ ...e, seq: seq++ } as MatchEvent);

  push({
    t: "matchStart",
    round: 0,
    rulebookId: "rb-guess",
    seed: "s",
    seats: opts.seats.map(i => ({
      index: i,
      name: `座${i}`,
      kind: "external-agent" as const,
    })),
  } as never);

  const rounds = opts.winnersByRound.length;
  for (let r = 1; r <= rounds; r++) {
    push({ t: "roundBegin", round: r } as never);
    for (const seat of opts.seats) {
      const v = opts.values[seat]?.[r - 1];
      if (v !== undefined) {
        push({ t: "action", round: r, seat, kind: "guess", value: v } as never);
      }
    }
    for (const [seat, ids] of Object.entries(opts.abilities ?? {})) {
      const id = ids[r - 1];
      if (id) {
        push({
          t: "abilityUsed",
          round: r,
          seat: Number(seat),
          abilityId: id,
          hook: "onSubmit",
        } as never);
      }
    }
    push({
      t: "reveal",
      round: r,
      payload: { round: r },
      winnerSeats: opts.winnersByRound[r - 1],
    } as never);
  }

  for (const ru of opts.rulings ?? []) {
    push({
      t: "ruling",
      round: rounds,
      clauseId: ru.clauseId,
      upheld: ru.upheld,
      appellantSeat: ru.seat,
      judgeVotes: [true, true, false],
    } as never);
  }

  push({
    t: "matchEnd",
    round: rounds,
    rankings: opts.rankings,
    winnerSeat: opts.winnerSeat,
    fragmentsDelta: {},
  } as never);

  return ev;
}

/* ------------------------------------------------------------------ */
describe("核心数学：大概率出现小概率事件", () => {
  it("单条 8% × 40 条 → 至少中一个约 96%", () => {
    const p = atLeastOneRate(0.08, 40);
    expect(p).toBeGreaterThan(0.95);
    expect(p).toBeLessThan(0.97);
  });

  it("条数太少则命中率不足（这是现有 6 条彩蛋的问题）", () => {
    expect(atLeastOneRate(0.08, 6)).toBeLessThan(0.4);
  });

  it("单条概率不变，加条数即可提升总命中率", () => {
    const rates = [10, 20, 40, 60].map(n => atLeastOneRate(0.08, n));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    }
  });

  it("首批判定器数量下的估算命中率（据此决定要不要扩充）", () => {
    const n = HIGHLIGHT_DEFS.length;
    const est = atLeastOneRate(0.08, n);
    // 记录当前值，便于扩充后对比。首批 14 条约 69%
    expect(n).toBeGreaterThanOrEqual(14);
    expect(est).toBeGreaterThan(0.6);
  });
});

/* ------------------------------------------------------------------ */
describe("稀有度由触发率决定，不由设计者硬编码", () => {
  it("越罕见的触发率落越高的档", () => {
    expect(rarityOf(0.001)).toBe("mythic");
    expect(rarityOf(0.008)).toBe("legendary");
    expect(rarityOf(0.03)).toBe("epic");
    expect(rarityOf(0.1)).toBe("rare");
    expect(rarityOf(0.5)).toBe("common");
  });

  it("边界值归入更稀有的档", () => {
    expect(rarityOf(0.002)).toBe("mythic");
    expect(rarityOf(0.01)).toBe("legendary");
  });

  it("越稀有演得越久，但上限 4 秒（不拖慢节奏）", () => {
    const durations = RARITY_THRESHOLDS.map(t => t.durationMs);
    expect(Math.max(...durations)).toBeLessThanOrEqual(4000);
    // 档位顺序即时长降序
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeLessThan(durations[i - 1]);
    }
  });

  it("每档都有中文标签", () => {
    for (const t of RARITY_THRESHOLDS) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it("无历史数据时落 rare 档（比硬编码稀有度诚实）", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [33, 22], 1: [50, 40] },
      winnersByRound: [[0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    const hits = detectHighlights(events); // 不传 rateOf
    for (const h of hits) expect(h.rarity).toBe("rare");
  });
});

/* ------------------------------------------------------------------ */
describe("判定器", () => {
  it("六种镜头语言都有中文说明", () => {
    for (const k of Object.keys(SHOT_META) as (keyof typeof SHOT_META)[]) {
      expect(SHOT_META[k].name.length).toBeGreaterThan(0);
      expect(SHOT_META[k].desc.length).toBeGreaterThan(4);
    }
  });

  it("判定器 id 唯一", () => {
    const ids = HIGHLIGHT_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每条都有 caption 说清为什么值得看", () => {
    const events = match({
      seats: [0, 1, 2],
      values: { 0: [14.8, 14.8, 14.8], 1: [50, 40, 30], 2: [60, 55, 50] },
      winnersByRound: [[0], [0], [0]],
      winnerSeat: 0,
      rankings: [0, 1, 2],
    });
    const hits = detectHighlights(events);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.caption.length, `${h.id} 缺解说`).toBeGreaterThan(8);
      expect(h.title.length).toBeGreaterThan(1);
    }
  });

  it("全胜之局：每轮都赢时触发", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25, 20], 1: [50, 45, 40] },
      winnersByRound: [[0], [0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    const hits = detectHighlights(events);
    expect(hits.find(h => h.id === "hl-clean-sweep")?.seat).toBe(0);
  });

  it("一以贯之：全程同一个数仍胜", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [22, 22, 22], 1: [50, 40, 30] },
      winnersByRound: [[0], [1], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    const hits = detectHighlights(events);
    const h = hits.find(x => x.id === "hl-monotone-victory");
    expect(h).toBeDefined();
    expect(h!.caption).toContain("22");
  });

  it("心有灵犀：两个 Agent 全程出数一致", () => {
    const events = match({
      seats: [0, 1, 2],
      values: { 0: [33, 22, 15], 1: [33, 22, 15], 2: [50, 50, 50] },
      winnersByRound: [[0], [1], [0]],
      winnerSeat: 0,
      rankings: [0, 1, 2],
    });
    const hits = detectHighlights(events);
    const h = hits.find(x => x.id === "hl-mirror-minds");
    expect(h).toBeDefined();
    expect(h!.coSeat).toBe(1);
  });

  it("改律者：质询被采纳时触发（本作独有）", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25], 1: [50, 45] },
      winnersByRound: [[0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
      rulings: [{ clauseId: "c-guess-tie", upheld: true, seat: 1 }],
    });
    const hits = detectHighlights(events);
    expect(hits.find(h => h.id === "hl-rule-rewriter")?.seat).toBe(1);
  });

  it("质询被驳回则不触发改律者", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25], 1: [50, 45] },
      winnersByRound: [[0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
      rulings: [{ clauseId: "c-guess-tie", upheld: false, seat: 1 }],
    });
    expect(
      detectHighlights(events).find(h => h.id === "hl-rule-rewriter"),
    ).toBeUndefined();
  });

  it("不假外物：他人用异能而胜者未用", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25], 1: [50, 45] },
      winnersByRound: [[0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
      abilities: { 1: ["ab-eshou-fuyan", "ab-eshou-fuyan"] },
    });
    const hits = detectHighlights(events);
    expect(hits.find(h => h.id === "hl-no-ability-win")?.seat).toBe(0);
  });

  it("无人用异能时不触发不假外物（否则纯数字局人人都中）", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25], 1: [50, 45] },
      winnersByRound: [[0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    expect(
      detectHighlights(events).find(h => h.id === "hl-no-ability-win"),
    ).toBeUndefined();
  });

  it("空事件流不抛错", () => {
    expect(() => detectHighlights([])).not.toThrow();
    expect(detectHighlights([])).toEqual([]);
  });

  it("上下文能索引出名次轨迹（逆转判定的依据）", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [30, 25, 20], 1: [50, 45, 40] },
      winnersByRound: [[1], [1], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    const ctx = buildSpectacleContext(events);
    expect(ctx.rankTrailBySeat.size).toBeGreaterThan(0);
    expect(ctx.totalRounds).toBe(3);
    expect(ctx.winnerSeat).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("集锦编排：挑选看价值，播放看时序", () => {
  function hl(id: string, rarity: Rarity, seq: number): Highlight {
    return {
      id,
      title: id,
      caption: "解说",
      rarity,
      shot: "freeze",
      seat: 0,
      coSeat: null,
      anchorSeq: seq,
      foreshadowSeq: null,
      tags: ["x"],
    };
  }

  it("超出上限时保留最稀有的", () => {
    const cands = [
      hl("a", "common", 1),
      hl("b", "mythic", 2),
      hl("c", "common", 3),
      hl("d", "legendary", 4),
      hl("e", "common", 5),
      hl("f", "epic", 6),
      hl("g", "common", 7),
    ];
    const reel = buildReel(cands, 1, 3);
    const ids = reel.highlights.map(h => h.id);
    expect(ids).toContain("b"); // mythic
    expect(ids).toContain("d"); // legendary
    expect(ids).toContain("f"); // epic
    expect(ids).not.toContain("a");
  });

  it("挑完按事件序号重排（否则观众看到倒叙）", () => {
    const cands = [
      hl("late", "mythic", 90),
      hl("early", "epic", 10),
      hl("mid", "legendary", 50),
    ];
    const reel = buildReel(cands, 1);
    expect(reel.highlights.map(h => h.id)).toEqual(["early", "mid", "late"]);
  });

  it("总时长按各片段稀有度累加", () => {
    const reel = buildReel([hl("a", "mythic", 1), hl("b", "common", 2)], 1);
    expect(reel.totalMs).toBe(
      rarityMeta("mythic").durationMs + rarityMeta("common").durationMs,
    );
  });

  it("默认上限为 MAX_HIGHLIGHTS_PER_MATCH", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      hl(`h${i}`, "rare", i),
    );
    expect(buildReel(many, 1).highlights).toHaveLength(
      MAX_HIGHLIGHTS_PER_MATCH,
    );
  });

  it("空候选产出空集锦而非抛错", () => {
    const reel = buildReel([], null);
    expect(reel.highlights).toEqual([]);
    expect(reel.totalMs).toBe(0);
  });

  it("reelFor 一步产出可播放集锦", () => {
    const events = match({
      seats: [0, 1],
      values: { 0: [22, 22, 22], 1: [50, 40, 30] },
      winnersByRound: [[0], [0], [0]],
      winnerSeat: 0,
      rankings: [0, 1],
    });
    const reel = reelFor(events, 42);
    expect(reel.matchLogId).toBe(42);
    expect(reel.highlights.length).toBeGreaterThan(0);
    expect(reel.totalMs).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
describe("Agent 策略画像", () => {
  it("按 tag 频次取前三，作为该 Agent 的签名", () => {
    const hs: Highlight[] = [
      { tags: ["精算", "逆转"] },
      { tags: ["精算", "定力"] },
      { tags: ["精算", "逆转"] },
      { tags: ["巧合"] },
    ].map((x, i) => ({
      id: `h${i}`,
      title: "t",
      caption: "c",
      rarity: "rare" as const,
      shot: "freeze" as const,
      seat: 0,
      coSeat: null,
      anchorSeq: i,
      foreshadowSeq: null,
      tags: x.tags,
    }));

    const sig = signatureFrom(hs);
    expect(sig[0]).toBe("精算"); // 出现 3 次
    expect(sig).toHaveLength(3);
    expect(sig).not.toContain("巧合"); // 仅 1 次，落在前三之外
  });

  it("空输入返回空画像", () => {
    expect(signatureFrom([])).toEqual([]);
  });
});

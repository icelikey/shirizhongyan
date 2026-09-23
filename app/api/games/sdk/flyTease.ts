/**
 * ============================================================================
 * flyTease 模板执行器（api/games/sdk/flyTease.ts）——「果蝇大脑逗蛐蛐」
 * ----------------------------------------------------------------------------
 * 玩法一句话：桌上一只蛐蛐，每人指挥一只果蝇去逗它。果蝇不是脚本，
 * 是一颗**真实的果蝇全脑 LIF 模型**——你给它什么刺激，它自己决定做什么。
 *
 * 你选一张「刺激牌」= (刺激哪个通道, 多少 Hz, 静默哪个通道)，
 * 这张牌在离线响应表里有确定的行为分布（`atlas.generated.ts`）。
 * 蛐蛐本轮偏好某一种行为（公开可知）；你的果蝇做出该行为的概率越高，
 * 越可能得分——但**别人也在读同一张表**，撞车就摊薄；而「扑击」这类
 * 行为会把蛐蛐惹毛，全场怒气加起来越过阈值，本轮谁也别想得分。
 *
 * ── 三条设计约束（都不是妥协，是刻意的）──────────────────────────────
 *
 * 1. **同步、无状态**。运行时的 `resolveRound` 是同步函数、拿不到 matchState
 *    （见 runtime.ts）。所以本模板每轮独立结算、总分逐轮累加，与
 *    numberGuess / pollDuel 同构：零侵入、可回放、易测试。
 *
 * 2. **零运行期依赖**。大脑在离线期就跑完了，运行期只查一张静态表。
 *    Python 不启动、不联网、不占内存，断网现场也能演。
 *
 * 3. **铁律不破**。大脑只决定「这只果蝇倾向做什么」；胜负担在
 *    分值、拥挤与怒气上，都是公开规则。大脑不参与胜负计算——
 *    与 cards.ts / ability.ts 的两条铁律一致。
 * ============================================================================
 */
import { TRPCError } from "@trpc/server";
import type { GameAction } from "@contracts/room";
import type { GameDefinition } from "@contracts/gameSdk";
import {
  FLYTEASE_TEMPLATE,
  FLY_HIT_FLOOR,
  atlasCardOf,
  cricketMoodFor,
  crowdFactor,
  gainFor,
  rageContribution,
  rageOf,
  type FlyAtlasCard,
  type FlyBehavior,
  type FlyTeaseReveal,
  type FlyTeaseParams,
} from "@contracts/flyTease";
import type { TemplateModule } from "./templates";
import { FLY_ATLAS } from "./flybrain/atlas.generated";

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function paramsOf(def: GameDefinition): FlyTeaseParams {
  return def.params as FlyTeaseParams;
}

function cardCount(): number {
  return FLY_ATLAS.cards.length;
}

/**
 * 取牌。响应表是按原始下标生成的，理论上下标永远合法；
 * 但历史房间的 stateJson 可能来自旧版表（牌堆重排过），
 * 所以这里宁可兜底到 0 号牌，也不让一局旧对局在回放时崩掉。
 */
function cardAt(index: number): FlyAtlasCard {
  return atlasCardOf(FLY_ATLAS, index) ?? FLY_ATLAS.cards[0];
}

function indexOfCardId(cardId: string): number {
  return FLY_ATLAS.cards.findIndex((c) => c.id === cardId);
}

/* ------------------------------------------------------------------ */
/* bot：level-k 阶梯                                                    */
/* ------------------------------------------------------------------ */

/**
 * bot 决策。它不是随便选——它**读表**，这也是本作想展示的事：
 * 一个 Agent 只要拿到公开的响应表与历史，就能算出接近最优的出牌。
 *
 * - levelK < 1：乱打（当噪声基线）
 * - levelK ≈ 1：只认「哪个牌最容易做出蛐蛐要的行为」，不管撞车
 * - levelK ≥ 2：还要看近几轮别人挤在哪，并且会躲开「集体激怒」的牌
 *
 * 这里刻意不追求最优：本作的张力是**人机都读同一张表**，
 * bot 太强会把人的策略空间挤没，太弱又失去看点。
 */
function botPickCard(
  p: FlyTeaseParams,
  defId: string,
  levelK: number,
  history: FlyTeaseReveal[],
): number {
  const n = cardCount();
  const round = history.length + 1;
  if (levelK < 1 || Number.isNaN(levelK)) {
    return Math.floor(Math.random() * n);
  }
  // `botPick` 收不到 round，只能从历史长度推——runtime 传的就是本局历史
  const mood = cricketMoodFor(defId, round, p.fickleness);

  // 近两轮大家挤在哪些行为上
  const recent: Partial<Record<FlyBehavior, number>> = {};
  for (const rev of history.slice(-2)) {
    for (const seat of Object.keys(rev.tops)) {
      const b = rev.tops[Number(seat)];
      recent[b] = (recent[b] ?? 0) + 1;
    }
  }

  const weight = levelK >= 2 ? 1 : 0.4;
  let best = -1;
  let bestScore = -Infinity;
  for (const card of FLY_ATLAS.cards) {
    const hit = card.behavior[mood] ?? 0;
    if (hit < FLY_HIT_FLOOR) continue;
    const same = 1 + (recent[card.top] ?? 0) * weight;
    let score = hit * crowdFactor(same, p.crowding) * p.scoreWin;
    if (levelK >= 2) {
      // 预判：这张牌加上别人可能也会打的量，会不会把蛐蛐惹毛
      const projected =
        rageContribution(card.top, hit) +
        (recent[card.top] ?? 0) * rageOf(card.top) * 0.5;
      if (projected >= p.rageThreshold) score = -1;
    }
    // 加一点噪声，避免所有 bot 每轮打同一张牌
    score += (Math.random() - 0.5) * 0.2 * Math.min(3, Math.max(0, levelK));
    if (score > bestScore) {
      bestScore = score;
      best = card.index;
    }
  }
  return best >= 0 ? best : Math.floor(Math.random() * n);
}

/* ------------------------------------------------------------------ */
/* 模板模块                                                             */
/* ------------------------------------------------------------------ */

export const flyTeaseModule: TemplateModule = {
  template: FLYTEASE_TEMPLATE,
  gameKind: "fly",
  recordKey: "fly",

  /**
   * 两条入参路径都收：
   * - `choose`：牌下标（网页端点牌桌，是主路径）
   * - `play`  ：`ft:sugar:150:relay` 形式的牌 id（**给外部 Agent 用的**）
   *
   * 为什么给 Agent 另开一路：外部智能体读 JSON 时，一个可读的 id 比
   * 「第 27 张牌」好懂得多，而且牌堆一旦重排，id 仍然稳定。
   */
  normalizeSubmission(_def: GameDefinition, action: GameAction): number | null {
    if (action.type === "choose") {
      const c = action.choice;
      if (!Number.isInteger(c) || c < 0 || c >= cardCount()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `刺激牌下标需在 0–${cardCount() - 1} 之间`,
        });
      }
      return c;
    }
    if (action.type === "play") {
      const idx = indexOfCardId(action.cardId);
      if (idx < 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `未知的刺激牌 id：${action.cardId}`,
        });
      }
      return idx;
    }
    return null;
  },

  /** 超时兜底：按座位号轮转，确定且不偏袒任何座位 */
  timeoutFallback(_def: GameDefinition, seatIndex: number): number {
    return seatIndex % cardCount();
  },

  botPick(def, _seat, levelK, history): number {
    return botPickCard(
      paramsOf(def),
      def.id,
      levelK,
      history as FlyTeaseReveal[],
    );
  },

  resolveRound(def, round, entries) {
    const p = paramsOf(def);
    const mood = cricketMoodFor(def.id, round, p.fickleness);

    const values: Record<number, number> = {};
    const behaviors: Record<number, Record<FlyBehavior, number>> = {};
    const tops: Record<number, FlyBehavior> = {};
    for (const e of entries) {
      const card = cardAt(e.value);
      values[e.seat] = e.value;
      behaviors[e.seat] = card.behavior;
      tops[e.seat] = card.top;
    }

    // 拥挤：按**主导行为**分组计数。真正互相挤的是「做同一件事」，
    // 而不是「选了同一张牌」——同行为不同牌一样会撞车。
    const sameCount: Record<number, number> = {};
    const byTop = new Map<FlyBehavior, number[]>();
    for (const e of entries) {
      const list = byTop.get(tops[e.seat]) ?? [];
      list.push(e.seat);
      byTop.set(tops[e.seat], list);
    }
    for (const seats of byTop.values()) {
      for (const s of seats) sameCount[s] = seats.length;
    }

    const hits: Record<number, number> = {};
    const crowd: Record<number, number> = {};
    for (const e of entries) {
      hits[e.seat] = behaviors[e.seat][mood] ?? 0;
      crowd[e.seat] = crowdFactor(sameCount[e.seat] ?? 1, p.crowding);
    }

    // 怒气：只有「真的做出来了」才算（低于地板的行为不激怒蛐蛐）
    let rage = 0;
    for (const e of entries) {
      rage += rageContribution(tops[e.seat], hits[e.seat]);
    }
    const raged = rage >= p.rageThreshold;

    const gains: Record<number, number> = {};
    for (const e of entries) {
      gains[e.seat] = raged
        ? 0
        : gainFor(hits[e.seat], sameCount[e.seat] ?? 1, p.crowding, p.scoreWin);
    }

    // 脉冲雨图：只回传本轮真正被用到的牌，按牌去重
    const rain: Record<number, number[][]> = {};
    for (const e of entries) {
      if (rain[e.value]) continue;
      rain[e.value] = cardAt(e.value).rain;
    }

    const reveal: FlyTeaseReveal = {
      round,
      values,
      behaviors,
      tops,
      cricketMood: mood,
      hits,
      crowd,
      rage: Math.round(rage * 1000) / 1000,
      raged,
      gains,
      rain,
      poolOrder: FLY_ATLAS.poolOrder,
      engine: FLY_ATLAS.engine,
    };

    const scoreDeltas: Record<number, number> = {};
    for (const e of entries) scoreDeltas[e.seat] = gains[e.seat];
    return { reveal, scoreDeltas };
  },

  roundWinners(reveal: unknown): number[] {
    const r = reveal as FlyTeaseReveal;
    return Object.keys(r.gains)
      .map(Number)
      .filter((seat) => (r.gains[seat] ?? 0) > 0)
      .sort((a, b) => a - b);
  },
};

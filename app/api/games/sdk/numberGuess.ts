/**
 * ============================================================================
 * numberGuess 模板执行器（api/games/sdk/numberGuess.ts）
 * ----------------------------------------------------------------------------
 * 由 v3 api/games/guessRoom.ts 重构而来，规则行为不变：
 * 每人秘密提交 [min,max] 实数，最接近「均值 × targetRatio」者胜该轮
 * （平局先提交者胜），胜 +scoreWin、次近 +scoreSecond。
 * v3 默认值（0–100 / 2/3 / +2/+1 / 5 轮 / 30s 窗）= 官方定义 guess-core。
 * ============================================================================
 */
import { TRPCError } from "@trpc/server";
import type { GameAction, GuessReveal } from "@contracts/room";
import type { GameDefinition, NumberGuessParams } from "@contracts/gameSdk";
import type { RoundEntry, TemplateModule } from "./templates";

/* ------------------------------------------------------------------ */
/* level-k 启发式 bot（移植自 v3，参数随 def.params 泛化，默认行为不变）   */
/* ------------------------------------------------------------------ */
function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clampGuess(v: number, p: NumberGuessParams): number {
  const c = Math.max(p.min, Math.min(p.max, v));
  return Math.round(c * 10) / 10;
}

function levelKAnchor(k: number, p: NumberGuessParams): number {
  const mid = (p.min + p.max) / 2;
  return mid * Math.pow(p.targetRatio, k);
}

interface GuessHistoryEntry extends GuessReveal {
  entries: RoundEntry[];
}

/** level-k 锚点 + 上轮目标自适应 + 高斯噪声（与 v3 decideGuessNumber 一致） */
function botPickNumber(
  levelK: number,
  history: GuessHistoryEntry[],
  p: NumberGuessParams,
): number {
  let k = levelK;
  if (history.length > 0) {
    const last = history[history.length - 1];
    if (last.target < levelKAnchor(k, p)) k += 0.1 + Math.random() * 0.3;
    else k -= 0.05 + Math.random() * 0.2;
    k = Math.max(0, Math.min(4.2, k));
  }
  let value = levelKAnchor(k, p);
  if (history.length > 0) {
    let wSum = 0;
    let pred = 0;
    for (let i = 0; i < history.length; i++) {
      const w = Math.pow(0.7, history.length - 1 - i);
      wSum += w;
      pred += history[i].average * w;
    }
    pred /= wSum;
    const bestResponse = pred * p.targetRatio;
    const adaptW = Math.min(0.65, 0.16 * history.length) * (0.4 + k / 4);
    value = value * (1 - adaptW) + bestResponse * adaptW;
  }
  return clampGuess(value + gaussian() * 0.09 * (p.max - p.min) * 0.18, p);
}

/* ------------------------------------------------------------------ */
/* 模板模块                                                             */
/* ------------------------------------------------------------------ */
export const numberGuessModule: TemplateModule = {
  template: "numberGuess",
  gameKind: "guess",
  recordKey: "guess",

  normalizeSubmission(def: GameDefinition, action: GameAction): number | null {
    if (action.type !== "submit") return null;
    const p = def.params as NumberGuessParams;
    const value = action.value;
    if (
      typeof value !== "number" ||
      Number.isNaN(value) ||
      value < p.min ||
      value > p.max
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `数字需在 ${p.min}–${p.max} 之间`,
      });
    }
    return clampGuess(value, p);
  },

  timeoutFallback(def: GameDefinition): number {
    const p = def.params as NumberGuessParams;
    return clampGuess((p.min + p.max) / 2, p);
  },

  botPick(def: GameDefinition, _seat: number, levelK: number, history): number {
    return botPickNumber(
      levelK,
      history as GuessHistoryEntry[],
      def.params as NumberGuessParams,
    );
  },

  resolveRound(def, round, entries) {
    const p = def.params as NumberGuessParams;
    const sorted = [...entries].sort((a, b) => a.order - b.order);
    const sum = sorted.reduce((acc, e) => acc + e.value, 0);
    const average = Math.round((sum / sorted.length) * 100) / 100;
    const target = Math.round(average * p.targetRatio * 100) / 100;

    const deltas: Record<number, number> = {};
    for (const e of sorted) {
      deltas[e.seat] = Math.round(Math.abs(e.value - target) * 100) / 100;
    }
    const minDelta = Math.min(...sorted.map((e) => deltas[e.seat]));
    const winners = sorted.filter((e) => deltas[e.seat] === minDelta);
    const winner = winners[0]; // 平局 → 先提交者胜（entries 已按提交序）
    const tieWin = winners.length > 1;
    const rest = sorted.filter((e) => e.seat !== winner.seat);
    const runnerDelta = Math.min(...rest.map((e) => deltas[e.seat]));
    const runner = rest.find((e) => deltas[e.seat] === runnerDelta)!;

    const values: Record<number, number> = {};
    for (const e of sorted) values[e.seat] = e.value;

    const reveal: GuessReveal = {
      round,
      values,
      average,
      target,
      winnerSeat: winner.seat,
      runnerSeat: runner.seat,
      tieWin,
    };
    return {
      reveal,
      scoreDeltas: {
        [winner.seat]: p.scoreWin,
        [runner.seat]: p.scoreSecond,
      },
    };
  },

  roundWinners(reveal: unknown): number[] {
    return [(reveal as GuessReveal).winnerSeat];
  },
};

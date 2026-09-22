/**
 * ============================================================================
 * pollDuel 模板执行器（api/games/sdk/pollDuel.ts）——「红眼病」同时投票博弈
 * ----------------------------------------------------------------------------
 * 全员同时秘密选择一个选项（choices 下标），揭晓后统计各选项得票：
 * 唯一最少人选项（少数派）的所有选择者各得 scoreWin 分；并列最少则流局
 * 无人得分。N 轮后总分定胜负。
 * bot 策略：倾向历史少数派（累计得票最少者）+ 噪声。
 * ============================================================================
 */
import { TRPCError } from "@trpc/server";
import type { GameAction } from "@contracts/room";
import type {
  GameDefinition,
  PollDuelParams,
  PollReveal,
} from "@contracts/gameSdk";
import type { TemplateModule } from "./templates";

function choiceCount(p: PollDuelParams): number {
  return p.choices.length;
}

/** bot：65% 选历史累计最少票的选项（并列随机破），否则随机 + 噪声 */
function botPickChoice(p: PollDuelParams, history: PollReveal[]): number {
  const n = choiceCount(p);
  if (history.length > 0 && Math.random() < 0.65) {
    const totals = new Array<number>(n).fill(0);
    for (const r of history) {
      r.counts.forEach((c, i) => {
        totals[i] += c;
      });
    }
    const min = Math.min(...totals);
    const candidates = totals
      .map((t, i) => ({ t, i }))
      .filter((x) => x.t === min)
      .map((x) => x.i);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  return Math.floor(Math.random() * n);
}

export const pollDuelModule: TemplateModule = {
  template: "pollDuel",
  gameKind: "poll",
  recordKey: "poll",

  normalizeSubmission(def: GameDefinition, action: GameAction): number | null {
    if (action.type !== "choose") return null;
    const p = def.params as PollDuelParams;
    const c = action.choice;
    if (typeof c !== "number" || !Number.isInteger(c) || c < 0 || c >= choiceCount(p)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `选项需在 0–${choiceCount(p) - 1} 之间`,
      });
    }
    return c;
  },

  /** 超时兜底：按座位号轮转选一个确定选项 */
  timeoutFallback(def: GameDefinition, seatIndex: number): number {
    const p = def.params as PollDuelParams;
    return seatIndex % choiceCount(p);
  },

  botPick(def: GameDefinition, _seat: number, _levelK: number, history): number {
    return botPickChoice(
      def.params as PollDuelParams,
      history as PollReveal[],
    );
  },

  resolveRound(def, round, entries) {
    const p = def.params as PollDuelParams;
    const n = choiceCount(p);
    const counts = new Array<number>(n).fill(0);
    const values: Record<number, number> = {};
    for (const e of entries) {
      counts[e.value] += 1;
      values[e.seat] = e.value;
    }
    const min = Math.min(...counts);
    const minorities = counts
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c === min)
      .map((x) => x.i);
    // 唯一少数派才有胜者；并列最少 → 流局
    const minorityChoice = minorities.length === 1 ? minorities[0] : -1;
    const winnerSeats =
      minorityChoice === -1
        ? []
        : entries.filter((e) => e.value === minorityChoice).map((e) => e.seat);

    const reveal: PollReveal = {
      round,
      values,
      counts,
      minorityChoice,
      winnerSeats,
    };
    const scoreDeltas: Record<number, number> = {};
    for (const seat of winnerSeats) scoreDeltas[seat] = p.scoreWin;
    return { reveal, scoreDeltas };
  },

  roundWinners(reveal: unknown): number[] {
    return (reveal as PollReveal).winnerSeats;
  },
};

/**
 * 月影村·十二席狼人杀内容包适配器。
 *
 * 这是与 beastRace / superpowerBilliards 同层的独立适配器。当前公共
 * Game SDK 的模板联合尚未包含 werewolf，所以这里不伪装成 TemplateModule；
 * 主线接线时只需把本模块的 reducer/action/view 接到 runtime 的结构化动作
 * 入口，并把事件增量交给 EventRecorder 即可。
 */
import { TRPCError } from "@trpc/server";
import {
  buildWerewolf12BattleReport,
  createWerewolf12Match,
  legalWerewolf12Actions,
  normalizeWerewolf12Action,
  reduceWerewolf12,
  timeoutFallbackWerewolf12,
  type Werewolf12Action,
  type Werewolf12BattleReport,
  type Werewolf12Command,
  type Werewolf12MatchState,
  type Werewolf12SeatInput,
  type Werewolf12ReduceResult,
} from "@contracts/werewolf12";

export interface Werewolf12Definition {
  id?: string;
  template: "werewolf";
  gameKind?: string;
  recordKey?: string;
  seatCount?: 12;
  seed: string;
}

export interface Werewolf12RoundEntry {
  seat: number;
  action: Werewolf12Action;
  order?: number;
}

export interface Werewolf12ResolveResult {
  state: Werewolf12MatchState;
  events: Werewolf12ReduceResult["events"];
  report: Werewolf12BattleReport;
}

export interface Werewolf12Module {
  template: "werewolf";
  gameKind: "werewolf";
  recordKey: "werewolf12";
  initMatchState(
    seed: string,
    seatCount?: number,
    seats?: readonly Werewolf12SeatInput[]
  ): Werewolf12MatchState;
  legalActions(state: Werewolf12MatchState, seat: number): Werewolf12Action[];
  normalizeSubmission(
    state: Werewolf12MatchState,
    seat: number,
    action: unknown
  ): Werewolf12Action;
  timeoutFallback(state: Werewolf12MatchState, seat: number): Werewolf12Action;
  botPick(
    state: Werewolf12MatchState,
    seat: number,
    levelK?: number
  ): Werewolf12Action;
  reduce(
    state: Werewolf12MatchState,
    command: Werewolf12Command
  ): Werewolf12ReduceResult;
  resolveRound(
    state: Werewolf12MatchState,
    entries: Werewolf12RoundEntry[]
  ): Werewolf12ResolveResult;
  battleReport(state: Werewolf12MatchState): Werewolf12BattleReport;
}

function normalizeError(error: unknown): never {
  const message = error instanceof Error ? error.message : "狼人杀动作不合法";
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const werewolf12Module: Werewolf12Module = {
  template: "werewolf",
  gameKind: "werewolf",
  recordKey: "werewolf12",

  initMatchState(seed, seatCount = 12, seats) {
    if (seatCount !== 12) throw new Error("werewolf12 只支持 12 席");
    return createWerewolf12Match(seed, seats);
  },

  legalActions(state, seat) {
    return legalWerewolf12Actions(state, seat);
  },

  normalizeSubmission(state, seat, action) {
    try {
      return normalizeWerewolf12Action(state, seat, action);
    } catch (error) {
      return normalizeError(error);
    }
  },

  timeoutFallback(state, seat) {
    return timeoutFallbackWerewolf12(state, seat);
  },

  botPick(state, seat, _levelK = 2.4) {
    const fallback = timeoutFallbackWerewolf12(state, seat);
    if (fallback.type === "speech") {
      return {
        type: "speech",
        text: `第 ${state.day} 天，${seat + 1} 号位完成公开证言。`,
      };
    }
    if (fallback.type === "lastWords")
      return { type: "lastWords", text: "我留下这段证言，供回放核对。" };
    return fallback;
  },

  reduce(state, command) {
    return reduceWerewolf12(state, command);
  },

  resolveRound(state, entries) {
    let current = state;
    const ordered = [...entries].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.seat - b.seat
    );
    const events: Werewolf12ResolveResult["events"] = [];
    for (const entry of ordered) {
      const result = reduceWerewolf12(current, {
        seat: entry.seat,
        action: entry.action,
      });
      current = result.state;
      events.push(...result.events);
    }
    return {
      state: current,
      events,
      report: buildWerewolf12BattleReport(current),
    };
  },

  battleReport(state) {
    return buildWerewolf12BattleReport(state);
  },
};

export function werewolf12ActionCandidates(
  state: Werewolf12MatchState,
  seat: number
): Werewolf12Action[] {
  return werewolf12Module.legalActions(state, seat);
}

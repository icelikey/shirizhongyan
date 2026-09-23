/**
 * 金壤·超能力赛马内容包适配器。
 *
 * 这是一个不改公共 SDK 的内容包适配层：它把 play 动作、确定性 reducer、
 * 合法候选和演出事件聚在一起，待公共 runtime 支持结构化 payload 后接入。
 */
import {
  createRaceMatchState,
} from "@contracts/beastRace.data";
import {
  legalRaceActions,
  normalizeRaceAction,
  reduceRaceRound,
  type RaceAction,
  type RaceMatchState,
  type RaceRoundResult,
} from "@contracts/beastRace";

export interface BeastRaceRoundEntry {
  seat: number;
  action: RaceAction;
  order?: number;
}

export interface BeastRaceDefinition {
  id?: string;
  template: "beastRace";
  gameKind?: string;
  recordKey?: string;
  seatCount?: number;
  seed: string;
}

export interface BeastRaceModule {
  template: "beastRace";
  gameKind: "beastRace";
  recordKey: "beastRace";
  initMatchState(seed: string, seatCount: number): RaceMatchState;
  legalActions(state: RaceMatchState, seat: number): RaceAction[];
  normalizeSubmission(
    state: RaceMatchState,
    seat: number,
    action: RaceAction,
  ): RaceAction;
  timeoutFallback(state: RaceMatchState, seat: number): RaceAction;
  botPick(state: RaceMatchState, seat: number, levelK?: number): RaceAction;
  resolveRound(
    state: RaceMatchState,
    round: number,
    entries: BeastRaceRoundEntry[],
  ): {
    reveal: RaceRoundResult["reveal"];
    state: RaceMatchState;
    events: RaceRoundResult["events"];
    highlights: RaceRoundResult["highlights"];
    scoreDeltas: Record<number, number>;
    finished: boolean;
  };
  roundWinners(reveal: RaceRoundResult["reveal"]): number[];
}

function scoreDeltas(state: RaceMatchState, finishers: number[]): Record<number, number> {
  const scores: Record<number, number> = {};
  for (const seat of finishers) {
    const rank = state.racers.find(r => r.seat === seat)?.finishRank ?? 0;
    scores[seat] = Math.max(1, 4 - rank);
  }
  return scores;
}

/**
 * echo-bot 与 LLM 共用同一个候选边界：先取合法候选，再按固定排序选取。
 * levelK 保留在签名中供未来策略层使用，但不允许它改变合法性。
 */
function pickBotAction(state: RaceMatchState, seat: number, _levelK = 2.4): RaceAction {
  const candidates = legalRaceActions(state, seat);
  if (candidates.length === 0) throw new Error("该席位没有合法赛马动作");
  const racer = state.racers.find(r => r.seat === seat)!;
  const leader = [...state.racers]
    .filter(r => r.seat !== seat && r.finishRank === null)
    .sort((a, b) => b.position - a.position || a.seat - b.seat)[0];
  const preferred = candidates.find(c => {
    if (!leader || c.targetSeat !== undefined) return false;
    return c.cardId.startsWith(`${racer.beastId.slice(0, 2)}-a`);
  }) ?? candidates.find(c => c.targetSeat === leader?.seat) ?? candidates[0];
  return { ...preferred };
}

export const beastRaceModule: BeastRaceModule = {
  template: "beastRace",
  gameKind: "beastRace",
  recordKey: "beastRace",

  initMatchState(seed, seatCount) {
    return createRaceMatchState(seed, seatCount);
  },

  legalActions(state, seat) {
    return legalRaceActions(state, seat);
  },

  normalizeSubmission(state, seat, action) {
    return normalizeRaceAction(state, seat, action);
  },

  timeoutFallback(state, seat) {
    const action = legalRaceActions(state, seat)[0];
    if (!action) throw new Error("超时席位没有合法赛马动作");
    return action;
  },

  botPick: pickBotAction,

  resolveRound(state, round, entries) {
    const ordered = [...entries].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.seat - b.seat);
    const result = reduceRaceRound(
      state,
      ordered.map(entry => ({ seat: entry.seat, action: entry.action })),
      round,
    );
    return {
      ...result,
      scoreDeltas: scoreDeltas(result.state, result.reveal.finishers),
      finished: result.reveal.finishers.length > 0,
    };
  },

  roundWinners(reveal) {
    return reveal.finishers;
  },
};

export function raceActionCandidates(state: RaceMatchState, seat: number): RaceAction[] {
  return beastRaceModule.legalActions(state, seat);
}

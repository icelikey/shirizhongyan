/**
 * 《终焉》·月影村十二席狼人杀独立契约。
 *
 * 公共 Game SDK 目前还没有 werewolf 模板，因此本文件不改动
 * gameSdk.ts / runtime.ts，而是提供一个可被未来公共接线直接包裹的
 * 纯函数状态机：相同 seed 与相同命令序列必得相同状态和事件流。
 */
import type { MatchEvent, MatchSeatKind } from "./matchLog";
import { projectEvents, SPECTATOR } from "./matchLog";

export const WEREWOLF12_GAME_ID = "werewolf-12" as const;
export const WEREWOLF12_RULEBOOK_ID = "rb-werewolf" as const;
export const WEREWOLF12_SEAT_COUNT = 12 as const;
export const WEREWOLF12_MAX_SPEECH_LENGTH = 160 as const;
export const WEREWOLF12_MAX_LAST_WORDS_LENGTH = 60 as const;
/** 系统阶段事件使用的伪座位号；真实座位永远是 0–11。 */
export const WEREWOLF12_SYSTEM_SEAT = -1 as const;

export type Werewolf12Role = "werewolf" | "seer" | "witch" | "villager";
export type Werewolf12Camp = "wolf" | "good";
export type Werewolf12Phase =
  | "night-wolf"
  | "night-seer"
  | "night-witch"
  | "day-speech"
  | "day-vote"
  | "last-words"
  | "finished";

export const WEREWOLF12_ROLE_DEAL: readonly Werewolf12Role[] = [
  "werewolf",
  "werewolf",
  "werewolf",
  "werewolf",
  "seer",
  "witch",
  "villager",
  "villager",
  "villager",
  "villager",
  "villager",
  "villager",
] as const;

export interface Werewolf12SeatInput {
  index: number;
  name: string;
  kind: MatchSeatKind;
  echoId?: string;
}

export interface Werewolf12SeatState extends Werewolf12SeatInput {
  role: Werewolf12Role;
  camp: Werewolf12Camp;
  alive: boolean;
}

export type Werewolf12Action =
  | { type: "wolfKill"; target: number }
  | { type: "seerCheck"; target: number }
  | { type: "witchAction"; save: boolean; poison: number | null }
  | { type: "speech"; text: string }
  | { type: "vote"; target: number | null }
  | { type: "lastWords"; text: string }
  /** 非当前行动席位的超时占位；不会改变状态。 */
  | { type: "pass" };

export interface Werewolf12Command {
  seat: number;
  action: Werewolf12Action;
}

export interface Werewolf12NightState {
  wolfVotes: Record<number, number>;
  wolfVictim: number | null;
  seerTarget: number | null;
  seerResult: { target: number; isWolf: boolean } | null;
  witchActioned: boolean;
  saved: boolean;
  poisonTarget: number | null;
}

export interface Werewolf12VoteResult {
  day: number;
  votes: Record<number, number | null>;
  tally: Record<number, number>;
  exiled: number | null;
  tie: boolean;
}

export interface Werewolf12SpeechRecord {
  day: number;
  seat: number;
  text: string;
  lastWords: boolean;
}

export interface Werewolf12DayReport {
  day: number;
  nightDeaths: number[];
  speeches: Werewolf12SpeechRecord[];
  vote: Werewolf12VoteResult | null;
  eliminations: { seat: number; reason: "night" | "poison" | "vote" }[];
}

export interface Werewolf12MatchState {
  version: 1;
  gameId: typeof WEREWOLF12_GAME_ID;
  rulebookId: typeof WEREWOLF12_RULEBOOK_ID;
  seed: string;
  phase: Werewolf12Phase;
  day: number;
  seats: Werewolf12SeatState[];
  night: Werewolf12NightState;
  witch: { saveUsed: boolean; poisonUsed: boolean };
  speechQueue: number[];
  speechCursor: number;
  speeches: Werewolf12SpeechRecord[];
  votes: Record<number, number | null>;
  voteResult: Werewolf12VoteResult | null;
  lastWordsSeat: number | null;
  lastNightDeaths: number[];
  eliminationOrder: { seat: number; reason: "night" | "poison" | "vote" }[];
  reports: Werewolf12DayReport[];
  winner: Werewolf12Camp | null;
  rankings: number[];
  /** 直接写入 matchLog 时使用的严格递增 seq。 */
  nextEventSeq: number;
  events: MatchEvent[];
}

export interface Werewolf12BattleReport {
  gameId: typeof WEREWOLF12_GAME_ID;
  rulebookId: typeof WEREWOLF12_RULEBOOK_ID;
  seed: string;
  seatCount: typeof WEREWOLF12_SEAT_COUNT;
  winner: Werewolf12Camp | null;
  winningSeats: number[];
  finalAliveSeats: number[];
  rankings: number[];
  days: Werewolf12DayReport[];
  /** 全知战报保留完整事件；座位战报应调用 projectWerewolf12Events。 */
  events: MatchEvent[];
}

export interface Werewolf12SeatView {
  index: number;
  name: string;
  kind: MatchSeatKind;
  alive: boolean;
  role: Werewolf12Role | null;
  camp: Werewolf12Camp | null;
}

export interface Werewolf12StateView {
  gameId: typeof WEREWOLF12_GAME_ID;
  phase: Werewolf12Phase;
  day: number;
  seats: Werewolf12SeatView[];
  lastNightDeaths: number[];
  voteResult: Werewolf12VoteResult | null;
  winner: Werewolf12Camp | null;
  rankings: number[];
  events: MatchEvent[];
}

export interface Werewolf12ReduceResult {
  state: Werewolf12MatchState;
  events: MatchEvent[];
}

export class Werewolf12RuleError extends Error {
  readonly code = "BAD_REQUEST" as const;

  constructor(message: string) {
    super(message);
    this.name = "Werewolf12RuleError";
  }
}

function campForRole(role: Werewolf12Role): Werewolf12Camp {
  return role === "werewolf" ? "wolf" : "good";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedHash(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffledRoles(seed: string): Werewolf12Role[] {
  const roles = [...WEREWOLF12_ROLE_DEAL];
  let cursor = seedHash(seed);
  for (let i = roles.length - 1; i > 0; i -= 1) {
    cursor = (Math.imul(cursor ^ (cursor >>> 13), 1103515245) + 12345) >>> 0;
    const j = cursor % (i + 1);
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  return roles;
}

function defaultSeats(): Werewolf12SeatInput[] {
  return Array.from({ length: WEREWOLF12_SEAT_COUNT }, (_, index) => ({
    index,
    name: `${index + 1}号位`,
    kind: "echo-bot" as const,
  }));
}

function validateSeats(input: readonly Werewolf12SeatInput[]): void {
  if (input.length !== WEREWOLF12_SEAT_COUNT) {
    throw new Werewolf12RuleError("狼人杀必须固定为 12 席");
  }
  input.forEach((seat, expected) => {
    if (seat.index !== expected) {
      throw new Werewolf12RuleError("席位必须是连续的 0–11");
    }
    if (!seat.name.trim()) {
      throw new Werewolf12RuleError(`席位 ${seat.index} 缺少名称`);
    }
  });
}

function emptyNight(): Werewolf12NightState {
  return {
    wolfVotes: {},
    wolfVictim: null,
    seerTarget: null,
    seerResult: null,
    witchActioned: false,
    saved: false,
    poisonTarget: null,
  };
}

function pushEvent(
  state: Werewolf12MatchState,
  event: Record<string, unknown>,
  round = state.day
): void {
  state.events.push({
    ...event,
    seq: state.nextEventSeq,
    round,
  } as unknown as MatchEvent);
  state.nextEventSeq += 1;
}

function pushPhase(state: Werewolf12MatchState, next: Werewolf12Phase): void {
  const previous = state.phase;
  state.phase = next;
  pushEvent(state, {
    t: "action",
    seat: WEREWOLF12_SYSTEM_SEAT,
    kind: "phase",
    value: null,
    payload: { from: previous, to: next },
  });
}

function pushAction(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action,
  secret: boolean
): void {
  const value =
    "target" in action && typeof action.target === "number"
      ? action.target
      : null;
  pushEvent(state, {
    t: "action",
    ...(secret ? { secret: true } : {}),
    seat,
    kind: action.type,
    value,
    payload: action,
  });
}

function pushSpeech(
  state: Werewolf12MatchState,
  speech: Werewolf12SpeechRecord
): void {
  pushEvent(state, {
    t: "speech",
    seat: speech.seat,
    intent: speech.lastWords ? "lastWords" : "pass",
    targetSeat: null,
    claimedRole: null,
    text: speech.text,
  });
}

function aliveSeats(state: Werewolf12MatchState): number[] {
  return state.seats.filter(seat => seat.alive).map(seat => seat.index);
}

function aliveWolves(state: Werewolf12MatchState): number[] {
  return state.seats
    .filter(seat => seat.alive && seat.camp === "wolf")
    .map(seat => seat.index);
}

function aliveGoods(state: Werewolf12MatchState): number[] {
  return state.seats
    .filter(seat => seat.alive && seat.camp === "good")
    .map(seat => seat.index);
}

function isAlive(state: Werewolf12MatchState, seat: number): boolean {
  return state.seats[seat]?.alive === true;
}

function ensureDayReport(state: Werewolf12MatchState): Werewolf12DayReport {
  const current = state.reports.find(report => report.day === state.day);
  if (current) return current;
  const created: Werewolf12DayReport = {
    day: state.day,
    nightDeaths: [],
    speeches: [],
    vote: null,
    eliminations: [],
  };
  state.reports.push(created);
  return created;
}

function recordElimination(
  state: Werewolf12MatchState,
  seat: number,
  reason: "night" | "poison" | "vote"
): void {
  if (!isAlive(state, seat)) return;
  state.seats[seat].alive = false;
  state.eliminationOrder.push({ seat, reason });
  ensureDayReport(state).eliminations.push({ seat, reason });
  pushEvent(state, { t: "eliminate", seat, reason });
}

function winnerFor(state: Werewolf12MatchState): Werewolf12Camp | null {
  const wolves = aliveWolves(state).length;
  const goods = aliveGoods(state).length;
  if (wolves === 0) return "good";
  if (goods <= wolves) return "wolf";
  return null;
}

function rankingsFor(state: Werewolf12MatchState): number[] {
  const alive = aliveSeats(state);
  const eliminated = [...state.eliminationOrder]
    .reverse()
    .map(entry => entry.seat);
  return [...alive, ...eliminated.filter(seat => !alive.includes(seat))];
}

function finish(state: Werewolf12MatchState, winner: Werewolf12Camp): void {
  state.winner = winner;
  state.rankings = rankingsFor(state);
  pushPhase(state, "finished");
  pushEvent(state, {
    t: "matchEnd",
    rankings: state.rankings,
    winnerSeat:
      aliveSeats(state).find(seat => state.seats[seat].camp === winner) ?? null,
    fragmentsDelta: {},
  });
}

function nextAliveAfter(state: Werewolf12MatchState, anchor: number): number[] {
  const result: number[] = [];
  for (let offset = 1; offset <= WEREWOLF12_SEAT_COUNT; offset += 1) {
    const seat = (anchor + offset) % WEREWOLF12_SEAT_COUNT;
    if (isAlive(state, seat)) result.push(seat);
  }
  return result;
}

function beginDaySpeech(state: Werewolf12MatchState): void {
  const anchor =
    state.lastNightDeaths.length > 0
      ? state.lastNightDeaths[state.lastNightDeaths.length - 1]
      : WEREWOLF12_SEAT_COUNT - 1;
  state.speechQueue = nextAliveAfter(state, anchor);
  state.speechCursor = 0;
  state.votes = {};
  state.voteResult = null;
  pushPhase(state, "day-speech");
}

function beginNight(state: Werewolf12MatchState, day: number): void {
  state.day = day;
  state.night = emptyNight();
  state.lastNightDeaths = [];
  state.lastWordsSeat = null;
  pushEvent(state, { t: "roundBegin" });
  pushPhase(state, "night-wolf");
}

function resolveNight(state: Werewolf12MatchState): void {
  const deaths: number[] = [];
  const victim = state.night.saved ? null : state.night.wolfVictim;
  if (victim !== null && isAlive(state, victim)) deaths.push(victim);
  if (
    state.night.poisonTarget !== null &&
    isAlive(state, state.night.poisonTarget)
  ) {
    if (!deaths.includes(state.night.poisonTarget))
      deaths.push(state.night.poisonTarget);
  }
  deaths.sort((a, b) => a - b);
  for (const seat of deaths) {
    const reason = seat === state.night.poisonTarget ? "poison" : "night";
    recordElimination(state, seat, reason);
  }
  state.lastNightDeaths = [...deaths];
  ensureDayReport(state).nightDeaths = [...deaths];
  pushEvent(state, {
    t: "reveal",
    payload: { kind: "night", day: state.day, deaths },
    winnerSeats: [],
  });

  const winner = winnerFor(state);
  if (winner) {
    finish(state, winner);
    return;
  }
  beginDaySpeech(state);
}

function targetIsAliveOther(
  state: Werewolf12MatchState,
  seat: number,
  target: number
): boolean {
  return (
    target >= 0 &&
    target < WEREWOLF12_SEAT_COUNT &&
    target !== seat &&
    isAlive(state, target)
  );
}

function legalWitchActions(
  state: Werewolf12MatchState,
  seat: number
): Werewolf12Action[] {
  if (state.witch.saveUsed && state.witch.poisonUsed) return [];
  const actions: Werewolf12Action[] = [
    { type: "witchAction", save: false, poison: null },
  ];
  const victim = state.night.wolfVictim;
  if (
    !state.witch.saveUsed &&
    victim !== null &&
    (victim !== seat || state.day === 1)
  ) {
    actions.push({ type: "witchAction", save: true, poison: null });
  }
  if (!state.witch.poisonUsed) {
    for (const target of aliveSeats(state)) {
      if (target !== seat)
        actions.push({ type: "witchAction", save: false, poison: target });
    }
  }
  return actions;
}

export function legalWerewolf12Actions(
  state: Werewolf12MatchState,
  seat: number
): Werewolf12Action[] {
  if (state.phase === "finished" || seat < 0 || seat >= WEREWOLF12_SEAT_COUNT)
    return [];
  const actor = state.seats[seat];
  if (!actor) return [];

  if (state.phase === "night-wolf") {
    if (actor.camp !== "wolf" || !actor.alive || seat in state.night.wolfVotes)
      return [];
    return aliveGoods(state).map(target => ({ type: "wolfKill", target }));
  }
  if (state.phase === "night-seer") {
    if (
      actor.role !== "seer" ||
      !actor.alive ||
      state.night.seerTarget !== null
    )
      return [];
    return aliveSeats(state)
      .filter(target => target !== seat)
      .map(target => ({ type: "seerCheck", target }));
  }
  if (state.phase === "night-witch") {
    if (actor.role !== "witch" || !actor.alive || state.night.witchActioned)
      return [];
    return legalWitchActions(state, seat);
  }
  if (state.phase === "day-speech") {
    if (state.speechQueue[state.speechCursor] !== seat) return [];
    return [{ type: "speech", text: "" }];
  }
  if (state.phase === "day-vote") {
    if (!actor.alive || seat in state.votes) return [];
    return [
      { type: "vote", target: null },
      ...aliveSeats(state)
        .filter(target => target !== seat)
        .map((target): Werewolf12Action => ({ type: "vote", target })),
    ];
  }
  if (state.phase === "last-words") {
    if (state.lastWordsSeat !== seat) return [];
    return [{ type: "lastWords", text: "" }];
  }
  return [];
}

function sameAction(a: Werewolf12Action, b: Werewolf12Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "wolfKill" && b.type === "wolfKill")
    return a.target === b.target;
  if (a.type === "seerCheck" && b.type === "seerCheck")
    return a.target === b.target;
  if (a.type === "witchAction" && b.type === "witchAction")
    return a.save === b.save && a.poison === b.poison;
  if (a.type === "vote" && b.type === "vote") return a.target === b.target;
  return true;
}

function actionAllowed(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): boolean {
  const legal = legalWerewolf12Actions(state, seat);
  if (action.type === "speech" || action.type === "lastWords") {
    return legal.some(candidate => candidate.type === action.type);
  }
  return legal.some(candidate => sameAction(candidate, action));
}

export function normalizeWerewolf12Action(
  state: Werewolf12MatchState,
  seat: number,
  raw: unknown
): Werewolf12Action {
  if (!raw || typeof raw !== "object" || !("type" in raw)) {
    throw new Werewolf12RuleError("动作缺少 type");
  }
  const input = raw as Record<string, unknown>;
  let action: Werewolf12Action;
  switch (input.type) {
    case "wolfKill":
    case "seerCheck": {
      if (!Number.isInteger(input.target))
        throw new Werewolf12RuleError("目标席位必须是整数");
      const target = input.target as number;
      action =
        input.type === "wolfKill"
          ? { type: "wolfKill", target }
          : { type: "seerCheck", target };
      break;
    }
    case "witchAction": {
      if (typeof input.save !== "boolean")
        throw new Werewolf12RuleError("女巫 save 必须是布尔值");
      if (input.poison !== null && !Number.isInteger(input.poison)) {
        throw new Werewolf12RuleError("女巫 poison 必须是席位号或 null");
      }
      action = {
        type: "witchAction",
        save: input.save,
        poison: input.poison as number | null,
      };
      break;
    }
    case "speech":
    case "lastWords": {
      if (typeof input.text !== "string" || !input.text.trim()) {
        throw new Werewolf12RuleError("发言内容不能为空");
      }
      const max =
        input.type === "speech"
          ? WEREWOLF12_MAX_SPEECH_LENGTH
          : WEREWOLF12_MAX_LAST_WORDS_LENGTH;
      action = { type: input.type, text: input.text.trim().slice(0, max) };
      break;
    }
    case "vote":
      if (input.target !== null && !Number.isInteger(input.target)) {
        throw new Werewolf12RuleError("投票目标必须是席位号或 null");
      }
      action = { type: "vote", target: input.target as number | null };
      break;
    case "pass":
      action = { type: "pass" };
      break;
    default:
      throw new Werewolf12RuleError("狼人杀动作不在白名单内");
  }
  if (
    action.type === "pass" &&
    legalWerewolf12Actions(state, seat).length === 0
  )
    return action;
  if (!actionAllowed(state, seat, action))
    throw new Werewolf12RuleError("当前阶段不允许该动作");
  return action;
}

export function timeoutFallbackWerewolf12(
  state: Werewolf12MatchState,
  seat: number
): Werewolf12Action {
  const legal = legalWerewolf12Actions(state, seat);
  if (legal.length === 0) return { type: "pass" };
  const first = legal[0];
  if (first.type === "speech")
    return { type: "speech", text: "（超时未发言）" };
  if (first.type === "lastWords")
    return { type: "lastWords", text: "（未留下遗言）" };
  return clone(first);
}

function reduceNightWolf(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "wolfKill")
    throw new Werewolf12RuleError("狼人夜间只能提交落刀目标");
  state.night.wolfVotes[seat] = action.target;
  pushAction(state, seat, action, true);
  const wolves = aliveWolves(state);
  if (wolves.some(wolf => !(wolf in state.night.wolfVotes))) return;
  const counts: Record<number, number> = {};
  for (const target of Object.values(state.night.wolfVotes))
    counts[target] = (counts[target] ?? 0) + 1;
  state.night.wolfVictim =
    Object.keys(counts)
      .map(Number)
      .sort((a, b) => counts[b] - counts[a] || a - b)[0] ?? null;
  const seer = state.seats.find(
    candidate => candidate.alive && candidate.role === "seer"
  );
  const witch = state.seats.find(
    candidate => candidate.alive && candidate.role === "witch"
  );
  if (seer) pushPhase(state, "night-seer");
  else if (witch) pushPhase(state, "night-witch");
  else resolveNight(state);
}

function reduceNightSeer(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "seerCheck")
    throw new Werewolf12RuleError("预言家夜间只能提交查验目标");
  state.night.seerTarget = action.target;
  state.night.seerResult = {
    target: action.target,
    isWolf: state.seats[action.target].camp === "wolf",
  };
  pushAction(state, seat, action, true);
  pushEvent(state, {
    t: "reveal",
    secret: true,
    payload: { kind: "seerResult", day: state.day, ...state.night.seerResult },
    winnerSeats: [seat],
  });
  const witch = state.seats.find(
    candidate => candidate.alive && candidate.role === "witch"
  );
  if (witch) pushPhase(state, "night-witch");
  else resolveNight(state);
}

function reduceNightWitch(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "witchAction")
    throw new Werewolf12RuleError("女巫夜间只能提交救人或毒杀");
  state.night.witchActioned = true;
  if (action.save) {
    state.witch.saveUsed = true;
    state.night.saved = true;
  }
  if (action.poison !== null) {
    state.witch.poisonUsed = true;
    state.night.poisonTarget = action.poison;
  }
  pushAction(state, seat, action, true);
  resolveNight(state);
}

function tallyVotes(state: Werewolf12MatchState): Werewolf12VoteResult {
  const tally: Record<number, number> = {};
  for (const target of Object.values(state.votes)) {
    if (target === null) continue;
    tally[target] = (tally[target] ?? 0) + 1;
  }
  const counts = Object.entries(tally).map(([target, count]) => ({
    target: Number(target),
    count,
  }));
  const max = counts.reduce((value, item) => Math.max(value, item.count), 0);
  const leaders = counts
    .filter(item => item.count === max)
    .map(item => item.target);
  const tie = leaders.length !== 1 || max === 0;
  return {
    day: state.day,
    votes: clone(state.votes),
    tally,
    exiled: tie ? null : leaders[0],
    tie,
  };
}

function reduceDaySpeech(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "speech")
    throw new Werewolf12RuleError("白天发言阶段只能提交 speech");
  const speech: Werewolf12SpeechRecord = {
    day: state.day,
    seat,
    text: action.text,
    lastWords: false,
  };
  state.speeches.push(speech);
  ensureDayReport(state).speeches.push(speech);
  pushSpeech(state, speech);
  state.speechCursor += 1;
  if (state.speechCursor >= state.speechQueue.length)
    pushPhase(state, "day-vote");
}

function reduceDayVote(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "vote")
    throw new Werewolf12RuleError("白天投票阶段只能提交 vote");
  state.votes[seat] = action.target;
  pushAction(state, seat, action, true);
  const eligible = aliveSeats(state);
  if (eligible.some(candidate => !(candidate in state.votes))) return;
  const result = tallyVotes(state);
  state.voteResult = result;
  ensureDayReport(state).vote = clone(result);
  pushEvent(state, {
    t: "reveal",
    payload: { kind: "vote", ...result },
    winnerSeats: [],
  });
  if (result.exiled !== null) {
    recordElimination(state, result.exiled, "vote");
    state.lastWordsSeat = result.exiled;
    state.winner = winnerFor(state);
    pushPhase(state, "last-words");
    return;
  }
  const winner = winnerFor(state);
  if (winner) finish(state, winner);
  else beginNight(state, state.day + 1);
}

function reduceLastWords(
  state: Werewolf12MatchState,
  seat: number,
  action: Werewolf12Action
): void {
  if (action.type !== "lastWords")
    throw new Werewolf12RuleError("遗言阶段只能提交 lastWords");
  const speech: Werewolf12SpeechRecord = {
    day: state.day,
    seat,
    text: action.text,
    lastWords: true,
  };
  state.speeches.push(speech);
  ensureDayReport(state).speeches.push(speech);
  pushSpeech(state, speech);
  const winner = state.winner ?? winnerFor(state);
  if (winner) finish(state, winner);
  else beginNight(state, state.day + 1);
}

export function createWerewolf12Match(
  seed: string,
  seats: readonly Werewolf12SeatInput[] = defaultSeats()
): Werewolf12MatchState {
  if (!seed.trim()) throw new Werewolf12RuleError("狼人杀必须有稳定 seed");
  validateSeats(seats);
  const roles = shuffledRoles(seed);
  const state: Werewolf12MatchState = {
    version: 1,
    gameId: WEREWOLF12_GAME_ID,
    rulebookId: WEREWOLF12_RULEBOOK_ID,
    seed,
    phase: "night-wolf",
    day: 1,
    seats: seats.map((seat, index) => ({
      ...seat,
      role: roles[index],
      camp: campForRole(roles[index]),
      alive: true,
    })),
    night: emptyNight(),
    witch: { saveUsed: false, poisonUsed: false },
    speechQueue: [],
    speechCursor: 0,
    speeches: [],
    votes: {},
    voteResult: null,
    lastWordsSeat: null,
    lastNightDeaths: [],
    eliminationOrder: [],
    reports: [],
    winner: null,
    rankings: [],
    nextEventSeq: 0,
    events: [],
  };
  pushEvent(
    state,
    {
      t: "matchStart",
      round: 0,
      rulebookId: WEREWOLF12_RULEBOOK_ID,
      seed,
      seats: seats.map(({ index, name, kind, echoId }) => ({
        index,
        name,
        kind,
        ...(echoId ? { echoId } : {}),
      })),
    },
    0
  );
  for (const seat of state.seats) {
    pushEvent(
      state,
      { t: "secretAssign", secret: true, seat: seat.index, value: seat.role },
      0
    );
  }
  pushEvent(state, { t: "roundBegin" });
  pushEvent(state, {
    t: "action",
    seat: WEREWOLF12_SYSTEM_SEAT,
    kind: "phase",
    value: null,
    payload: { from: "identity-sealed", to: "night-wolf" },
  });
  return state;
}

export function reduceWerewolf12(
  input: Werewolf12MatchState,
  command: Werewolf12Command
): Werewolf12ReduceResult {
  const state = clone(input);
  if (state.phase === "finished") throw new Werewolf12RuleError("对局已经结束");
  const action = normalizeWerewolf12Action(state, command.seat, command.action);
  const eventStart = state.events.length;
  if (action.type === "pass") return { state, events: [] };

  switch (state.phase) {
    case "night-wolf":
      reduceNightWolf(state, command.seat, action);
      break;
    case "night-seer":
      reduceNightSeer(state, command.seat, action);
      break;
    case "night-witch":
      reduceNightWitch(state, command.seat, action);
      break;
    case "day-speech":
      reduceDaySpeech(state, command.seat, action);
      break;
    case "day-vote":
      reduceDayVote(state, command.seat, action);
      break;
    case "last-words":
      reduceLastWords(state, command.seat, action);
      break;
  }
  return { state, events: state.events.slice(eventStart) };
}

export function buildWerewolf12BattleReport(
  state: Werewolf12MatchState
): Werewolf12BattleReport {
  const winner = state.winner;
  return {
    gameId: state.gameId,
    rulebookId: state.rulebookId,
    seed: state.seed,
    seatCount: WEREWOLF12_SEAT_COUNT,
    winner,
    winningSeats: winner
      ? state.seats.filter(seat => seat.camp === winner).map(seat => seat.index)
      : [],
    finalAliveSeats: aliveSeats(state),
    rankings: [...state.rankings],
    days: clone(state.reports),
    events: clone(state.events),
  };
}

export function projectWerewolf12Events(
  state: Werewolf12MatchState,
  viewer: number | typeof SPECTATOR
): MatchEvent[] {
  return projectEvents(state.events, viewer);
}

export function projectWerewolf12State(
  state: Werewolf12MatchState,
  viewer: number | typeof SPECTATOR
): Werewolf12StateView {
  return {
    gameId: state.gameId,
    phase: state.phase,
    day: state.day,
    seats: state.seats.map(seat => ({
      index: seat.index,
      name: seat.name,
      kind: seat.kind,
      alive: seat.alive,
      role: viewer === SPECTATOR || viewer === seat.index ? seat.role : null,
      camp: viewer === SPECTATOR || viewer === seat.index ? seat.camp : null,
    })),
    lastNightDeaths: [...state.lastNightDeaths],
    voteResult: state.voteResult ? clone(state.voteResult) : null,
    winner: state.winner,
    rankings: [...state.rankings],
    events: projectWerewolf12Events(state, viewer),
  };
}

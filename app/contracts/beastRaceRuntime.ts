/**
 * 金壤·超能力赛马房间运行时合同。
 *
 * `beastRace.ts` 负责确定性物理与卡牌结算；本文件只描述房间层需要
 * 持久化、校验和回放的边界。它不把叙事、模型或掉落服务写进 reducer。
 */
import type { GameAction } from "./room";
import type {
  RaceAction,
  RaceEvent,
  RaceHighlight,
  RaceMatchState,
  RaceReveal,
} from "./beastRace";

export const BEAST_RACE_RUNTIME_VERSION = 1 as const;
export const BEAST_RACE_TEMPLATE = "beastRace" as const;
/** 每匹兽正好有 8 张初始卡；房间最多推进到第 8 轮。 */
export const BEAST_RACE_MAX_ROUNDS = 8;

export type BeastRaceRoomStatus = "playing" | "finished";
export type BeastRaceRoomPhase = "play" | "reveal" | "finished";
export type BeastRaceActionSource = "player" | "agent" | "timeout";
export type BeastRacePlayAction = Extract<GameAction, { type: "play" }>;

/** 供尚未扩展公共 GameDefinition 的内容包使用的最小定义。 */
export interface BeastRaceRuntimeDefinition {
  template: typeof BEAST_RACE_TEMPLATE;
  seed: string;
  id?: string;
  maxRounds?: number;
}

/** 模板桥接校验动作时必须显式带入的房间上下文。 */
export interface BeastRaceTemplateContext {
  matchState: RaceMatchState;
  seat: number;
}

/** 房间内已接受的一条动作；action 已经去掉 type 外壳并完成规范化。 */
export interface BeastRaceRoundEntry {
  seat: number;
  action: RaceAction;
  order: number;
  source: BeastRaceActionSource;
}

/** 一轮完整的可回放记录。 */
export interface BeastRaceReplayRound {
  round: number;
  entries: BeastRaceRoundEntry[];
  reveal: RaceReveal;
  events: RaceEvent[];
  highlights: RaceHighlight[];
  scoreDeltas: Record<number, number>;
  dropCandidates: BeastRaceDropCandidate[];
}

/**
 * 掉落候选只携带规则事件证据，不直接发放奖励。
 * worldbuilding/superpower-race 内容包再把证据映射成 sr.* 掉落。
 */
export interface BeastRaceDropCandidate {
  seat: number;
  round: number;
  reason: "finish" | "high-risk-route";
  evidence: RaceEvent[];
}

/**
 * 回放、得分、掉落的只读通知钩子。
 * 回调返回值不会进入结算链，因此 Agent 或展示层不能改写物理结果。
 */
export interface BeastRaceResolutionHooks {
  onReplayEvent?: (event: Readonly<RaceEvent>) => void;
  onScore?: (seat: number, delta: number, round: number) => void;
  onDropCandidate?: (candidate: Readonly<BeastRaceDropCandidate>) => void;
}

/** 随 rooms.stateJson 持久化的独立房间适配状态。 */
export interface BeastRaceRoomState {
  runtimeVersion: typeof BEAST_RACE_RUNTIME_VERSION;
  template: typeof BEAST_RACE_TEMPLATE;
  seed: string;
  seatCount: number;
  maxRounds: number;
  status: BeastRaceRoomStatus;
  phase: BeastRaceRoomPhase;
  round: number;
  matchState: RaceMatchState;
  submissions: BeastRaceRoundEntry[];
  scores: Record<number, number>;
  history: BeastRaceReplayRound[];
  lastReveal: RaceReveal | null;
  rankings: number[] | null;
  winner: number | null;
}

/** 解析一轮后返回的新房间快照。 */
export interface BeastRaceRoomResolution {
  state: BeastRaceRoomState;
  reveal: RaceReveal;
  events: RaceEvent[];
  highlights: RaceHighlight[];
  scoreDeltas: Record<number, number>;
  dropCandidates: BeastRaceDropCandidate[];
  finished: boolean;
}

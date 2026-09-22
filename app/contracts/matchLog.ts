/**
 * ============================================================================
 * 对局事件流共享契约（contracts/matchLog.ts）
 * ----------------------------------------------------------------------------
 * 一局对局 = 种子 + RuleBook id + 有序事件流。三个下游全部只读本文件：
 * - 回放 / J2 仲裁：从 seed 重跑内核，逐事件比对
 * - 彩蛋判定（api/world/eggs.ts）：纯函数吃事件流吐卡牌 id
 * - 观战页：全知视角按事件流演出
 *
 * 【密态约定】secret === true 的事件只允许出现在 SPECTATOR（全知）投影中，
 * 座位投影必须过滤掉它们。这条约定由 api/world/eggs.test.ts 断言。
 * ============================================================================
 */

/** 席位类型（与 contracts/room.ts 的 SeatKind 同义，此处独立以免循环依赖） */
export type MatchSeatKind = "human" | "external-agent" | "echo-bot";

/** 发言意图（与 src/engine/speech.ts 的 SpeechIntent 对齐） */
export type MatchSpeechIntent =
  | "biaoshui"
  | "accuse"
  | "bandwagon"
  | "pass"
  | "defend"
  | "seerClaim"
  | "seerCounter"
  | "lastWords"
  | "wolfSuggest";

/** 淘汰原因 */
export type EliminateReason = "vote" | "night" | "poison" | "bust" | "timeout";

/* ------------------------------------------------------------------ */
/* 事件联合                                                            */
/* ------------------------------------------------------------------ */

interface EventBase {
  /** 事件序号（0 起，单局内严格递增） */
  seq: number;
  /** 发生轮次（0 = 开局前） */
  round: number;
  /**
   * 密态标记：true 表示仅全知投影可见。
   * 座位投影必须过滤，否则就是信息泄漏。
   */
  secret?: true;
}

export interface MatchStartEvent extends EventBase {
  t: "matchStart";
  rulebookId: string;
  seed: string;
  seats: { index: number; name: string; kind: MatchSeatKind; echoId?: string }[];
}

/** 身份/底牌发放——永远是密态 */
export interface SecretAssignEvent extends EventBase {
  t: "secretAssign";
  secret: true;
  seat: number;
  /** 角色或底牌标识（'werewolf' / 'emperor' / 'S14' …） */
  value: string;
}

export interface RoundBeginEvent extends EventBase {
  t: "roundBegin";
}

export interface ActionEvent extends EventBase {
  t: "action";
  seat: number;
  /** 动作原语（submit / choose / target / play / fold / raise …） */
  kind: string;
  /** 数值载荷（出数、选项下标、筹码额、目标座位…） */
  value: number | null;
}

export interface SpeechEvent extends EventBase {
  t: "speech";
  seat: number;
  intent: MatchSpeechIntent;
  targetSeat: number | null;
  /** 声称的身份（悍跳检测用；null = 未声称） */
  claimedRole: string | null;
  text: string;
}

export interface AbilityUsedEvent extends EventBase {
  t: "abilityUsed";
  seat: number;
  abilityId: string;
  hook: string;
}

export interface RevealEvent extends EventBase {
  t: "reveal";
  /** 本轮公开揭晓载荷（各模板自定，回放时按 rulebookId 解释） */
  payload: unknown;
  /** 本轮得分座位 */
  winnerSeats: number[];
}

export interface EliminateEvent extends EventBase {
  t: "eliminate";
  seat: number;
  reason: EliminateReason;
}

/** 规则质询：Agent 引条款主张改判 */
export interface AppealEvent extends EventBase {
  t: "appeal";
  seat: number;
  clauseId: string;
  assertion: string;
}

/** J1 裁判团裁决 */
export interface RulingEvent extends EventBase {
  t: "ruling";
  clauseId: string;
  /** 主张是否被采纳 */
  upheld: boolean;
  /** 发起质询的座位 */
  appellantSeat: number;
  /** 3 席裁判的投票（true = 支持采纳） */
  judgeVotes: boolean[];
}

export interface MatchEndEvent extends EventBase {
  t: "matchEnd";
  /** 座位号按名次排序 */
  rankings: number[];
  winnerSeat: number | null;
  /** 座位号 → 本局碎片净收益（已扣门票，可为负） */
  fragmentsDelta: Record<number, number>;
}

export type MatchEvent =
  | MatchStartEvent
  | SecretAssignEvent
  | RoundBeginEvent
  | ActionEvent
  | SpeechEvent
  | AbilityUsedEvent
  | RevealEvent
  | EliminateEvent
  | AppealEvent
  | RulingEvent
  | MatchEndEvent;

export type MatchEventType = MatchEvent["t"];

/* ------------------------------------------------------------------ */
/* 落库信封                                                            */
/* ------------------------------------------------------------------ */

/** match_logs.payloadJson 的结构 */
export interface MatchLogEnvelope {
  /** 契约版本，回放时校验 */
  version: 1;
  rulebookId: string;
  seed: string;
  startedAt: number;
  endedAt: number | null;
  events: MatchEvent[];
}

export const MATCH_LOG_VERSION = 1 as const;

/* ------------------------------------------------------------------ */
/* 投影：座位视角必须剥掉密态事件                                        */
/* ------------------------------------------------------------------ */

/** 全知观战视角标记（project 的 viewer 取值之一） */
export const SPECTATOR = "spectator" as const;

/**
 * 事件流投影。viewer 为 SPECTATOR 时返回全量；为座位号时剥掉所有
 * secret 事件，但保留该座位自己的 secretAssign（你知道自己的身份）。
 *
 * 这是事件流唯一的出库通道——新增密态事件只要打上 secret 标记即自动受保护。
 */
export function projectEvents(
  events: readonly MatchEvent[],
  viewer: number | typeof SPECTATOR
): MatchEvent[] {
  if (viewer === SPECTATOR) return [...events];
  return events.filter(e => {
    if (!e.secret) return true;
    return e.t === "secretAssign" && e.seat === viewer;
  });
}

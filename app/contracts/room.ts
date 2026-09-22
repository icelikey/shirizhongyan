/**
 * ============================================================================
 * 《十日牌局》v3 联机「猜平均数」共享契约（contracts/room.ts）
 * ----------------------------------------------------------------------------
 * 前端与后端共同依赖的类型定义。字段命名保持稳定，请勿随意改名。
 *
 * 规则（服务端权威）：6 席、5 轮、每人秘密提交 0–100 实数，
 * 最接近「平均值 × 2/3」者胜该轮（平局先提交者胜），胜 +2 分、次近 +1；
 * 每轮 30s 提交窗，超时未交按 50 兜底；全员提交即提前揭晓；
 * 揭晓 5s 后进入下一轮；5 轮后 finished。
 * ============================================================================
 */

import type { EntryFee, GameTemplate, Rewards } from "./gameSdk";

/** 房间状态（与 rooms.status 一致） */
export type RoomStatus = "waiting" | "playing" | "finished";

/** 席位类型：浏览器真人 / 外部 API Key Agent / 服务端内置回声 Bot */
export type SeatKind = "human" | "external-agent" | "echo-bot";

/** 对局阶段（仅 playing 时有意义） */
export type GuessPhase = "submit" | "reveal";

/** 座位视角下的单座信息（脱敏：他人的秘密数字不在此结构中） */
export interface GuessSeatView {
  /** 座位号 0–5 */
  index: number;
  /** 展示名（真人=昵称，bot=影从名，Agent=Key 名） */
  name: string;
  kind: SeatKind;
  /** 本轮是否已提交（值在揭晓前不可见） */
  submitted: boolean;
  /** 累计积分（胜轮 +2，次近 +1） */
  score: number;
  /** 该座是否已离场/断线（本版本恒 false，保留） */
  gone: boolean;
}

/** 一轮揭晓后的公开结果 */
export interface GuessReveal {
  round: number;
  /** 座位号 → 提交值（揭晓后全员公开） */
  values: Record<number, number>;
  /** 全员平均值（保留两位小数） */
  average: number;
  /** 目标值 = average × 2/3 */
  target: number;
  /** 本轮胜者座位（平局取先提交者） */
  winnerSeat: number;
  /** 本轮次近座位 */
  runnerSeat: number;
  /** 是否因「同距 · 先提交者胜」产生胜者 */
  tieWin: boolean;
}

/**
 * 座位视角的脱敏房间状态（room.state / agent.gatewayObserve 返回）。
 * 他人已提交的数字在揭晓前不可见；lastReveal 为上一轮的公开揭晓。
 */
export interface GuessRoomView {
  /** 房间码（6 位大写字母数字） */
  code: string;
  /** 房间名（创建时可指定） */
  roomName: string;
  status: RoomStatus;
  /** v4 SDK：本房间使用的游戏定义 id（旧 guess 房恒 'guess-core'） */
  defId: string;
  /** v4 SDK：游戏模板（numberGuess=猜平均数 / pollDuel=红眼病投票） */
  template: GameTemplate;
  /** v4 SDK：游戏定义名（官方或 UGC 命名） */
  gameName: string;
  /** v4 SDK：每轮行动时限（秒） */
  submitWindowSec: number;
  /** v4 SDK：门票（花色 + 数额，0=友谊局） */
  entryFee: EntryFee;
  /** v4 SDK：结算奖励（碎片数，花色同 entryFee.suit） */
  rewards: Rewards;
  /** v4 SDK：pollDuel 选项标签（numberGuess 房为 null） */
  choices: string[] | null;
  /** 当前轮次 1–5（waiting 时为 0） */
  round: number;
  /** 总轮数（恒 5） */
  totalRounds: number;
  /** 当前阶段（waiting/finished 时为 null） */
  phase: GuessPhase | null;
  /** 6 个座位（空座不存在——开局后空位全部由 echo-bot 填充） */
  seats: GuessSeatView[];
  /** 上一轮揭晓结果（第一轮前为 null） */
  lastReveal: GuessReveal | null;
  /** 请求者自己的座位号；无 seatToken 或旁观时为 null */
  mySeat: number | null;
  /** 终局冠军座位号（finished 时必有） */
  winner: number | null;
  /** 终局名次（座位号按名次排序；未结束为 null） */
  rankings: number[] | null;
  /** 当前提交窗截止时间戳（ms，epoch；非 submit 阶段为 null） */
  submitDeadlineAt: number | null;
  /** 本轮已提交人数 */
  submittedCount: number;
  /** 服务端当前时间戳（ms，供客户端校准时钟） */
  serverNow: number;
}

/** 房间列表摘要（room.list / agent.gatewayRooms 返回元素） */
export interface RoomSummary {
  code: string;
  roomName: string;
  /** 房间游戏种类（numberGuess→'guess'，pollDuel→'poll'） */
  game: string;
  status: RoomStatus;
  /** 总座位数（由游戏定义 seats 决定，2–8） */
  seatsTotal: number;
  /** 已占座位数（含 bot 填充前的等待期） */
  seatsTaken: number;
  /** 是否有外部 Agent 席位 */
  hasAgentSeat: boolean;
  createdAt: Date;
  /** v4 SDK：游戏定义 id / 模板 / 游戏名 / 是否官方（UGC 房列表「创」角标） */
  defId: string;
  template: GameTemplate;
  gameName: string;
  isOfficial: boolean;
  entryFee: EntryFee;
}

/** room.create / room.join 返回 */
export interface JoinResult {
  code: string;
  /** 座位凭证（浏览器真人 / 外部 Agent 各一份，state/act 凭此识别身份） */
  seatToken: string;
  seatIndex: number;
}

/** agent.gatewayJoin 返回 */
export interface AgentJoinResult extends JoinResult {
  agentId: number;
}

/**
 * 可提交动作：
 * - start：房主开局（全模板通用）
 * - submit：numberGuess 提交数字（范围由 def.params.min/max 决定）
 * - choose：pollDuel 选择选项下标（0–choices.length-1）
 * - play：打出一张牌，可指定目标座位（beastRace 等有手牌的模板）
 *
 * 【为何新增 play】submit/choose 的载荷都是单个数字，装不下
 * 「打哪张牌 + 对谁用」这种二元决策。凡有手牌与目标的玩法都需要它。
 * 新增为联合分支而非改写既有分支，故现有模板无需改动。
 */
export type GuessAction =
  | { type: "start" }
  | { type: "submit"; value: number }
  | { type: "choose"; choice: number }
  | { type: "play"; cardId: string; targetSeat?: number }
  /**
   * 提交一段文本（辩论、猜词提问、发言）。
   *
   * 【为何需要】前四种动作的载荷都是数字或 id，装不下自然语言。
   * 而「模糊议题由 Agent 裁判裁决」这一机制的输入恰恰是文本——
   * 没有它，AI 裁判就只能判确定性规则，而确定性规则用算法即可，
   * 根本不需要 Agent。文本动作是去中心化裁判成立的前提。
   */
  | { type: "speak"; text: string; targetSeat?: number };

/** 门户别名：v4 起所有 SDK 模板共用此动作类型 */
export type GameAction = GuessAction;

/** 房间配置（rooms.config） */
export interface RoomConfig {
  /** 房间名（用于恢复与展示） */
  roomName?: string;
  /** 创建后是否自动开局（默认 false，由房主 room.act start） */
  autoStart?: boolean;
}

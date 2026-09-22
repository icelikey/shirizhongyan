/**
 * ============================================================================
 * Game SDK 模板模块接口（api/games/sdk/templates.ts）
 * ----------------------------------------------------------------------------
 * 每个游戏模板（numberGuess / pollDuel）实现本接口，通用房间 actor
 * （runtime.ts 的 SdkRoom）负责：入座/seatToken/bot 填充/计时/持久化/结算。
 * ============================================================================
 */
import type { GameAction } from "@contracts/room";
import type { GameDefinition, GameTemplate } from "@contracts/gameSdk";

/** 一轮内的一条提交（value 含义由模板定：猜数=数值，投票=选项下标） */
export interface RoundEntry {
  seat: number;
  value: number;
  /** 提交顺序（0 起，平局先提交者胜） */
  order: number;
  /**
   * 结构化载荷，形状由模板自定（如 { cardId, targetSeat }）。
   * value 只能装一个数字，带目标的出牌装不下，故另开此字段。
   * 可选：猜数/投票这类单值模板不用填。
   */
  payload?: unknown;
}

export interface TemplateModule {
  template: GameTemplate;
  /** rooms.game 列值（v3 兼容：numberGuess→'guess'） */
  gameKind: string;
  /** traveler_profiles.recordsJson 战绩键（numberGuess 沿用 'guess'） */
  recordKey: string;

  /**
   * 跨轮持久状态的初值（可选）。
   *
   * 猜数与投票是无状态的：每轮独立结算，历史只用于 bot 参考。
   * 但赛马这类玩法要记住每匹马的位置、状态层、手牌与冷却，
   * 这些必须跨轮存活，且要能随 rooms.stateJson 持久化。
   *
   * 不实现此方法的模板视为无状态，运行时不为其分配状态槽。
   */
  initMatchState?(def: GameDefinition, seatCount: number): unknown;
  /**
   * 校验并归一化一局内提交动作，返回数值载荷；
   * 非提交动作（如 start）返回 null。非法载荷抛 TRPCError(BAD_REQUEST)。
   */
  normalizeSubmission(def: GameDefinition, action: GameAction): number | null;
  /** 超时未交的兜底提交值 */
  timeoutFallback(def: GameDefinition, seatIndex: number): number;
  /** echo-bot 决策（levelK 为 bot 人设层级，pollDuel 可忽略） */
  botPick(
    def: GameDefinition,
    seatIndex: number,
    levelK: number,
    history: unknown[],
  ): number;
  /**
   * 揭晓本轮：产出公开 reveal 对象 + 每座得分增量。
   *
   * matchState 为 initMatchState 的产物（无状态模板收到 undefined）。
   * 有状态模板可原地修改它——运行时在本方法返回后统一持久化。
   *
   * 返回 finished 可提前终局（如赛马有马冲过终点线），
   * 不返回则由运行时按 def.params.rounds 正常推进。
   */
  resolveRound(
    def: GameDefinition,
    round: number,
    entries: RoundEntry[],
    matchState?: unknown,
  ): {
    reveal: unknown;
    scoreDeltas: Record<number, number>;
    /** 提前终局标记（可选）：true 时运行时立即结算全局 */
    finished?: boolean;
  };
  /** 一轮 reveal 中的得分座位（终局名次平分时用） */
  roundWinners(reveal: unknown): number[];
}

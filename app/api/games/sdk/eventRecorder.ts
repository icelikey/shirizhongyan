/**
 * ============================================================================
 * 对局事件记录器（api/games/sdk/eventRecorder.ts）
 * ----------------------------------------------------------------------------
 * 统一记录确定性房间产生的 MatchEvent，作为 match_logs、观战、回放、
 * 彩蛋判定和文字战报的事实来源。事件只追加，不反向改变胜负状态。
 *
 * 【为何独立成类而非写进 SdkRoom】
 * SdkRoom 已有 625 行，职责是「跑对局」。记录是横切关注点：
 * 它只追加、不判断，且必须在落库失败时不影响对局。分开后两者都好测。
 *
 * 【seq 严格递增】contracts/matchLog.ts 要求单局内 seq 严格递增，
 * 回放依赖这个顺序。故 seq 由本类独占维护，调用方不得自行赋值。
 *
 * 【密态纪律】secretAssign 必须打 secret: true，否则座位投影会泄漏身份。
 * 本类的 secretAssign() 强制写死该标记，不给调用方传错的机会。
 * ============================================================================
 */
import {
  MATCH_LOG_VERSION,
  type EliminateReason,
  type MatchEvent,
  type MatchLogEnvelope,
  type MatchSeatKind,
} from "@contracts/matchLog";

export class EventRecorder {
  private events: MatchEvent[] = [];
  private seq = 0;
  private round = 0;

  /** 对局种子——回放与裁判团组建都依赖它 */
  readonly seed: string;
  readonly rulebookId: string;
  readonly startedAt: number;
  private endedAt: number | null = null;

  constructor(opts: {
    seed: string;
    rulebookId: string;
    startedAt?: number;
    events?: readonly MatchEvent[];
  }) {
    this.seed = opts.seed;
    this.rulebookId = opts.rulebookId;
    this.startedAt = opts.startedAt ?? Date.now();
    if (opts.events) {
      const events = [...opts.events];
      if (events.some((event, index) => event.seq !== index)) {
        throw new Error("恢复事件流的 seq 必须从 0 连续递增");
      }
      this.events = events;
      this.seq = events.length;
      this.round = events.at(-1)?.round ?? 0;
      if (events.some(event => event.t === "matchEnd")) {
        this.endedAt = Date.now();
      }
    }
  }

  /** 事件数（落库时写入冗余列） */
  get count(): number {
    return this.events.length;
  }

  /** 只读快照——彩蛋判定与落库都读它 */
  get all(): readonly MatchEvent[] {
    return this.events;
  }

  private push(e: Omit<MatchEvent, "seq" | "round"> & { round?: number }): void {
    this.events.push({
      ...e,
      seq: this.seq++,
      round: e.round ?? this.round,
    } as MatchEvent);
  }

  /* ---------------------------------------------------------------- */
  /* 开局                                                              */
  /* ---------------------------------------------------------------- */

  matchStart(
    seats: { index: number; name: string; kind: MatchSeatKind; echoId?: string }[],
  ): void {
    this.push({
      t: "matchStart",
      round: 0,
      rulebookId: this.rulebookId,
      seed: this.seed,
      seats,
    } as never);
  }

  /**
   * 身份或底牌发放——恒为密态。
   * secret 由本方法写死，调用方无从传错。
   */
  secretAssign(seat: number, value: string): void {
    this.push({
      t: "secretAssign",
      secret: true,
      round: 0,
      seat,
      value,
    } as never);
  }

  /* ---------------------------------------------------------------- */
  /* 轮次                                                              */
  /* ---------------------------------------------------------------- */

  /** 进入新一轮。此后的事件默认归属该轮，无需每次传 round */
  roundBegin(round: number): void {
    this.round = round;
    this.push({ t: "roundBegin" } as never);
  }

  /**
   * 一次玩家动作。
   * kind 为动作原语（submit / choose / play …），value 为数值载荷。
   */
  action(seat: number, kind: string, value: number | null, payload?: unknown): void {
    this.push({ t: "action", seat, kind, value, ...(payload === undefined ? {} : { payload }) } as never);
  }

  /** 异能使用（H1–H5 五钩子） */
  abilityUsed(seat: number, abilityId: string, hook: string): void {
    this.push({ t: "abilityUsed", seat, abilityId, hook } as never);
  }

  /** 盘外招提案与结算；只记审计摘要，不记模型隐藏思维链。 */
  tactic(params: {
    seat: number;
    cardId: string;
    ruleHook: string;
    targetSeat: number | null;
    resolution: "accepted" | "rejected" | "countered" | "expired";
    counteredBySeat?: number | null;
    reason: string;
  }): void {
    this.push({
      t: "tactic",
      seat: params.seat,
      cardId: params.cardId,
      ruleHook: params.ruleHook,
      targetSeat: params.targetSeat,
      resolution: params.resolution,
      counteredBySeat: params.counteredBySeat ?? null,
      reason: params.reason,
    } as never);
  }

  /** Agent 主动提交的可观赏策略摘要；不是模型原始思维链。 */
  strategyTrace(params: {
    seat: number;
    phase: string;
    hypothesis: string;
    risk: "low" | "medium" | "high";
    candidateCount: number;
    chosenLabel: string;
    evidenceSeqs: number[];
  }): void {
    this.push({
      t: "strategyTrace",
      secret: true,
      seat: params.seat,
      phase: params.phase,
      hypothesis: params.hypothesis,
      risk: params.risk,
      candidateCount: params.candidateCount,
      chosenLabel: params.chosenLabel,
      evidenceSeqs: params.evidenceSeqs,
    } as never);
  }

  /** 本轮揭晓。payload 由模板自定，回放时按 rulebookId 解释 */
  reveal(payload: unknown, winnerSeats: number[]): void {
    this.push({ t: "reveal", payload, winnerSeats } as never);
  }

  eliminate(seat: number, reason: EliminateReason): void {
    this.push({ t: "eliminate", seat, reason } as never);
  }

  /* ---------------------------------------------------------------- */
  /* 终局                                                              */
  /* ---------------------------------------------------------------- */

  matchEnd(params: {
    rankings: number[];
    winnerSeat: number | null;
    fragmentsDelta: Record<number, number>;
  }): void {
    this.endedAt = Date.now();
    this.push({
      t: "matchEnd",
      rankings: params.rankings,
      winnerSeat: params.winnerSeat,
      fragmentsDelta: params.fragmentsDelta,
    } as never);
  }

  /** 组装落库信封 */
  envelope(): MatchLogEnvelope {
    return {
      version: MATCH_LOG_VERSION,
      rulebookId: this.rulebookId,
      seed: this.seed,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      events: this.events,
    };
  }
}

/**
 * 生成对局种子。
 *
 * 含随机分量，使同一房间的多局各不相同；但一旦生成即写入事件流，
 * 因此回放时用的是记录下来的那个值，仍然可复现。
 */
export function newMatchSeed(roomCode: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${roomCode}-${Date.now().toString(36)}-${rand}`;
}

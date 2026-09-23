/**
 * ============================================================================
 * Game SDK 通用房间 actor（api/games/sdk/runtime.ts）
 * ----------------------------------------------------------------------------
 * 由 v3 api/games/guessRoom.ts 重构泛化：
 * - 内存实例由 registry.ts 的 Map<code, SdkRoom> 持有，每次状态变更写回
 *   rooms.stateJson，进程重启后可从 DB 恢复（timers 按剩余时间重建）。
 * - 规则细节（提交校验/揭晓/计分/bot 决策）委托给 TemplateModule；
 *   本类负责：入座（human/external-agent）、seatToken、echo-bot 填充、
 *   提交窗计时、揭晓编排、持久化快照、按 def.rewards/entryFee 通用结算。
 * - 兼容说明：快照带 sdk:SDK_STATE_VERSION 标记；v3 旧房间的 stateJson
 *   无此标记，进程重启后不再恢复（随服务重启归档清理，registry.ts 注释）。
 * ============================================================================
 */
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type {
  GameAction,
  GuessRoomView,
  RoomConfig,
  RoomStatus,
  SeatKind,
} from "@contracts/room";
import type {
  GameDefinition,
  GameRoomView,
  PirateGoldParams,
  PirateGoldPending,
  PirateGoldReveal,
  PollReveal,
} from "@contracts/gameSdk";
import { cricketMoodFor, type FlyTeaseParams, type FlyTeaseReveal } from "@contracts/flyTease";
import {
  resolveSeatPolicy,
  seatKindAllowed,
  validateSeatComposition,
} from "@contracts/gameSdk";
import { awardGameResult } from "../../queries/profiles";
import { incrementGameDefPlays } from "../../queries/gameDefs";
import { persistRoomState } from "../../queries/rooms";
import { insertMatchLog } from "../../queries/matchLogs";
import { grantCard } from "../../queries/playerCards";
import { detectEggs } from "../../world/eggs";
import { ruleBookForTemplate } from "@contracts/rulebooks.data";
import { EventRecorder, newMatchSeed } from "./eventRecorder";
import type { RoundEntry, TemplateModule } from "./templates";
import { FLY_ATLAS } from "./flybrain/atlas.generated";

export const REVEAL_MS = 5_000;
/** v4 SDK 房间快照标记（v3 旧快照无此字段 → 不恢复） */
export const SDK_STATE_VERSION = 1;

const BOT_NAMES = [
  "白泽",
  "讹兽",
  "璇玑",
  "青囊",
  "烛阴",
  "阿九",
  "守拙",
  "百晓生",
];

/** 从已记录的对局种子派生稳定的人设层级，避免回放受 Math.random() 影响。 */
function botLevel(seed: string, seat: number): number {
  let hash = 2166136261;
  for (const char of `${seed}:${seat}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const fraction = (hash >>> 0) / 0xffffffff;
  return 1.6 + fraction * 2;
}

/* ------------------------------------------------------------------ */
/* 内部状态结构（整体序列化进 rooms.stateJson）                          */
/* ------------------------------------------------------------------ */
export interface SeatState {
  index: number;
  name: string;
  kind: SeatKind;
  seatToken: string | null;
  userId: number | null;
  agentKeyId: number | null;
  score: number;
}

export interface SdkRoomState {
  /** v4 SDK 快照标记（= SDK_STATE_VERSION） */
  sdk: number;
  version: number;
  status: RoomStatus;
  round: number;
  phase: "submit" | "reveal" | null;
  seats: (SeatState | null)[];
  scores: Record<number, number>;
  submissions: RoundEntry[];
  history: unknown[];
  lastReveal: unknown | null;
  rankings: number[] | null;
  winner: number | null;
  submitDeadlineAt: number | null;
  startedAt: number | null;
  settled: boolean;
  /**
   * 跨轮持久状态（initMatchState 的产物）。无状态模板
   * （numberGuess/pollDuel）恒为 null，行为不受影响。
   */
  matchState: unknown;
  /**
   * 本轮子阶段列表（phasesForRound 的产物）；单阶段模板恒为 null，
   * 此时提交/揭晓行为与新增此机制之前完全一致。
   */
  subPhases: { name: string; eligibleSeats: number[] }[] | null;
  /** 当前子阶段下标（单阶段模板恒为 0，不参与任何判断） */
  subPhaseIdx: number;
  /**
   * 对局种子（开局时生成）。回放与裁判团组建都依赖它——
   * 此前质询只能用「房间码 + 开局时刻」凑，现在有真种子了。
   */
  seed?: string;
  /** 已落库的 match_logs.id（终局后写入，观战页据此取事件流） */
  matchLogId?: number | null;
}

function newSeatToken(): string {
  return `st_${randomBytes(16).toString("hex")}`;
}

/* ------------------------------------------------------------------ */
/* SdkRoom —— 单个房间的通用 actor                                      */
/* ------------------------------------------------------------------ */
export class SdkRoom {
  code: string;
  roomName: string;
  createdByUserId: number | null;
  createdAt: Date;
  config: RoomConfig;
  readonly def: GameDefinition;
  private readonly module: TemplateModule;
  private state: SdkRoomState;
  /** 序列化状态变更的 promise 链（相当于 actor 邮箱） */
  private queue: Promise<unknown> = Promise.resolve();
  private submitTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private botTimers: Set<ReturnType<typeof setTimeout>> = new Set();
  /** bot 座位号 → level-k 层级（1.6–3.6 随机人设，pollDuel 忽略） */
  private botLevels: Map<number, number> = new Map();
  /**
   * 事件记录器。开局时创建，终局时落库。
   *
   * 为何不持久化：事件流在内存中累积，进程重启则本局记录丢失。
   * 这是刻意的取舍——完整方案要每个事件都写库（一局数十次写），
   * 而重启中断的对局本身已无法继续，其部分事件流也无回放价值。
   */
  private recorder: EventRecorder | null = null;

  constructor(opts: {
    def: GameDefinition;
    module: TemplateModule;
    code: string;
    roomName: string;
    createdByUserId: number | null;
    createdAt: Date;
    config: RoomConfig;
    state?: SdkRoomState;
  }) {
    this.def = opts.def;
    this.module = opts.module;
    this.code = opts.code;
    this.roomName = opts.roomName;
    this.createdByUserId = opts.createdByUserId;
    this.createdAt = opts.createdAt;
    this.config = opts.config;
    this.state = opts.state ?? {
      sdk: SDK_STATE_VERSION,
      version: 0,
      status: "waiting",
      round: 0,
      phase: null,
      seats: new Array<SeatState | null>(opts.def.seats).fill(null),
      scores: {},
      submissions: [],
      history: [],
      lastReveal: null,
      rankings: null,
      winner: null,
      submitDeadlineAt: null,
      startedAt: null,
      settled: false,
      matchState: null,
      subPhases: null,
      subPhaseIdx: 0,
    };
  }

  private get seatCount(): number {
    return this.def.seats;
  }

  private get totalRounds(): number {
    return this.def.params.rounds;
  }

  private get windowMs(): number {
    return this.def.submitWindowSec * 1000;
  }

  /* ---------------------------------------------------------------- */
  /* 序列化入口                                                         */
  /* ---------------------------------------------------------------- */
  private enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** 状态变更后写回 rooms 表（fire-and-forget，挂在队列尾） */
  private touch() {
    this.state.version += 1;
    const snapshot = JSON.parse(JSON.stringify(this.state)) as SdkRoomState;
    this.enqueue(() =>
      persistRoomState(this.code, this.state.status, snapshot).catch((err) => {
        console.error(`[sdkRoom] persist ${this.code} failed`, err);
      }),
    );
  }

  private clearTimers() {
    if (this.submitTimer) clearTimeout(this.submitTimer);
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.submitTimer = null;
    this.revealTimer = null;
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();
  }

  /* ---------------------------------------------------------------- */
  /* 入座（human / external-agent，全模板通用）                           */
  /* ---------------------------------------------------------------- */
  async joinAsHuman(user: { id: number; name: string | null }) {
    return this.enqueue(() => {
      if (this.state.status !== "waiting") {
        throw new TRPCError({ code: "CONFLICT", message: "房间已开局或已结束" });
      }
      // 席位准入：agent-only 之局不容真人入座
      if (!seatKindAllowed(resolveSeatPolicy(this.def), "human")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "此局只容智能体入座",
        });
      }
      const index = this.state.seats.findIndex((s) => s === null);
      if (index === -1) {
        throw new TRPCError({ code: "CONFLICT", message: "房间已满" });
      }
      const seat: SeatState = {
        index,
        name: user.name?.trim() || "旅人",
        kind: "human",
        seatToken: newSeatToken(),
        userId: user.id,
        agentKeyId: null,
        score: 0,
      };
      this.state.seats[index] = seat;
      this.touch();
      return { code: this.code, seatToken: seat.seatToken!, seatIndex: index };
    });
  }

  async joinAsAgent(key: { id: number; name: string }) {
    return this.enqueue(() => {
      // 外部 Agent 的 join 是幂等的：断线重连、CLI 重启或进程恢复时，
      // 使用同一 API Key 返回原座位，不重复占席，也不要求房间仍在 waiting。
      const existing = this.state.seats.find(
        (s) => s?.kind === "external-agent" && s.agentKeyId === key.id,
      );
      if (existing?.seatToken) {
        return {
          code: this.code,
          seatToken: existing.seatToken,
          seatIndex: existing.index,
        };
      }
      if (this.state.status !== "waiting") {
        throw new TRPCError({ code: "CONFLICT", message: "房间已开局或已结束" });
      }
      const index = this.state.seats.findIndex((s) => s === null);
      if (index === -1) {
        throw new TRPCError({ code: "CONFLICT", message: "房间已满" });
      }
      const seat: SeatState = {
        index,
        name: key.name,
        kind: "external-agent",
        seatToken: newSeatToken(),
        userId: null,
        agentKeyId: key.id,
        score: 0,
      };
      this.state.seats[index] = seat;
      this.touch();
      return { code: this.code, seatToken: seat.seatToken!, seatIndex: index };
    });
  }

  /* ---------------------------------------------------------------- */
  /* 动作（start 通用；submit/choose 由模板校验）                         */
  /* ---------------------------------------------------------------- */
  async act(seatToken: string, action: GameAction) {
    return this.enqueue(async () => {
      const seat = this.state.seats.find(
        (s) => s && s.seatToken === seatToken,
      );
      if (!seat) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无效的 seatToken" });
      }
      if (action.type === "start") return this.startInternal(seat);
      const payload = this.module.normalizeSubmission(this.def, action);
      if (payload === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `模板 ${this.def.template} 不支持动作 ${action.type}`,
        });
      }
      return this.submitInternal(seat, payload);
    });
  }

  /** 开局：仅房主（0 号 human 席）可发起；空位全部由 echo-bot 填充 */
  private startInternal(seat: SeatState) {
    if (this.state.status !== "waiting") {
      throw new TRPCError({ code: "CONFLICT", message: "房间已开局" });
    }
    const policy = resolveSeatPolicy(this.def);

    // agent-only 之局无真人，房主即 0 号 Agent 席
    if (seat.index !== 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "只有房主（0 号席）可以开局",
      });
    }
    if (policy !== "agent-only" && seat.kind !== "human") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "只有房主（0 号席）可以开局",
      });
    }

    // 席位构成校验：混合之局的人机下限在开局时才有意义
    // （入座是陆续发生的，若入座时就要求满足下限，第一个人永远进不来）
    const humanCount = this.state.seats.filter(s => s?.kind === "human").length;
    const agentCount = this.state.seats.filter(
      s => s?.kind === "external-agent",
    ).length;
    const composeError = validateSeatComposition({
      policy,
      humanCount,
      agentCount,
      minHumanSeats: this.def.minHumanSeats,
      minAgentSeats: this.def.minAgentSeats,
    });
    if (composeError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: composeError });
    }
    if (policy !== "agent-only" && humanCount === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "房间内至少需要 1 名人类玩家",
      });
    }
    const usedNames = new Set(this.state.seats.map((s) => s?.name));
    const botPool = BOT_NAMES.filter((n) => !usedNames.has(n));
    let bi = 0;
    for (let i = 0; i < this.seatCount; i++) {
      if (!this.state.seats[i]) {
        const name = botPool[bi % botPool.length] ?? `回声-${i}`;
        bi += 1;
        this.state.seats[i] = {
          index: i,
          name,
          kind: "echo-bot",
          seatToken: null,
          userId: null,
          agentKeyId: null,
          score: 0,
        };
      }
    }
    this.state.scores = Object.fromEntries(
      this.state.seats.map((s) => [s!.index, 0]),
    );
    this.state.status = "playing";
    this.state.startedAt = Date.now();

    // 开局：生成种子并起记录器。种子写入事件流，故回放仍可复现
    const seed = newMatchSeed(this.code);
    this.state.seed = seed;
    for (const seat of this.state.seats) {
      if (seat?.kind === "echo-bot") {
        this.botLevels.set(seat.index, botLevel(seed, seat.index));
      }
    }
    this.state.matchLogId = null;
    const book = ruleBookForTemplate(this.def.template);
    this.recorder = new EventRecorder({
      seed,
      rulebookId: book?.id ?? `rb-${this.def.template}`,
      startedAt: this.state.startedAt,
    });
    this.recorder.matchStart(
      this.state.seats
        .filter((s): s is SeatState => s !== null)
        .map(s => ({ index: s.index, name: s.name, kind: s.kind })),
    );

    this.state.matchState =
      this.module.initMatchState?.(this.def, this.seatCount) ?? null;

    this.beginRound(1);
    this.touch();
    return { ok: true };
  }

  private async submitInternal(seat: SeatState, payload: number) {
    if (
      this.state.status !== "playing" ||
      this.state.phase !== "submit" ||
      this.state.submitDeadlineAt === null
    ) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "当前不在提交阶段" });
    }
    if (Date.now() > this.state.submitDeadlineAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "提交窗口已结束" });
    }
    // 分阶段模板（如海盗分金）：只有本子阶段的座位可以提交；
    // 单阶段模板 phaseEligible() 返回全部在场座位，行为与此前完全一致。
    if (!this.phaseEligible().includes(seat.index)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "当前阶段不轮到你行动" });
    }
    if (this.state.submissions.some((e) => e.seat === seat.index)) {
      throw new TRPCError({ code: "CONFLICT", message: "本轮已提交" });
    }
    this.commit(seat.index, payload);
    this.touch();
    if (this.isPhaseComplete()) {
      // 本（子）阶段提前交齐 → 推进（await 使 act 在推进完成后返回，便于客户端/测试同步）
      await this.afterSubmitWindow();
    }
    return { ok: true };
  }

  /**
   * 所有提交的唯一入口——真人、echo-bot、超时兜底都经此，
   * 故事件记录埋在这里最可靠，不会漏掉任何一条动作。
   */
  private commit(seatIndex: number, value: number) {
    if (this.state.submissions.some((e) => e.seat === seatIndex)) return;
    this.state.submissions.push({
      seat: seatIndex,
      value,
      order: this.state.submissions.length,
    });
    this.recorder?.action(seatIndex, this.module.gameKind, value);
  }

  /* ---------------------------------------------------------------- */
  /* 轮次编排（全模板通用：窗口 = def.submitWindowSec）                    */
  /* ---------------------------------------------------------------- */

  /**
   * 当前（子）阶段允许提交的座位号。
   * 单阶段模板（未实现 phasesForRound）返回全部在场座位，
   * 与新增分阶段机制之前的行为完全一致。
   */
  private phaseEligible(): number[] {
    const all = this.state.seats
      .filter((s): s is SeatState => s !== null)
      .map((s) => s.index);
    if (!this.state.subPhases) return all;
    return this.state.subPhases[this.state.subPhaseIdx]?.eligibleSeats ?? all;
  }

  /** 当前（子）阶段是否已交齐（仅看该阶段应交座位，不受累积提交里其它阶段记录干扰） */
  private isPhaseComplete(): boolean {
    const eligible = this.phaseEligible();
    const submitted = new Set(this.state.submissions.map((e) => e.seat));
    return eligible.length > 0 && eligible.every((s) => submitted.has(s));
  }

  private botSubmit(seat: SeatState, remainMs?: number) {
    const delay =
      remainMs != null
        ? Math.max(500, Math.min(remainMs - 1_000, 1_000 + Math.random() * 3_000))
        : 1_000 + Math.random() * 3_000;
    const timer = setTimeout(() => {
      this.botTimers.delete(timer);
      void this.enqueue(() => {
        if (
          this.state.status !== "playing" ||
          this.state.phase !== "submit" ||
          Date.now() > (this.state.submitDeadlineAt ?? 0) ||
          !this.phaseEligible().includes(seat.index) ||
          this.state.submissions.some((e) => e.seat === seat.index)
        ) {
          return;
        }
        const levelK = this.botLevels.get(seat.index) ?? 2.4;
        const phaseName = this.state.subPhases?.[this.state.subPhaseIdx]?.name;
        this.commit(
          seat.index,
          this.module.botPick(
            this.def,
            seat.index,
            levelK,
            this.state.history,
            phaseName,
            this.state.matchState,
            [...this.state.submissions],
          ),
        );
        this.touch();
        if (this.isPhaseComplete()) {
          return this.afterSubmitWindow();
        }
      });
    }, delay);
    this.botTimers.add(timer);
  }

  private beginRound(round: number) {
    this.clearTimers();
    this.state.round = round;
    this.state.submissions = [];
    this.recorder?.roundBegin(round);

    this.state.subPhases = this.module.phasesForRound
      ? this.module.phasesForRound(this.def, round, this.state.matchState)
      : null;
    this.state.subPhaseIdx = 0;

    this.beginSubPhase();
  }

  /** 开启当前（子）阶段的提交窗；单阶段模板视为唯一一个覆盖全部座位的阶段 */
  private beginSubPhase() {
    this.state.phase = "submit";
    this.state.submitDeadlineAt = Date.now() + this.windowMs;

    this.submitTimer = setTimeout(() => {
      this.submitTimer = null;
      void this.enqueue(() => this.afterSubmitWindow());
    }, this.windowMs);

    const eligible = this.phaseEligible();
    // echo-bot 座位：1–4s 随机延迟后提交（仅本阶段应交的 bot）
    for (const seat of this.state.seats) {
      if (seat?.kind !== "echo-bot") continue;
      if (!eligible.includes(seat.index)) continue;
      this.botSubmit(seat);
    }
  }

  /**
   * 提交窗口结束（交齐或超时）：本（子）阶段超时未交者由模板兜底 →
   * 若还有下一子阶段则直接推进（提交跨子阶段累积，不清空）；
   * 否则本轮全部子阶段已完成 → 正式揭晓。
   * 单阶段模板只有一个隐式子阶段，此函数等价于此前的 revealRound 入口。
   */
  private async afterSubmitWindow() {
    if (this.state.status !== "playing" || this.state.phase !== "submit") {
      return;
    }
    if (this.submitTimer) {
      clearTimeout(this.submitTimer);
      this.submitTimer = null;
    }
    for (const t of this.botTimers) clearTimeout(t);
    this.botTimers.clear();

    // 本（子）阶段超时兜底：仅对本阶段应交座位
    for (const seatIndex of this.phaseEligible()) {
      if (!this.state.submissions.some((e) => e.seat === seatIndex)) {
        this.commit(seatIndex, this.module.timeoutFallback(this.def, seatIndex));
      }
    }
    this.touch();

    if (
      this.state.subPhases &&
      this.state.subPhaseIdx < this.state.subPhases.length - 1
    ) {
      this.state.subPhaseIdx += 1;
      this.beginSubPhase();
      this.touch();
      return;
    }

    return this.revealRound();
  }

  /** 结算本轮：模板揭晓/计分 → 5s 后下一轮或终局 */
  private async revealRound() {
    const entries = [...this.state.submissions].sort(
      (a, b) => a.order - b.order,
    );
    const { reveal, scoreDeltas, finished } = this.module.resolveRound(
      this.def,
      this.state.round,
      entries,
      this.state.matchState,
    );
    for (const [seat, delta] of Object.entries(scoreDeltas)) {
      const i = Number(seat);
      this.state.scores[i] = (this.state.scores[i] ?? 0) + delta;
    }

    this.state.lastReveal = reveal;
    this.state.history.push(reveal);
    this.state.phase = "reveal";
    this.state.submitDeadlineAt = null;
    this.state.subPhases = null;
    this.state.subPhaseIdx = 0;
    this.recorder?.reveal(reveal, this.module.roundWinners(reveal));
    this.touch();

    if (finished || this.state.round >= this.totalRounds) {
      return this.finish();
    }
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      void this.enqueue(() => {
        this.beginRound(this.state.round + 1);
        this.touch();
      });
    }, REVEAL_MS);
  }

  /* ---------------------------------------------------------------- */
  /* 终局与通用结算                                                      */
  /* ---------------------------------------------------------------- */
  private async finish() {
    this.state.status = "finished";
    this.state.phase = null;
    this.state.rankings = this.computeRankings();
    this.state.winner = this.state.rankings[0] ?? null;
    this.touch();
    await this.settleRewards();
    // 事件流落库 + 彩蛋判定，须在发奖后——彩蛋读的 fragmentsDelta 由发奖决定
    await this.persistMatchLog();
    if (!this.def.isOfficial) {
      await incrementGameDefPlays(this.def.id).catch((err) =>
        console.error(`[sdkRoom] plays++ ${this.def.id} failed`, err),
      );
    }
  }

  /**
   * 终局落库：写 match_logs → 判彩蛋 → 发卡。
   *
   * 【失败不影响对局】胜负与碎片在 settleRewards 已经结算完毕，
   * 落库只是留痕。故全程 catch 兜住——数据库抖动不该让玩家的一局白打。
   */
  private async persistMatchLog(): Promise<void> {
    const rec = this.recorder;
    if (!rec) return;

    // 碎片净收益：仅 human 席有账（bot 与外部 Agent 不入 traveler_profiles）
    const fragmentsDelta: Record<number, number> = {};
    const fee = this.def.entryFee.amount;
    for (const seat of this.state.seats) {
      if (!seat) continue;
      const rank = (this.state.rankings ?? []).indexOf(seat.index);
      const gross =
        rank === 0
          ? this.def.rewards.winner
          : rank === 1
            ? this.def.rewards.runnerUp
            : this.def.rewards.participation;
      fragmentsDelta[seat.index] = gross - fee;
    }

    rec.matchEnd({
      rankings: this.state.rankings ?? [],
      winnerSeat: this.state.winner,
      fragmentsDelta,
    });

    try {
      const logId = await insertMatchLog({
        roomCode: this.code,
        rulebookId: rec.rulebookId,
        seed: rec.seed,
        events: [...rec.all],
        startedAt: rec.startedAt,
        endedAt: Date.now(),
        winnerSeat: this.state.winner,
      });
      this.state.matchLogId = logId;
      this.touch();
    } catch (err) {
      console.error(`[sdkRoom] ${this.code} 事件流落库失败`, err);
      return; // 落库失败则不发卡：卡牌应可溯源到具体一局
    }

    await this.grantEggCards(rec);
  }

  /**
   * 彩蛋判定与发卡。
   *
   * 判定在全知事件流上做（服务端时机，可读密态事件）。
   * 只给 human 席发卡——bot 无账户，外部 Agent 的奖励走其所属 userId，
   * 但卡牌是给「人」的收藏，故此处只认真人席。
   */
  private async grantEggCards(rec: EventRecorder): Promise<void> {
    let hits;
    try {
      hits = detectEggs([...rec.all]);
    } catch (err) {
      console.error(`[sdkRoom] ${this.code} 彩蛋判定失败`, err);
      return;
    }
    if (hits.length === 0) return;

    for (const hit of hits) {
      const seat = this.state.seats[hit.seat];
      if (seat?.kind !== "human" || !seat.userId) continue;
      await grantCard({
        userId: seat.userId,
        cardId: hit.cardId,
        kind: "relic",
        source: "egg",
      }).catch(err =>
        console.error(`[sdkRoom] 发卡失败 ${hit.cardId}`, err),
      );
    }
  }

  private computeRankings(): number[] {
    const roundWins = new Map<number, number>();
    for (const r of this.state.history) {
      for (const seat of this.module.roundWinners(r)) {
        roundWins.set(seat, (roundWins.get(seat) ?? 0) + 1);
      }
    }
    return this.state.seats
      .filter((s): s is SeatState => s !== null)
      .map((s) => s.index)
      .sort(
        (a, b) =>
          (this.state.scores[b] ?? 0) - (this.state.scores[a] ?? 0) ||
          (roundWins.get(b) ?? 0) - (roundWins.get(a) ?? 0) ||
          a - b,
      );
  }

  /**
   * finished 后仅结算一次：authed 人类席位按 def.rewards 名次奖励 −
   * def.entryFee.amount 门票的净值入 traveler_profiles（花色 = entryFee.suit）。
   * 事务/幂等模式沿用 v3（settled 标记 + GREATEST 非负兜底）。
   */
  private async settleRewards() {
    if (this.state.settled) return;
    this.state.settled = true;
    const rankings = this.state.rankings ?? [];
    const { rewards, entryFee } = this.def;
    const jobs: Promise<unknown>[] = [];
    for (const seat of this.state.seats) {
      if (!seat || seat.kind !== "human" || seat.userId == null) continue;
      const rank = rankings.indexOf(seat.index);
      const reward =
        rank === 0
          ? rewards.winner
          : rank === 1
            ? rewards.runnerUp
            : rewards.participation;
      const delta = reward - entryFee.amount;
      jobs.push(
        awardGameResult(seat.userId, {
          suit: entryFee.suit,
          delta,
          won: rank === 0,
          recordKey: this.module.recordKey,
        }).catch((err) =>
          console.error(`[sdkRoom] settle ${this.code} failed`, err),
        ),
      );
    }
    await Promise.all(jobs);
  }

  /** 进程重启后从 stateJson 恢复时重建 timers */
  resumeTimers() {
    if (this.state.status !== "playing") return;
    for (const seat of this.state.seats) {
      if (seat?.kind === "echo-bot") {
        this.botLevels.set(
          seat.index,
          botLevel(this.state.seed ?? this.code, seat.index),
        );
      }
    }
    if (this.state.phase === "submit") {
      const remain = (this.state.submitDeadlineAt ?? 0) - Date.now();
      // 恢复进程丢失的 bot：在剩余窗口内补提交
      for (const seat of this.state.seats) {
        if (seat?.kind !== "echo-bot") continue;
        if (this.state.submissions.some((e) => e.seat === seat.index)) continue;
        this.botSubmit(seat, Math.max(1_500, remain));
      }
      this.submitTimer = setTimeout(
        () => {
          this.submitTimer = null;
          void this.enqueue(() => this.afterSubmitWindow());
        },
        Math.max(0, remain),
      );
    } else if (this.state.phase === "reveal") {
      this.revealTimer = setTimeout(() => {
        this.revealTimer = null;
        void this.enqueue(() => {
          this.beginRound(this.state.round + 1);
          this.touch();
        });
      }, REVEAL_MS);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 脱敏视图（全模板通用；pollDuel 附 choices + PollReveal）             */
  /* ---------------------------------------------------------------- */
  view(seatToken?: string): GameRoomView {
    const me = seatToken
      ? (this.state.seats.find((s) => s && s.seatToken === seatToken) ?? null)
      : null;
    const choices =
      this.def.template === "pollDuel" ? this.def.params.choices : null;
    const base: GuessRoomView = {
      code: this.code,
      roomName: this.roomName,
      status: this.state.status,
      defId: this.def.id,
      template: this.def.template,
      gameName: this.def.name,
      submitWindowSec: this.def.submitWindowSec,
      entryFee: this.def.entryFee,
      rewards: this.def.rewards,
      choices,
      round: this.state.round,
      totalRounds: this.totalRounds,
      phase: this.state.status === "playing" ? this.state.phase : null,
      seats: this.state.seats
        .filter((s): s is SeatState => s !== null)
        .map((s) => ({
          index: s.index,
          name: s.name,
          kind: s.kind,
          submitted: this.state.submissions.some((e) => e.seat === s.index),
          score: this.state.scores[s.index] ?? 0,
          gone: false,
        })),
      lastReveal: this.state.lastReveal as GuessRoomView["lastReveal"],
      history: this.state.history as GuessRoomView["history"],
      mySeat: me ? me.index : null,
      winner: this.state.winner,
      rankings: this.state.rankings,
      submitDeadlineAt:
        this.state.status === "playing" && this.state.phase === "submit"
          ? this.state.submitDeadlineAt
          : null,
      submittedCount: this.state.submissions.length,
      serverNow: Date.now(),
    };
    if (this.def.template === "pollDuel") {
      return {
        ...base,
        lastReveal: this.state.lastReveal as PollReveal | null,
        history: this.state.history as PollReveal[],
        choices: choices ?? [],
      };
    }
    if (this.def.template === "pirateGold") {
      const pending =
        this.state.status === "playing" && this.module.describePending
          ? this.module.describePending(
              this.def,
              this.state.matchState,
              this.state.submissions,
            )
          : null;
      return {
        ...base,
        lastReveal: this.state.lastReveal as PirateGoldReveal | null,
        history: this.state.history as PirateGoldReveal[],
        coins: (this.def.params as PirateGoldParams).coins,
        aliveSeats: (this.state.matchState as { alive?: boolean[] } | null)?.alive
          ? (this.state.matchState as { alive: boolean[] }).alive
              .map((a, i) => (a ? i : -1))
              .filter((i) => i >= 0)
          : this.state.seats
              .filter((s): s is SeatState => s !== null)
              .map((s) => s.index),
        currentProposer:
          this.state.status === "playing"
            ? ((this.state.matchState as { proposer?: number } | null)?.proposer ?? null)
            : null,
        pending: pending as PirateGoldPending | null,
      };
    }
    if (this.def.template === "flyTease") {
      const params = this.def.params as FlyTeaseParams;
      const currentRound = Math.max(1, this.state.round);
      return {
        ...base,
        lastReveal: this.state.lastReveal as FlyTeaseReveal | null,
        choices: null,
        fly: {
          fickleness: params.fickleness,
          crowding: params.crowding,
          rageThreshold: params.rageThreshold,
          scoreWin: params.scoreWin,
          mood: cricketMoodFor(this.def.id, currentRound, params.fickleness),
          engine: FLY_ATLAS.engine,
          cardCount: FLY_ATLAS.cards.length,
          atlasVersion: FLY_ATLAS.version,
        },
      };
    }
    return base;
  }

  /** seatToken → 座位（gateway 校验 key 绑定用） */
  seatByToken(seatToken: string) {
    return (
      this.state.seats.find((s) => s && s.seatToken === seatToken) ?? null
    );
  }

  hasAgentSeat(): boolean {
    return this.state.seats.some((s) => s?.kind === "external-agent");
  }

  seatsTaken(): number {
    return this.state.seats.filter(Boolean).length;
  }

  get status(): RoomStatus {
    return this.state.status;
  }

  getState(): SdkRoomState {
    return this.state;
  }

  /** 测试辅助：排空内部队列 */
  async drain() {
    await this.queue;
  }
}

/**
 * ============================================================================
 * pirateGold 模板执行器（api/games/sdk/pirateGold.ts）——海盗分金谈判博弈
 * ----------------------------------------------------------------------------
 * 序号最小的存活者提出金币分配方案 → 全体存活者表决（含提案人自己，
 * 赞成 ≥ 半数即通过）→ 通过则终局，分配即最终得分；否则提案人出局、
 * 提案权移交下一位存活者；仅剩一人时自动通过、独得全部金币。
 *
 * 本模板是 SDK 里第一个使用 phasesForRound 的模板：一轮拆成
 * 「propose（仅提案人）→ vote（其余存活者，可见提案后表决）」两个子阶段，
 * 使表决者能看到提案内容再决策——这是海盗分金相对「同时密封提交」
 * 通用模型的关键差异，详见 templates.ts 对 phasesForRound 的说明。
 * ============================================================================
 */
import { TRPCError } from "@trpc/server";
import type { GameAction } from "@contracts/room";
import type {
  GameDefinition,
  PirateGoldParams,
  PirateGoldPending,
  PirateGoldReveal,
} from "@contracts/gameSdk";
import type { RoundEntry, TemplateModule } from "./templates";

/** 提案编码相对投票（0/1）的偏移量，用于从单个 number 里区分"这是提案还是投票" */
const PROPOSAL_OFFSET = 1_000_000_000;

export interface PirateMatchState {
  /** 座位号 → 是否存活（出局者恒 false） */
  alive: boolean[];
  /** 当前提案人座位号 */
  proposer: number;
  /** 待分配金币总数（从 def.params.coins 复制一份，避免到处强转） */
  coins: number;
}

function aliveSeats(st: PirateMatchState): number[] {
  return st.alive.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
}

/** 分配方案（长度=seats，每项非负整数、总和=coins）编码进单个安全整数 */
function encodeAllocation(alloc: number[], coins: number): number {
  const base = coins + 1;
  let packed = 0;
  for (let i = alloc.length - 1; i >= 0; i--) {
    packed = packed * base + alloc[i];
  }
  return PROPOSAL_OFFSET + packed;
}

function decodeAllocation(value: number, seats: number, coins: number): number[] {
  const base = coins + 1;
  let packed = value - PROPOSAL_OFFSET;
  const alloc: number[] = [];
  for (let i = 0; i < seats; i++) {
    alloc.push(packed % base);
    packed = Math.floor(packed / base);
  }
  return alloc;
}

function isEncodedProposal(value: number): boolean {
  return value >= PROPOSAL_OFFSET;
}

export const pirateGoldModule: TemplateModule = {
  template: "pirateGold",
  gameKind: "pirate",
  recordKey: "pirate",

  initMatchState(def: GameDefinition, seatCount: number): PirateMatchState {
    const p = def.params as PirateGoldParams;
    return {
      alive: new Array(seatCount).fill(true),
      proposer: 0,
      coins: p.coins,
    };
  },

  /**
   * 一轮 = 一次提案周期，拆两个子阶段：
   * propose（仅当前提案人）→ vote（其余存活者；仅剩提案人一人存活时跳过投票）。
   */
  phasesForRound(_def: GameDefinition, _round: number, matchState: unknown) {
    const st = matchState as PirateMatchState;
    const alive = aliveSeats(st);
    const voters = alive.filter((s) => s !== st.proposer);
    const phases: { name: string; eligibleSeats: number[] }[] = [
      { name: "propose", eligibleSeats: [st.proposer] },
    ];
    if (voters.length > 0) {
      phases.push({ name: "vote", eligibleSeats: voters });
    }
    return phases;
  },

  normalizeSubmission(def: GameDefinition, action: GameAction): number | null {
    const p = def.params as PirateGoldParams;
    if (action.type === "propose") {
      const alloc = action.allocation;
      if (!Array.isArray(alloc) || alloc.length !== def.seats) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `分配方案长度须等于席位数 ${def.seats}`,
        });
      }
      if (alloc.some((n) => !Number.isInteger(n) || n < 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "分配方案每项须为非负整数",
        });
      }
      if (alloc.reduce((a, b) => a + b, 0) !== p.coins) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `分配方案总额须等于金币总数 ${p.coins}`,
        });
      }
      return encodeAllocation(alloc, p.coins);
    }
    if (action.type === "vote") {
      return action.approve ? 1 : 0;
    }
    return null;
  },

  /** 超时兜底：0 既是"反对票"，也因不足 PROPOSAL_OFFSET 而被判定为"未提案"，两种角色下语义都合规 */
  timeoutFallback(): number {
    return 0;
  },

  botPick(
    def: GameDefinition,
    seatIndex: number,
    _levelK: number,
    history,
    phaseName,
    matchState,
    entries = [],
  ): number {
    const st = (matchState as PirateMatchState | null) ?? deriveState(def, history as PirateGoldReveal[]);
    if (phaseName === "propose" || seatIndex === st.proposer) {
      const alive = aliveSeats(st);
      const others = alive.filter((s) => s !== seatIndex);
      // 经典"最小行贿"策略：只需买通刚好过半的票（含自己），每人给 1 金币，自己独吞剩余
      const needExtra = Math.max(0, Math.ceil(alive.length / 2) - 1);
      const alloc = new Array(def.seats).fill(0);
      let remaining = st.coins;
      for (let i = 0; i < needExtra && i < others.length; i++) {
        alloc[others[i]] = 1;
        remaining -= 1;
      }
      alloc[seatIndex] = Math.max(0, remaining);
      return encodeAllocation(alloc, st.coins);
    }
    // 投票必须读取当前已提交的提案。这样 Agent 的投票是可解释、可回放的：
    // 给到金币就接受，零分配就拒绝；观众能看到“行贿→结盟”的因果链。
    const proposal = entries.find(
      (entry) => entry.seat === st.proposer && isEncodedProposal(entry.value),
    );
    if (!proposal) return 0;
    const allocation = decodeAllocation(proposal.value, def.seats, st.coins);
    return (allocation[seatIndex] ?? 0) > 0 ? 1 : 0;
  },

  resolveRound(def, round, entries, matchState) {
    const st = matchState as PirateMatchState;
    const p = def.params as PirateGoldParams;
    const alive = aliveSeats(st);
    const proposerEntry = entries.find((e: RoundEntry) => e.seat === st.proposer);
    const validProposal =
      proposerEntry != null && isEncodedProposal(proposerEntry.value);
    const allocation = validProposal
      ? decodeAllocation(proposerEntry!.value, def.seats, st.coins)
      : new Array(def.seats).fill(0);

    const votes: Record<number, boolean> = { [st.proposer]: true };
    let yes = 1; // 提案人视为自动赞成
    for (const seat of alive) {
      if (seat === st.proposer) continue;
      const e = entries.find((x: RoundEntry) => x.seat === seat);
      const approve = e?.value === 1;
      votes[seat] = approve;
      if (approve) yes++;
    }
    const need = Math.ceil(alive.length / 2);
    const passed = validProposal && (alive.length === 1 || yes >= need);

    const reveal: PirateGoldReveal = {
      round,
      proposer: st.proposer,
      allocation,
      votes,
      passed,
      aliveBefore: alive,
    };

    if (passed) {
      const scoreDeltas: Record<number, number> = {};
      for (const seat of alive) scoreDeltas[seat] = allocation[seat] ?? 0;
      return { reveal, scoreDeltas, finished: true };
    }

    // 方案未通过：提案人出局，提案权移交下一位存活者
    st.alive[st.proposer] = false;
    const remaining = aliveSeats(st);
    if (remaining.length === 1) {
      const finalAlloc = new Array(def.seats).fill(0);
      finalAlloc[remaining[0]] = p.coins;
      return {
        reveal: { ...reveal, allocation: finalAlloc, passed: true },
        scoreDeltas: { [remaining[0]]: p.coins },
        finished: true,
      };
    }
    st.proposer = remaining[0];
    return { reveal, scoreDeltas: {} };
  },

  /** 表决进行中：把已交的提案解出来给投票者看（不透露票内容，只提示谁已投） */
  describePending(def, matchState, entries): PirateGoldPending | null {
    const st = matchState as PirateMatchState | null;
    if (!st) return null;
    const proposerEntry = entries.find((e) => e.seat === st.proposer);
    if (!proposerEntry || !isEncodedProposal(proposerEntry.value)) return null;
    const allocation = decodeAllocation(proposerEntry.value, def.seats, st.coins);
    const voted = entries
      .filter((e) => e.seat !== st.proposer)
      .map((e) => e.seat);
    return { proposer: st.proposer, allocation, voted };
  },

  roundWinners(reveal: unknown): number[] {
    const r = reveal as PirateGoldReveal;
    if (!r.passed) return [];
    return r.allocation
      .map((coins, seat) => ({ coins, seat }))
      .filter((x) => x.coins > 0)
      .map((x) => x.seat);
  },
};

/** 从历史揭晓记录重演出「当前存活集合 + 当前提案人」，供 bot 决策使用（bot 拿不到 matchState） */
function deriveState(def: GameDefinition, history: PirateGoldReveal[]): PirateMatchState {
  const p = def.params as PirateGoldParams;
  const st: PirateMatchState = {
    alive: new Array(def.seats).fill(true),
    proposer: 0,
    coins: p.coins,
  };
  for (const r of history) {
    if (r.passed) continue; // 通过即终局，不会再有后续历史
    st.alive[r.proposer] = false;
    const remaining = aliveSeats(st);
    if (remaining.length > 0) st.proposer = remaining[0];
  }
  return st;
}

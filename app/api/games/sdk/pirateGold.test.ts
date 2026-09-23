/**
 * pirateGold 模板执行器单测（api/games/sdk/pirateGold.test.ts）
 *
 * 纯逻辑测试，无需数据库：覆盖提案编解码、表决通过/否决、
 * 提案权移交、仅剩一人自动通过、超时兜底与中途可见提案。
 */
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import type { GameDefinition } from "@contracts/gameSdk";
import type { RoundEntry } from "./templates";
import { pirateGoldModule, type PirateMatchState } from "./pirateGold";

const DEF: GameDefinition = {
  id: "test-pirate",
  name: "测试局",
  template: "pirateGold",
  seats: 4,
  isOfficial: false,
  entryFee: { suit: "diamond", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 30,
  params: { rounds: 5, coins: 12 },
};

function entry(seat: number, value: number, order: number): RoundEntry {
  return { seat, value, order };
}

describe("initMatchState", () => {
  it("全员存活、0 号先提案", () => {
    const st = pirateGoldModule.initMatchState!(DEF, 4) as PirateMatchState;
    expect(st.alive).toEqual([true, true, true, true]);
    expect(st.proposer).toBe(0);
    expect(st.coins).toBe(12);
  });
});

describe("phasesForRound", () => {
  it("多人存活时拆 propose + vote 两阶段", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const phases = pirateGoldModule.phasesForRound!(DEF, 1, st);
    expect(phases).toEqual([
      { name: "propose", eligibleSeats: [0] },
      { name: "vote", eligibleSeats: [1, 2, 3] },
    ]);
  });

  it("仅提案人一人存活时不生成 vote 阶段", () => {
    const st: PirateMatchState = { alive: [true, false, false, false], proposer: 0, coins: 12 };
    const phases = pirateGoldModule.phasesForRound!(DEF, 1, st);
    expect(phases).toEqual([{ name: "propose", eligibleSeats: [0] }]);
  });
});

describe("normalizeSubmission", () => {
  it("合法提案编码为 >= 1e9 的整数，且可与 resolveRound 解码往返一致", () => {
    const value = pirateGoldModule.normalizeSubmission(DEF, {
      type: "propose",
      allocation: [12, 0, 0, 0],
    });
    expect(value).not.toBeNull();
    expect(value as number).toBeGreaterThanOrEqual(1_000_000_000);
  });

  it("投票编码为 0/1", () => {
    expect(
      pirateGoldModule.normalizeSubmission(DEF, { type: "vote", approve: true }),
    ).toBe(1);
    expect(
      pirateGoldModule.normalizeSubmission(DEF, { type: "vote", approve: false }),
    ).toBe(0);
  });

  it("其它动作类型返回 null（不支持）", () => {
    expect(pirateGoldModule.normalizeSubmission(DEF, { type: "start" })).toBeNull();
  });

  it("分配长度不等于席位数则拒绝", () => {
    expect(() =>
      pirateGoldModule.normalizeSubmission(DEF, {
        type: "propose",
        allocation: [12, 0, 0],
      }),
    ).toThrow(TRPCError);
  });

  it("分配含负数则拒绝", () => {
    expect(() =>
      pirateGoldModule.normalizeSubmission(DEF, {
        type: "propose",
        allocation: [13, -1, 0, 0],
      }),
    ).toThrow(TRPCError);
  });

  it("分配总额不等于金币总数则拒绝", () => {
    expect(() =>
      pirateGoldModule.normalizeSubmission(DEF, {
        type: "propose",
        allocation: [5, 5, 0, 0],
      }),
    ).toThrow(TRPCError);
  });
});

describe("resolveRound：方案通过", () => {
  it("赞成票达半数（含提案人）即通过，得分=分配数额，终局", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const proposeVal = pirateGoldModule.normalizeSubmission(DEF, {
      type: "propose",
      allocation: [10, 2, 0, 0],
    }) as number;
    const entries = [
      entry(0, proposeVal, 0),
      entry(1, 1, 1), // 赞成 → 达到 need=2（含提案人）
      entry(2, 0, 2),
      entry(3, 0, 3),
    ];
    const { reveal, scoreDeltas, finished } = pirateGoldModule.resolveRound(
      DEF,
      1,
      entries,
      st,
    );
    const r = reveal as { passed: boolean; allocation: number[] };
    expect(r.passed).toBe(true);
    expect(r.allocation).toEqual([10, 2, 0, 0]);
    expect(scoreDeltas).toEqual({ 0: 10, 1: 2, 2: 0, 3: 0 });
    expect(finished).toBe(true);
  });
});

describe("resolveRound：方案否决 → 提案人出局、提案权移交", () => {
  it("赞成不足半数则否决，提案人出局，下一存活者接任提案人", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const proposeVal = pirateGoldModule.normalizeSubmission(DEF, {
      type: "propose",
      allocation: [12, 0, 0, 0],
    }) as number;
    const entries = [
      entry(0, proposeVal, 0),
      entry(1, 0, 1), // 反对
      entry(2, 0, 2), // 反对
      entry(3, 0, 3), // 反对
    ];
    const { reveal, scoreDeltas, finished } = pirateGoldModule.resolveRound(
      DEF,
      1,
      entries,
      st,
    );
    const r = reveal as { passed: boolean };
    expect(r.passed).toBe(false);
    expect(scoreDeltas).toEqual({});
    expect(finished).toBeUndefined();
    expect(st.alive[0]).toBe(false);
    expect(st.proposer).toBe(1);
  });

  it("未在提案子阶段提交（超时兜底值 0）视为无效提案，直接否决出局", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const entries = [
      entry(0, 0, 0), // timeoutFallback 兜底值
      entry(1, 1, 1),
      entry(2, 1, 2),
      entry(3, 0, 3),
    ];
    const { reveal } = pirateGoldModule.resolveRound(DEF, 1, entries, st);
    expect((reveal as { passed: boolean }).passed).toBe(false);
    expect(st.alive[0]).toBe(false);
  });
});

describe("resolveRound：仅剩一人自动通过、独得全部金币", () => {
  it("2 人存活时提案被拒 → 提案人出局 → 仅剩一人自动通过", () => {
    // 座位 1、2 存活，1 为提案人；提案人超时未提案（无效提案）→ 否决 → 1 出局 → 仅剩 2 自动通过
    const st: PirateMatchState = { alive: [false, true, true, false], proposer: 1, coins: 12 };
    const entries = [entry(1, 0, 0), entry(2, 0, 1)];
    const { reveal, scoreDeltas, finished } = pirateGoldModule.resolveRound(
      DEF,
      2,
      entries,
      st,
    );
    const r = reveal as { passed: boolean; allocation: number[] };
    expect(r.passed).toBe(true);
    expect(r.allocation).toEqual([0, 0, 12, 0]);
    expect(scoreDeltas).toEqual({ 2: 12 });
    expect(finished).toBe(true);
  });
});

describe("timeoutFallback", () => {
  it("恒返回 0（作为提案视为未交，作为投票视为反对）", () => {
    expect(pirateGoldModule.timeoutFallback(DEF, 0)).toBe(0);
    expect(pirateGoldModule.timeoutFallback(DEF, 3)).toBe(0);
  });
});

describe("roundWinners", () => {
  it("通过时返回分得金币的座位，否决时返回空", () => {
    expect(
      pirateGoldModule.roundWinners({ passed: true, allocation: [10, 2, 0, 0] }),
    ).toEqual([0, 1]);
    expect(
      pirateGoldModule.roundWinners({ passed: false, allocation: [0, 0, 0, 0] }),
    ).toEqual([]);
  });
});

describe("describePending", () => {
  it("提案已交、表决进行中：解出提案 + 已投票座位（不透露票内容）", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const proposeVal = pirateGoldModule.normalizeSubmission(DEF, {
      type: "propose",
      allocation: [8, 4, 0, 0],
    }) as number;
    const entries = [entry(0, proposeVal, 0), entry(1, 1, 1)];
    const pending = pirateGoldModule.describePending!(DEF, st, entries);
    expect(pending).toEqual({ proposer: 0, allocation: [8, 4, 0, 0], voted: [1] });
  });

  it("提案未交时返回 null", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    expect(pirateGoldModule.describePending!(DEF, st, [])).toBeNull();
  });
});

describe("botPick：表决读取当前提案", () => {
  it("给到金币时赞成，零分配时反对，重复调用结果一致", () => {
    const st: PirateMatchState = { alive: [true, true, true, true], proposer: 0, coins: 12 };
    const proposal = pirateGoldModule.normalizeSubmission(DEF, {
      type: "propose",
      allocation: [10, 2, 0, 0],
    }) as number;
    const entries = [entry(0, proposal, 0)];
    expect(pirateGoldModule.botPick(DEF, 1, 2.4, [], "vote", st, entries)).toBe(1);
    expect(pirateGoldModule.botPick(DEF, 2, 2.4, [], "vote", st, entries)).toBe(0);
    expect(pirateGoldModule.botPick(DEF, 1, 2.4, [], "vote", st, entries)).toBe(1);
  });
});

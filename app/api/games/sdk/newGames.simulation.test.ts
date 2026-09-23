/**
 * ============================================================================
 * 千轮猜数 / 海盗分金 —— 纯内存模拟测试（api/games/sdk/newGames.simulation.test.ts）
 * ----------------------------------------------------------------------------
 * 不依赖真实 MySQL：直接调用 registry.createSdkRoom 在内存里建房，
 * 用 vitest 假时钟把提交窗/结算延迟"瞬间"推完整局，驱动到 finished，
 * 打印出完整的模拟数据（每轮揭晓、最终名次、分数）供人工核验规则是否符合预期。
 *
 * 运行：npx vitest run api/games/sdk/newGames.simulation.test.ts
 * ============================================================================
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuessReveal } from "@contracts/room";
import type { PirateGoldParams, PirateGoldReveal } from "@contracts/gameSdk";

/**
 * 本模拟测试不依赖真实 MySQL：把 runtime.ts 用到的落库调用全部换成瞬时 no-op，
 * 只关心内存里的游戏状态机是否正确推进——落库正确性已由 sdk.smoke.test.ts（真库）覆盖。
 */
vi.mock("../../queries/rooms", () => ({
  persistRoomState: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../queries/profiles", () => ({
  awardGameResult: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../queries/gameDefs", () => ({
  incrementGameDefPlays: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../queries/matchLogs", () => ({
  insertMatchLog: vi.fn().mockResolvedValue(1),
}));
vi.mock("../../queries/playerCards", () => ({
  grantCard: vi.fn().mockResolvedValue(undefined),
}));

const { createSdkRoom, GUESS_MILLE_CORE, PIRATE_GOLD_CORE } = await import(
  "./registry"
);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** 反复推进假时钟直到房间 finished 或超过安全步数（避免死循环挂死测试） */
async function runToFinish(
  getStatus: () => string,
  stepMs: number,
  maxSteps: number,
  debug?: () => void,
) {
  for (let i = 0; i < maxSteps; i++) {
    if (getStatus() === "finished") return;
    await vi.advanceTimersByTimeAsync(stepMs);
    debug?.();
  }
}

describe("千轮猜数（GUESS_MILLE_CORE）内存模拟", () => {
  it("agent-only 6 席跑完 200 轮并收敛", async () => {
    const { room, seatToken } = await createSdkRoom({
      def: GUESS_MILLE_CORE,
      roomName: "模拟-千轮猜数",
      createdByUserId: null,
      creatorName: "模拟房主",
    });
    // agent-only：createSdkRoom 不会自动入座，需先以 Agent 身份落座 0 号席
    expect(seatToken).toBeNull();
    const joined = await room.joinAsAgent({ id: 1, name: "模拟Agent-0" });
    await room.act(joined.seatToken, { type: "start" });

    // 每轮最坏情况 = submitWindowSec(10s 超时) + REVEAL_MS(5s 揭晓间隔) ≈ 15s/轮，200 轮留足余量
    await runToFinish(() => room.getState().status, 15_000, 210);

    const state = room.getState();
    expect(state.status).toBe("finished");
    expect(state.history).toHaveLength(200);

    const history = state.history as GuessReveal[];
    const first10 = history.slice(0, 10).map((r) => r.average);
    const last10 = history.slice(-10).map((r) => r.average);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    console.log("\n[千轮猜数] 模拟结果");
    console.log("  最终名次(座位号，高→低):", state.rankings);
    console.log("  最终分数:", state.scores);
    console.log("  前10轮均值样本:", first10.map((x) => x.toFixed(2)));
    console.log("  后10轮均值样本:", last10.map((x) => x.toFixed(2)));
    console.log(
      `  前10轮均值的均值=${avg(first10).toFixed(2)} → 后10轮均值的均值=${avg(last10).toFixed(2)}`,
    );
    console.log("  末轮揭晓:", JSON.stringify(history[history.length - 1]));

    // 收敛性弱校验：200 轮 2/3 猜均值博弈下，后期均值应比初期更贴近理论收敛点（0附近）
    expect(Math.abs(avg(last10))).toBeLessThanOrEqual(Math.abs(avg(first10)) + 5);
  }, 30_000);
});

describe("海盗分金（PIRATE_GOLD_CORE）内存模拟", () => {
  it("mixed-required 5 席跑到终局并正确分配金币", async () => {
    const { room, code } = await createSdkRoom({
      def: PIRATE_GOLD_CORE,
      roomName: "模拟-海盗分金",
      createdByUserId: 42,
      creatorName: "模拟船长",
    });
    expect(code).toHaveLength(6);
    const roomState0 = room.getState();
    // mixed-required：创建者以人类身份占 0 号席；还需至少 1 个 Agent 才能开局
    const humanSeat = roomState0.seats.find((s) => s?.kind === "human")!;
    const joinedAgent = await room.joinAsAgent({ id: 2, name: "模拟Agent-海盗" });
    const rejoinedAgent = await room.joinAsAgent({ id: 2, name: "模拟Agent-海盗" });
    expect(rejoinedAgent.seatIndex).toBe(joinedAgent.seatIndex);
    expect(rejoinedAgent.seatToken).toBe(joinedAgent.seatToken);
    await room.act(humanSeat.seatToken!, { type: "start" });

    await runToFinish(() => room.getState().status, 40_000, 30);

    const state = room.getState();
    expect(state.status).toBe("finished");

    const history = state.history as PirateGoldReveal[];
    const coins = (PIRATE_GOLD_CORE.params as PirateGoldParams).coins;
    const finalReveal = history[history.length - 1];

    console.log("\n[海盗分金] 模拟结果");
    console.log("  座位数:", state.seats.filter(Boolean).length, "· 金币总数:", coins);
    console.log("  每轮揭晓（提案人/是否通过/分配）:");
    history.forEach((r) =>
      console.log(
        `    第${r.round}轮 提案人=${r.proposer} 通过=${r.passed} 分配=${JSON.stringify(r.allocation)}`,
      ),
    );
    console.log("  最终名次:", state.rankings);
    console.log("  最终分数(=各座位所得金币):", state.scores);

    // 规则校验：终局那一轮必然通过（提案通过或仅剩一人自动通过独得全部）
    expect(finalReveal.passed).toBe(true);
    // 金币总量守恒：仅"通过"的分配方案总额须等于金币总数（未通过/超时轮 allocation 恒为全 0，属正常兜底）
    for (const r of history) {
      if (r.passed) {
        expect(r.allocation.reduce((a, b) => a + b, 0)).toBe(coins);
      }
    }
    // 最终得分总和 = 金币总数（一次性分完，不会多不会少）
    const totalScore = Object.values(state.scores).reduce((a, b) => a + b, 0);
    expect(totalScore).toBe(coins);
    expect(joinedAgent.seatIndex).toBeGreaterThanOrEqual(0);
  }, 30_000);
});

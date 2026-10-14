/**
 * 官方新游戏的房间级 smoke：验证 TemplateModule 不只是能单轮 reducer，
 * 而是能经过 SdkRoom 的入座、echo-bot、计时、跨轮状态和终局链路。
 * 数据库副作用全部替换为 no-op；真实数据库读写由 sdk.smoke.test 覆盖。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  hasCard: vi.fn().mockResolvedValue(false),
}));

const {
  createSdkRoom,
  GUESS_CORE,
  GUESS_MILLE_CORE,
  GUESS_DARK_CORE,
  POLL_DUEL_CORE,
  POLL_DARK_CORE,
  PIRATE_GOLD_CORE,
  FLYTEASE_CORE,
  FLYTEASE_DARK_CORE,
  SUPERPOWER_BILLIARDS_CORE,
  SUPERPOWER_RACE_CORE,
  WEREWOLF_12_CORE,
} = await import("./registry");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("官方游戏房间级 smoke", () => {
  it("超能力赛马能按定义读取 48 格赛道并跑完 8 轮", async () => {
    const { room } = await createSdkRoom({
      def: SUPERPOWER_RACE_CORE,
      roomName: "smoke-超能力赛马",
      createdByUserId: 101,
      creatorName: "测试旅人",
    });
    const host = room.getState().seats[0]!;
    await room.act(host.seatToken!, { type: "start" });

    for (let i = 0; i < 10 && room.getState().status !== "finished"; i += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
    }

    const state = room.getState();
    expect(state.status).toBe("finished");
    expect(state.history.length).toBeLessThanOrEqual(8);
    const match = state.matchState as { trackLength?: number; track?: unknown[]; racers?: { position: number }[] };
    expect(match.trackLength).toBe(48);
    expect(match.track).toHaveLength(48);
    expect(match.racers?.every((r) => r.position <= 48)).toBe(true);
  }, 30_000);

  it("十二席狼人杀能由通用房间推进夜昼阶段并终局", async () => {
    const { room } = await createSdkRoom({
      def: WEREWOLF_12_CORE,
      roomName: "smoke-十二席狼人杀",
      createdByUserId: 102,
      creatorName: "测试旅人",
    });
    const host = room.getState().seats[0]!;
    expect(room.getState().seats).toHaveLength(12);
    await room.act(host.seatToken!, { type: "start" });

    // 每个子阶段至少等一个完整窗口；fake timers 会把所有 bot 定时动作一并推进。
    for (let i = 0; i < 80 && room.getState().status !== "finished"; i += 1) {
      await vi.advanceTimersByTimeAsync(60_000);
    }

    const state = room.getState();
    expect(state.status).toBe("finished");
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.seats.filter(Boolean)).toHaveLength(12);
  }, 30_000);

  it("首发清单的 7 个公开游戏与 4 个 Agent-only 变体都能由外部 Agent 跑到终局", async () => {
    const definitions = [
      GUESS_CORE,
      GUESS_MILLE_CORE,
      GUESS_DARK_CORE,
      POLL_DUEL_CORE,
      POLL_DARK_CORE,
      PIRATE_GOLD_CORE,
      FLYTEASE_CORE,
      FLYTEASE_DARK_CORE,
      SUPERPOWER_BILLIARDS_CORE,
      SUPERPOWER_RACE_CORE,
      WEREWOLF_12_CORE,
    ];

    for (const def of definitions) {
      const created = await createSdkRoom({
        def,
        roomName: `acceptance-${def.id}`,
        createdByUserId: 701,
        creatorName: "验收旅人",
      });
      const joined = await created.room.joinAsAgent({
        id: 9701,
        name: `验收Agent-${def.id}`,
      });
      const starter = def.seatPolicy === "agent-only"
        ? joined.seatToken
        : created.room.getState().seats[0]?.seatToken;
      if (!starter) throw new Error(`${def.id} 没有可用的开局席位`);
      await created.room.act(starter, { type: "start" });

      for (let step = 0; step < 320 && created.room.getState().status !== "finished"; step += 1) {
        await vi.advanceTimersByTimeAsync(60_000);
      }

      const state = created.room.getState();
      expect(state.status, def.id).toBe("finished");
      expect(state.seats.filter(Boolean), def.id).toHaveLength(def.seats);
      expect(state.rankings, def.id).toHaveLength(def.seats);
      expect(state.eventLog?.some((event) => event.t === "matchEnd"), def.id).toBe(true);
    }
  }, 120_000);
});

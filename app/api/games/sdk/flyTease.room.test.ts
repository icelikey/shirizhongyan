/**
 * ============================================================================
 * flyTease 房间级端到端（免数据库）· api/games/sdk/flyTease.room.test.ts
 * ----------------------------------------------------------------------------
 * 与 flyTease.test.ts（模板纯函数）互补：这里驱动**通用 runtime 的完整一局**。
 *
 * 为什么能不碰数据库：SdkRoom 的所有落库（persistRoomState / insertMatchLog /
 * settleRewards）都是 fire-and-forget + .catch 兜底——数据库不存在时对局
 * 照常推进，只是留痕失败。本测试直接 createSdkRoom（绕过 roomRouter 里
 * await insertRoom 的那一步），用 fake timers 快进完一整局：
 *
 *   开局（影从补席）→ 每轮择牌 → bot 自动出牌 → 提前揭晓 → 下一轮 → 终局名次
 *
 * 校验四层：
 * 1. 视图层：fly 情报（mood/engine/cardCount）逐轮下发且与契约一致；
 * 2. 揭晓层：values/hits/gains/crowd/rage/rain/poolOrder 全部到位且合法；
 * 3. 铁律层：得分恒非负整数；怒气引爆轮全场归零；未引爆轮打中者得分>0 可选；
 * 4. 终局层：名次覆盖全部座位、累计分 = 各轮得分之和、mood 序列可复算。
 *
 * 运行：npm run test -- api/games/sdk/flyTease.room.test.ts
 * ============================================================================
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 落库全部 mock 成 no-op：本测试验证的是**对局逻辑**，不是数据库。
 * （真实落库路径由 sdk.smoke.test.ts 用真 MySQL 覆盖——那是队友的基建。）
 * SdkRoom 的落库本就 fire-and-forget + .catch，不 mock 也能跑通，
 * mock 只是为了让输出干净、不刷 ECONNREFUSED 的巨型堆栈。
 */
vi.mock("../../queries/profiles", () => ({
  awardGameResult: vi.fn(async () => ({})),
}));
vi.mock("../../queries/gameDefs", () => ({
  incrementGameDefPlays: vi.fn(async () => ({})),
  findGameDefByDefId: vi.fn(async () => null),
  listPopularGameDefs: vi.fn(async () => []),
  insertGameDef: vi.fn(async () => ({})),
}));
vi.mock("../../queries/rooms", () => ({
  persistRoomState: vi.fn(async () => ({})),
  findRoomByCode: vi.fn(async () => null),
  insertRoom: vi.fn(async () => ({})),
}));
vi.mock("../../queries/matchLogs", () => ({
  insertMatchLog: vi.fn(async () => 1),
}));
vi.mock("../../queries/playerCards", () => ({
  grantCard: vi.fn(async () => ({})),
}));

import { createSdkRoom, FLYTEASE_CORE } from "./registry";
import { FLY_ATLAS } from "./flybrain/atlas.generated";
import {
  cricketMoodFor,
  FLY_HIT_FLOOR,
  type FlyBehavior,
  type FlyTeaseReveal,
  type FlyTeaseRoomView,
} from "@contracts/flyTease";
import type { FlyTeaseDefinition } from "@contracts/gameSdk";

/** 无数据库时落库会刷 console.error（对局本身无伤）——测试里静音 */
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("flyTease 房间端到端（免数据库）", () => {
  it("完整打完一局：开局 → 3 轮择牌/揭晓 → 终局名次", async () => {
    vi.useFakeTimers();

    const core = FLYTEASE_CORE as FlyTeaseDefinition;
    const def: FlyTeaseDefinition = {
      ...core,
      params: { ...core.params, rounds: 3 },
    };
    const CARD_COUNT = FLY_ATLAS.cards.length;

    const { room, seatToken: createdSeatToken, seatIndex } = await createSdkRoom({
      def,
      roomName: "虫室温测",
      createdByUserId: null,
      creatorName: "温测者",
      config: { roomName: "虫室温测" },
    });
    expect(seatIndex).toBe(0);
    expect(createdSeatToken).not.toBeNull();
    const seatToken = createdSeatToken!;
    const playerSeat = seatIndex!;

    // ── 开局前：waiting，未开局时 mood 为占位但不下发错误 ──
    let view = room.view(seatToken) as FlyTeaseRoomView;
    expect(view.status).toBe("waiting");
    expect(view.template).toBe("flyTease");

    // ── 开局：空位由影从补满 ──
    await room.act(seatToken, { type: "start" });
    view = room.view(seatToken) as FlyTeaseRoomView;
    expect(view.status).toBe("playing");
    expect(view.seats).toHaveLength(def.seats);
    expect(view.seats.filter((s) => s.kind === "echo-bot").length).toBe(
      def.seats - 1,
    );

    const myGainsTotal = 0;
    let myGainsSum = 0;
    const moodSeq: FlyBehavior[] = [];

    for (let round = 1; round <= 3; round++) {
      // ── 提交阶段：偏好由服务端下发，且与契约公式一致 ──
      view = room.view(seatToken) as FlyTeaseRoomView;
      expect(view.phase).toBe("submit");
      expect(view.round).toBe(round);
      const mood = view.fly.mood;
      expect(mood).toBe(cricketMoodFor(def.id, round, def.params.fickleness));
      expect(view.fly.cardCount).toBe(CARD_COUNT);
      expect(view.fly.engine).toBe(FLY_ATLAS.engine);
      moodSeq.push(mood);

      // 出「对本轮偏好命中概率最高」的牌（读表打法）
      const best = FLY_ATLAS.cards.reduce((a, c) =>
        (c.behavior[mood] ?? 0) > (a.behavior[mood] ?? 0) ? c : a,
      );
      await room.act(seatToken, { type: "choose", choice: best.index });

      // 影从在 1–4s 内陆续出牌；全员提交齐则提前揭晓。轮询快进到揭晓，
      // 不依赖精确步长（bot 延时随机，且 revealRound 经 enqueue 串行化）。
      // 注意末轮 revealRound 会立刻接 finish()——phase 的 'reveal' 态可能
      // 一闪而过，故以「拿到本轮 lastReveal」为准（finish 不清空它）。
      let waited = 0;
      while (
        room.view(seatToken).phase !== "reveal" &&
        room.view(seatToken).status === "playing" &&
        waited < 60_000
      ) {
        await vi.advanceTimersByTimeAsync(500);
        waited += 500;
      }

      // ── 揭晓阶段：结构完整且数值合法 ──
      view = room.view(seatToken) as FlyTeaseRoomView;
      const reveal = view.lastReveal as FlyTeaseReveal;
      expect(reveal.round).toBe(round);
      expect(reveal.cricketMood).toBe(mood);
      expect(reveal.values[playerSeat]).toBe(best.index);
      expect(reveal.hits[playerSeat]).toBeGreaterThanOrEqual(FLY_HIT_FLOOR);

      for (const seat of view.seats) {
        const value = reveal.values[seat.index];
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(CARD_COUNT);
        expect(reveal.tops[seat.index]).toBeTruthy();
        expect(reveal.crowd[seat.index]).toBeGreaterThan(0);
        expect(reveal.crowd[seat.index]).toBeLessThanOrEqual(1);
        expect(Number.isInteger(reveal.gains[seat.index])).toBe(true);
        expect(reveal.gains[seat.index]).toBeGreaterThanOrEqual(0);
      }

      // 怒气铁律：引爆轮全场零分；未引爆时我的最优牌允许 0 分（拥挤摊薄）但不得为负
      if (reveal.raged) {
        for (const seat of view.seats) expect(reveal.gains[seat.index]).toBe(0);
      } else {
        expect(reveal.rage).toBeLessThan(def.params.rageThreshold);
      }

      // 演出物料：脉冲雨图与池序随揭晓下发
      expect(reveal.poolOrder).toEqual(FLY_ATLAS.poolOrder);
      expect(reveal.engine).toBe(FLY_ATLAS.engine);
      expect(Array.isArray(reveal.rain[best.index])).toBe(true);

      myGainsSum += reveal.gains[playerSeat] ?? 0;

      // 揭晓停留 REVEAL_MS(5s) 后进入下一轮（末轮则终局）。同样轮询推进。
      let waited2 = 0;
      let next: FlyTeaseRoomView;
      do {
        next = room.view(seatToken) as FlyTeaseRoomView;
        if (
          (next.status === "playing" && next.phase === "submit") ||
          next.status === "finished"
        ) {
          break;
        }
        await vi.advanceTimersByTimeAsync(500);
        waited2 += 500;
        if (waited2 > 60_000) break;
      } while (true);
    }

    // ── 终局：名次覆盖全部座位、累计分一致、mood 序列可复算 ──
    await vi.advanceTimersByTimeAsync(300);
    view = room.view(seatToken) as FlyTeaseRoomView;
    expect(view.status).toBe("finished");
    expect(view.winner).not.toBeNull();
    expect(new Set(view.rankings).size).toBe(def.seats);
    expect(view.rankings).toHaveLength(def.seats);

    const myFinal = view.seats.find((s) => s.index === seatIndex);
    expect(myFinal?.score).toBe(myGainsSum);
    expect(myGainsSum).toBeGreaterThanOrEqual(0);
    void myGainsTotal;

    // 同一定义重放 mood 序列完全一致（确定性信号，规则书 c-fly-preference 的依据）
    for (let r = 1; r <= 3; r++) {
      expect(moodSeq[r - 1]).toBe(cricketMoodFor(def.id, r, def.params.fickleness));
    }
  });
});


import { describe, expect, it } from "vitest";
import {
  DAILY_GAME_QUOTA,
  DAY_MS,
  MAX_MEMORY_CAPACITY,
  WORLD_MEMORY_CARDS,
  applyWorldGame,
  buildAgentMemoryContext,
  buildWorldIntelContext,
  createWorldState,
  longTermGate,
  normalizeWorldState,
  reconcileWorldState,
  restoreAfterDeath,
} from "./worldCycle";

describe("终焉世界层", () => {
  it("每日三局完成且至少一胜时上升一层，第四局不会被偷偷记入", () => {
    const first = createWorldState(0, "xuanji");
    const second = applyWorldGame(first, "loss", 0);
    const third = applyWorldGame(second, "draw", 0);
    const fourth = applyWorldGame(third, "win", 0);
    const blocked = applyWorldGame(fourth, "win", 0);

    expect(fourth.playedToday).toBe(DAILY_GAME_QUOTA);
    expect(fourth.floor).toBe(2);
    expect(blocked.totalGames).toBe(fourth.totalGames);
    expect(blocked.lifeScore).toBe(fourth.lifeScore);
  });

  it("跨日会把未完成的局数记为时间债", () => {
    const state = { ...createWorldState(0), playedToday: 1, lifeScore: 100 };
    const next = reconcileWorldState(state, DAY_MS);

    expect(next.day).toBe(2);
    expect(next.playedToday).toBe(0);
    expect(next.missedGames).toBe(2);
    expect(next.lifeScore).toBe(76);
  });

  it("生命归零进入死亡候选，轮回只带回玩家选择的记忆", () => {
    const state = { ...createWorldState(0), lifeScore: 7, floor: 12 };
    const dead = applyWorldGame(state, "loss", 0);
    const restored = restoreAfterDeath(dead, ["memory-first-rule", "memory-failed-proposal"], 100);

    expect(dead.status).toBe("dead");
    expect(dead.pendingDeathSelection).toContain("memory-failed-proposal");
    expect(restored.status).toBe("alive");
    expect(restored.floor).toBe(1);
    expect(restored.cycle).toBe(2);
    expect(restored.equippedMemoryIds).toEqual(["memory-first-rule", "memory-failed-proposal"]);
  });

  it("Agent 上下文同时携带配额、危机、异能和记忆指令", () => {
    const context = buildAgentMemoryContext(createWorldState(0, "baize"));

    expect(context.dailyGames.remaining).toBe(3);
    expect(context.dailyDarkMatches).toMatchObject({ kind: "dark-match", required: 3, remaining: 3, fulfilled: false });
    expect(context.ability.name).toBe("星盘");
    expect(context.memoryCards.map((card) => card.id)).toContain("memory-first-rule");
    expect(context.rule).toContain("legal action");
  });

  it("旧存档缺少背包和异能容量字段时会补齐，并保留已装备记忆", () => {
    const legacy = {
      ...createWorldState(0, "baize"),
      ability: { id: "legacy", name: "旧异能", sourceEchoId: "baize", level: 2, chargesLeft: 1, description: "旧档案" },
      memoryCards: ["memory-first-rule", "memory-companion-oath", "memory-second-guess"],
      equippedMemoryIds: ["memory-first-rule", "memory-companion-oath", "memory-second-guess"],
    };
    const normalized = normalizeWorldState(legacy);

    expect(normalized.mapFragments).toEqual([]);
    expect(normalized.noteScrolls).toEqual([]);
    expect(normalized.ability.memorySlotsBonus).toBe(1);
    expect(normalized.equippedMemoryIds).toHaveLength(4 - 1);
    expect(buildAgentMemoryContext(normalized).memoryCapacity).toBe(4);
  });

  it("连续胜利只增加局部连胜，不会单独确认真相", () => {
    let state = createWorldState(0);
    state = applyWorldGame(state, "win", 0);
    state = applyWorldGame(state, "win", 0);
    state = applyWorldGame(state, "win", 0);

    expect(state.recurrence.localWinStreak).toBe(3);
    expect(state.recurrence.failureCount).toBe(0);
    expect(state.recurrence.longTermInsight).toBe(0);
    expect(state.recurrence.unlockedTruthIds).toEqual([]);
    expect(longTermGate(state).satisfied).toBe(false);
  });

  it("失败会留下长期证据，并按门槛解锁真相路径", () => {
    let state = createWorldState(0);
    state = applyWorldGame(state, "loss", 0);
    expect(state.recurrence.failureCount).toBe(1);
    expect(state.recurrence.localWinStreak).toBe(0);
    expect(state.recurrence.unlockedTruthIds).toContain("truth-local-optimum");
    expect(state.memoryArchiveIds).toContain("memory-failed-proposal");

    state = applyWorldGame(state, "loss", 0);
    state = applyWorldGame(state, "loss", 0);
    expect(state.recurrence.failureCount).toBe(3);
    expect(state.recurrence.unlockedTruthIds).toContain("truth-cost-of-repeat");
    expect(state.memoryArchiveIds).toContain("memory-unheard-voice");
  });

  it("死亡增加轮回证据，复归后统计和记忆档案不会被清空", () => {
    const dead = applyWorldGame({ ...createWorldState(0), lifeScore: 7, floor: 12 }, "loss", 0);
    const restored = restoreAfterDeath(dead, ["memory-first-rule"], 100);

    expect(dead.recurrence.deathCount).toBe(1);
    expect(restored.recurrence.deathCount).toBe(1);
    expect(restored.recurrence.failureCount).toBe(1);
    expect(restored.memoryArchiveIds).toEqual(expect.arrayContaining(dead.memoryArchiveIds));
    expect(restored.pendingDeathSelection).toEqual([]);
    expect(restored.deathFloor).toBeNull();
  });

  it("携带容量已满时，新的失败仍进入记忆档案", () => {
    const fullCards = WORLD_MEMORY_CARDS
      .map((card) => card.id)
      .filter((id) => id !== "memory-failed-proposal")
      .slice(0, MAX_MEMORY_CAPACITY);
    const state = normalizeWorldState({
      ...createWorldState(0),
      memoryCards: fullCards,
      equippedMemoryIds: fullCards,
      memoryArchiveIds: fullCards,
    });
    const next = applyWorldGame(state, "loss", 0);

    expect(next.memoryCards).toHaveLength(MAX_MEMORY_CAPACITY);
    expect(next.memoryCards).not.toContain("memory-failed-proposal");
    expect(next.memoryArchiveIds).toContain("memory-failed-proposal");
  });

  it("Agent 上下文明确区分携带记忆、发现档案和长期出口", () => {
    let state = createWorldState(0);
    state = applyWorldGame(state, "loss", 0);
    const context = buildAgentMemoryContext(state);

    expect(context.recurrence.failureCount).toBe(1);
    expect(context.memoryArchive.count).toBeGreaterThanOrEqual(context.memoryCards.length);
    expect(context.unlockedTruths.map((truth) => truth.id)).toContain("truth-local-optimum");
    expect(context.longTermGate.satisfied).toBe(false);
    expect(context.longTermGate.requirements.mapFragments.satisfied).toBe(false);
  });

  it("没有入局时仍能读取当前层见闻，并明确三场暗局欠账", () => {
    const intel = buildWorldIntelContext(createWorldState(0, "baize"), 0);

    expect(intel.sightings[0]).toMatchObject({ id: "sighting-empty-seats", realm: "牌局之间" });
    expect(intel.dailyDarkMatches).toMatchObject({ played: 0, required: 3, remaining: 3, fulfilled: false });
    expect(intel.nextInstruction).toContain("黑暗对局");
  });

  it("三场暗局完成后见闻会显示今日已清账", () => {
    let state = createWorldState(0, "baize");
    state = applyWorldGame(state, "loss", 0);
    state = applyWorldGame(state, "draw", 0);
    state = applyWorldGame(state, "win", 0);
    const intel = buildWorldIntelContext(state, 0);

    expect(intel.dailyDarkMatches).toMatchObject({ played: 3, remaining: 0, fulfilled: true });
    expect(intel.nextInstruction).toContain("已清账");
  });
});

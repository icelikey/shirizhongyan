import { describe, expect, it } from "vitest";
import {
  createSpireRuntime,
  deterministicSpireDropChoices,
  lifeCrisisForWorld,
  loadoutUsage,
  replaySpireDropChoices,
  resolveSpireDeathCarry,
  selectSpireDrop,
  settleSpireFloor,
  type SpireSettlementRecord,
} from "./spireRuntime";
import { createWorldState } from "./worldCycle";

describe("碎境爬塔运行时", () => {
  it("危机只读取世界生命和层级，不改变战斗结果", () => {
    const world = { ...createWorldState(0), floor: 12, lifeScore: 50 };
    const crisis = lifeCrisisForWorld(world);

    expect(crisis).toMatchObject({ floor: 12, threshold: 50, critical: true, lethal: false });
    expect(crisis.rule).toContain("规则复述");
  });

  it("同一回放输入生成完全相同的掉落候选", () => {
    const input = {
      seed: 8128,
      eventId: "match-001:settlement",
      cycle: 3,
      floor: 12,
      phase: "floor-win" as const,
      evidence: {},
    };
    const first = deterministicSpireDropChoices(input);
    const second = deterministicSpireDropChoices(input);

    expect(first).toEqual(second);
    expect(first.items.length).toBeLessThanOrEqual(3);
    expect(new Set(first.items.map((item) => item.id)).size).toBe(first.items.length);
  });

  it("胜局只由已结算结果进入世界层，并将掉落选择与层结算分开", () => {
    const world = createWorldState(0);
    const runtime = createSpireRuntime({ world, runId: "run-1", seed: 42 });
    const settled = settleSpireFloor(world, runtime, {
      eventId: "match-001:settlement",
      encounter: "battle",
      result: "win",
      now: 0,
    });

    expect(settled.ok).toBe(true);
    expect(settled.world.totalGames).toBe(1);
    expect(settled.world.floor).toBe(1);
    expect(settled.runtime.settlementHistory[0]?.selectedDropId).toBeNull();
    expect(settled.dropChoices.length).toBeGreaterThan(0);

    const chosen = settled.dropChoices[0];
    if (!chosen) throw new Error("测试需要至少一个掉落候选");
    const selected = selectSpireDrop(settled.world, settled.runtime, {
      settlementId: "match-001:settlement",
      dropId: chosen.id,
    });
    const repeated = selectSpireDrop(selected.world, selected.runtime, {
      settlementId: "match-001:settlement",
      dropId: chosen.id,
    });

    expect(selected.ok).toBe(true);
    expect(repeated.status).toBe("duplicate");
    expect(loadoutUsage(selected.runtime.carried)[chosen.kind]).toBeGreaterThanOrEqual(chosen.capacityCost);
  });

  it("生命归零进入死亡候选，回底只保留明确选择且保留历史", () => {
    const world = {
      ...createWorldState(0),
      floor: 12,
      lifeScore: 7,
      memoryCards: ["memory-first-rule", "memory-companion-oath"],
      equippedMemoryIds: ["memory-first-rule"],
    };
    const runtime = createSpireRuntime({
      world,
      runId: "run-death",
      seed: 9,
      carry: {
        memoryIds: ["memory-first-rule"],
        skillIds: ["sp.skill-memory-loadout"],
        mapFragmentIds: ["sp.map-layer-seam"],
      },
    });
    const dead = settleSpireFloor(world, runtime, {
      eventId: "match-death:settlement",
      encounter: "elite",
      result: "loss",
      now: 0,
    });

    expect(dead.world.status).toBe("dead");
    expect(dead.runtime.status).toBe("dead");
    expect(dead.runtime.pendingDeathSelection?.candidateIds).toEqual(expect.arrayContaining([
      "memory-first-rule",
      "sp.skill-memory-loadout",
      "sp.map-layer-seam",
      "sp.memory-loop-index",
    ]));

    const restored = resolveSpireDeathCarry(dead.world, dead.runtime, {
      selectedIds: ["memory-first-rule", "sp.skill-memory-loadout"],
      now: 100,
    });
    expect(restored.ok).toBe(true);
    expect(restored.world.status).toBe("alive");
    expect(restored.world.floor).toBe(1);
    expect(restored.world.cycle).toBe(2);
    expect(restored.runtime.carried).toMatchObject({
      memoryIds: ["memory-first-rule"],
      skillIds: ["sp.skill-memory-loadout"],
      mapFragmentIds: [],
    });
    expect(restored.runtime.deathHistory[0]?.selectedIds).toEqual([
      "memory-first-rule",
      "sp.skill-memory-loadout",
    ]);
  });

  it("带回选择超出加权容量时拒绝，不静默截断", () => {
    const world = { ...createWorldState(0), lifeScore: 1 };
    const runtime = createSpireRuntime({ world, runId: "run-capacity", seed: 1 });
    const dead = settleSpireFloor(world, runtime, {
      eventId: "capacity-death",
      encounter: "battle",
      result: "loss",
      now: 0,
    });
    const rejected = resolveSpireDeathCarry(dead.world, dead.runtime, {
      selectedIds: ["sp.memory-loop-index", "memory-first-rule", "memory-companion-oath"],
      now: 0,
    });

    expect(rejected).toMatchObject({ ok: false, status: "rejected", reason: "capacity-exceeded" });
    expect(rejected.runtime.status).toBe("dead");
  });

  it("结算记录可以按保存的候选 id 回放", () => {
    const world = createWorldState(0);
    const runtime = createSpireRuntime({ world, runId: "run-replay", seed: 77 });
    const result = settleSpireFloor(world, runtime, {
      eventId: "replay-event",
      encounter: "boss",
      result: "win",
      now: 0,
    });
    const record = result.runtime.settlementHistory[0] as SpireSettlementRecord;

    expect(replaySpireDropChoices(record)).toEqual(result.dropChoices);
  });
});

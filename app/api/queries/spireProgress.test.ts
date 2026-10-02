import { describe, expect, it } from "vitest";
import {
  projectSpireProgress,
  readSpireSnapshot,
  writeSpireSnapshot,
} from "./spireProgress";
import { createSpireRuntime } from "@contracts/spireRuntime";
import { createWorldState } from "@contracts/worldCycle";

describe("碎境爬塔查询持久化边界", () => {
  it("只在 recordsJson.world / spire 下保存快照，并保留其他业务字段", () => {
    const world = createWorldState(0);
    const runtime = createSpireRuntime({ world, runId: "persist-1", seed: 123 });
    const records = writeSpireSnapshot(
      { guess: { played: 2 }, world: { legacy: true } },
      { world, runtime },
    );

    expect(records.guess).toEqual({ played: 2 });
    expect(records.world).toEqual(world);
    expect(records.spire).toEqual(runtime);
    expect(readSpireSnapshot(records, 0)).toEqual({ world, runtime });
  });

  it("旧档没有 spire 快照时创建可回放的默认运行时，不要求新表", () => {
    const snapshot = readSpireSnapshot({ world: createWorldState(0) }, 0);

    expect(snapshot.runtime.runId).toBe("spire-cycle-1");
    expect(snapshot.runtime.seed).toBe(0);
    expect(snapshot.runtime.carryLimits).toMatchObject({ memory: 3, skill: 2, mapFragment: 4 });
    expect(snapshot.runtime.status).toBe("active");
  });

  it("进度投影同时提供危机、携带容量和残章完成组", () => {
    const progress = projectSpireProgress({
      userId: 9,
      recordsJson: { world: { ...createWorldState(0), floor: 6, lifeScore: 55 } },
      completedRelicSetIds: ["set-spade-flaw", "set-spade-flaw"],
      now: 0,
    });

    expect(progress.userId).toBe(9);
    expect(progress.crisis).toMatchObject({ floor: 6, critical: true });
    expect(progress.runtimeContext.carryLimits).toEqual(progress.runtime.carryLimits);
    expect(progress.relics.completedSetIds).toEqual(["set-spade-flaw"]);
    expect(progress.persistence).toEqual({
      version: 1,
      recordsKey: "spire",
      schemaChanged: false,
    });
  });
});

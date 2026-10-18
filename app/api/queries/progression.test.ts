import { describe, expect, it, vi } from "vitest";
import { applyProgressionRecords, findProgressionByUserId, selectContentDrop, stableDropPool } from "./progression";
import { findCardsByUser } from "./playerCards";
import { findProfileByUserId } from "./profiles";

vi.mock("./playerCards", () => ({ findCardsByUser: vi.fn() }));
vi.mock("./profiles", () => ({ findProfileByUserId: vi.fn() }));
import { createWorldState } from "@contracts/worldCycle";
import { createSpireRuntime, resolveSpireDeathCarry, settleSpireFloor } from "@contracts/spireRuntime";

const pool = [
  { id: "map.z", type: "map" as const, rarity: "rare" },
  { id: "memory.a", type: "memory" as const, rarity: "common" },
  { id: "skill.b", type: "skill" as const, rarity: "uncommon" },
];

describe("content progression settlement", () => {
  it("按稳定 id 与 event seed 选择，重放返回同一 receipt 且不重复记录", () => {
    expect(stableDropPool(pool).map((x) => x.id)).toEqual(["map.z", "memory.a", "skill.b"]);
    expect(selectContentDrop(pool, "match:44:seat:1", "win")).toEqual(selectContentDrop([...pool].reverse(), "match:44:seat:1", "win"));
    const first = applyProgressionRecords({}, { receipt: { eventId: "e1", matchLogId: 1, gameId: "g", result: "win", dropId: "memory.a", dropType: "memory", cardGranted: true, settledAt: 1 }, drop: pool[1], death: false });
    const replayReceipt = ((first.records.progression as any).settlements.e1);
    const replay = applyProgressionRecords(first.records, { receipt: replayReceipt, drop: pool[1], death: false });
    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(Object.keys((first.records.progression as any).settlements)).toHaveLength(1);
  });

  it("失败没有掉落，死亡待选由结算档案保留", () => {
    const failed = applyProgressionRecords({}, { receipt: { eventId: "loss", matchLogId: 2, gameId: "g", result: "loss", dropId: null, dropType: null, cardGranted: false, settledAt: 1 }, drop: null, death: true, pendingDeathSelection: ["memory-loop-mark"] });
    expect((failed.records.progression as any).settlements.loss.dropId).toBeNull();
    expect((failed.records.progression as any).pendingDeathSelection).toBeUndefined();
  });

  it("兼容 MySQL JSON 列返回字符串，并保留已有战绩与世界快照", () => {
    const existing = JSON.stringify({
      guess: { played: 1, won: 1 },
      world: { mapFragments: ["map.old"] },
    });
    const applied = applyProgressionRecords(existing, {
      receipt: { eventId: "string-json", matchLogId: 3, gameId: "g", result: "loss", dropId: null, dropType: null, cardGranted: false, settledAt: 1 },
      drop: null,
      death: false,
    });
    expect(applied.records.guess).toEqual({ played: 1, won: 1 });
    expect(applied.records.world).toEqual({ mapFragments: ["map.old"] });
    expect((applied.records.progression as any).settlements["string-json"]).toBeTruthy();
  });

  it("沿用 spireRuntime 的容量和死亡选择语义", () => {
    const world = { ...createWorldState(0), lifeScore: 7 };
    const runtime = createSpireRuntime({ world, runId: "r", seed: 7 });
    const dead = settleSpireFloor(world, runtime, { eventId: "death-1", encounter: "boss", result: "loss", now: 1 });
    expect(dead.runtime.pendingDeathSelection?.candidateIds.length).toBeGreaterThan(0);
    const tooMany = resolveSpireDeathCarry(dead.world, dead.runtime, { selectedIds: dead.runtime.pendingDeathSelection!.candidateIds, now: 2 });
    expect(tooMany.status).toBe("rejected");
    expect(tooMany.reason).toBe("capacity-exceeded");
  });
});

describe("progression readback", () => {
  it("merges progression records and owned cards into one user snapshot", async () => {
    vi.mocked(findProfileByUserId).mockResolvedValue({
      recordsJson: {
        progression: {
          settlements: {
            "event-1": {
              eventId: "event-1",
              matchLogId: 11,
              gameId: "guess-core",
              result: "win",
              dropId: "memory.a",
              dropType: "memory",
              cardGranted: true,
              settledAt: 100,
            },
          },
          lastReceipt: {
            eventId: "event-1",
            matchLogId: 11,
            gameId: "guess-core",
            result: "win",
            dropId: "memory.a",
            dropType: "memory",
            cardGranted: true,
            settledAt: 100,
          },
          longTermMemoryIds: ["memory.a"],
          pendingDeathSelection: ["memory.a"],
        },
        world: {
          memoryArchiveIds: ["memory.a"],
          mapFragments: ["map.old"],
        },
      },
    } as never);
    vi.mocked(findCardsByUser).mockResolvedValue([
      {
        cardId: "memory.a",
        kind: "relic",
        count: 1,
        source: "victory",
        acquiredAt: new Date("2026-10-17T00:00:00.000Z"),
      },
    ] as never);

    const snapshot = await findProgressionByUserId(7);

    expect(snapshot?.progression.longTermMemoryIds).toEqual(["memory.a"]);
    expect(snapshot?.progression.pendingDeathSelection).toEqual(["memory.a"]);
    expect(snapshot?.world.mapFragments).toEqual(["map.old"]);
    expect(snapshot?.cards).toHaveLength(1);
    expect(snapshot?.cards[0]?.cardId).toBe("memory.a");
  });
});


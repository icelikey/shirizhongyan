import { describe, expect, it } from "vitest";
import { createAiNativeWorldRuntime, createAiNativeWorldRuntimeFromEnvelope } from "./aiNativeWorldRuntime";

const hash = "a".repeat(64);
const runtime = () => createAiNativeWorldRuntime({
  worldId: "world-a",
  matchId: "match-a",
  cycle: 1,
  rulebookVersion: "v1.0.0",
});

describe("AI 原生世界运行时", () => {
  it("从已落库的 MatchLogEnvelope 重建同一条 canonical stream", () => {
    const world = createAiNativeWorldRuntimeFromEnvelope({
      envelope: {
        version: 1,
        rulebookId: "rules",
        seed: "seed",
        startedAt: 1,
        endedAt: 2,
        events: [
          { seq: 0, round: 0, t: "matchStart", rulebookId: "rules", seed: "seed", seats: [] },
          { seq: 1, round: 1, t: "roundBegin" },
        ],
      },
      worldId: "world-a",
      matchId: "match-a",
      cycle: 1,
      rulebookVersion: "v1.0.0",
    });
    expect(world.eventRefs).toHaveLength(2);
    expect(world.project("text").cursor?.eventSeq).toBe(1);
    expect(world.project("text").cursor?.stateHash).toBe(world.eventRefs[1]?.stateHash);
  });

  it("把同一事件流投影到文字和图形两种展现形式", () => {
    const world = runtime();
    world.append({
      event: { seq: 0, round: 0, t: "matchStart", rulebookId: "rules", seed: "seed", seats: [] },
      ref: { worldId: "world-a", cycle: 1, matchId: "match-a", eventSeq: 0, eventType: "matchStart", stateHash: hash, rulebookVersion: "v1.0.0", visibility: "public" },
    });
    world.append({
      event: { seq: 1, round: 1, t: "action", seat: 0, kind: "observe", value: null },
      ref: { worldId: "world-a", cycle: 1, matchId: "match-a", eventSeq: 1, eventType: "action", stateHash: hash, rulebookVersion: "v1.0.0", visibility: "public" },
    });

    expect(world.project("text").events.map(item => item.event.eventSeq)).toEqual([0, 1]);
    expect(world.project("graphic").events.map(item => item.event.eventSeq)).toEqual([0, 1]);
    expect(world.eventCount).toBe(2);
  });

  it("重复事件幂等，内容不同则拒绝", () => {
    const world = runtime();
    const ref = { worldId: "world-a", cycle: 1, matchId: "match-a", eventSeq: 0, eventType: "matchStart", stateHash: hash, rulebookVersion: "v1.0.0", visibility: "public" as const };
    const event = { seq: 0, round: 0, t: "matchStart" as const, rulebookId: "rules", seed: "seed", seats: [] };
    world.append({ event, ref });
    world.append({ event, ref });
    expect(world.eventCount).toBe(1);
    expect(() => world.append({ event: { ...event, seed: "other" }, ref })).toThrow();
  });

  it("拒绝把不属于当前周期的事件接入", () => {
    const world = runtime();
    expect(() => world.append({
      event: { seq: 0, round: 0, t: "matchStart", rulebookId: "rules", seed: "seed", seats: [] },
      ref: { worldId: "world-a", cycle: 2, matchId: "match-a", eventSeq: 0, eventType: "matchStart", stateHash: hash, rulebookVersion: "v1.0.0", visibility: "public" },
    })).toThrow("周期");
  });
});

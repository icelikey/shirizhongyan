import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMatchStream } from "./aiNativeMatchStream";
import type { MatchLogEnvelope } from "../contracts/matchLog";

const envelope = (events: MatchLogEnvelope["events"]): MatchLogEnvelope => ({ version: 1, rulebookId: "rules", seed: "seed-1", startedAt: 1, endedAt: 2, events });
const stableJson = (value: unknown): string => value === null || typeof value !== "object"
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(stableJson).join(",")}]`
    : `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;

describe("buildMatchStream", () => {
  it("把真实事件映射为双投影并按事件前缀生成确定性哈希", () => {
    const events = [
      { seq: 0, round: 0, t: "matchStart", rulebookId: "rules", seed: "seed-1", seats: [] },
      { seq: 1, round: 1, t: "secretAssign", secret: true, seat: 0, value: "wolf" },
    ] as MatchLogEnvelope["events"];
    const result = buildMatchStream({ envelope: envelope(events), worldId: "world-1", cycle: 3, matchId: "match-1", rulebookVersion: "v1.2.3" });
    const expected = createHash("sha256").update(stableJson({ events, rulebookId: "rules", seed: "seed-1" })).digest("hex");
    expect(result.refs).toHaveLength(2);
    expect(result.events[1].payload).toEqual(events[1]);
    expect(result.refs[0]).toMatchObject({ worldId: "world-1", cycle: 3, matchId: "match-1", eventSeq: 0, visibility: "public", stateHash: expect.any(String) });
    expect(result.refs[1]).toMatchObject({ eventType: "secretAssign", visibility: "judge", stateHash: expect.any(String) });
    expect(result.refs[0].stateHash).not.toBe(result.refs[1].stateHash);
    expect(result.refs[1].stateHash).toBe(expected);
    expect(result.cursor).toMatchObject({ eventSeq: 1, stateHash: result.refs[1].stateHash, projection: "text" });
  });

  it("空事件返回空数组和 null cursor", () => {
    expect(buildMatchStream({ envelope: envelope([]), worldId: "w", cycle: 0, matchId: null })).toEqual({ refs: [], events: [], cursor: null });
  });

  it("拒绝不连续或与数组位置不一致的序号", () => {
    const events = [{ seq: 1, round: 0, t: "roundBegin" }] as MatchLogEnvelope["events"];
    expect(() => buildMatchStream({ envelope: envelope(events), worldId: "w", cycle: 0, matchId: null })).toThrow("数组位置一致");
  });
});

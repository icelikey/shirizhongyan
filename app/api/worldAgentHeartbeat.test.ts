import { describe, expect, it } from "vitest";
import { createHeartbeatState, pauseAgent, registerAgent, resumeAgent, runAgentHeartbeat } from "./worldAgentHeartbeat";
import type { WorldEventRef } from "../contracts/aiNativeWorld";

const event: WorldEventRef = { worldId: "world-1", cycle: 1, matchId: null, eventSeq: 7, eventType: "match.settled", stateHash: "a".repeat(64), rulebookVersion: "1.0.0", visibility: "public" };
const base = () => registerAgent(createHeartbeatState(), { agentId: "content-forge", role: "creator", capabilities: ["observe"], heartbeatIntervalMs: 1_000, now: "2026-10-06T00:00:00.000Z" });

describe("world agent heartbeat", () => {
  it("emits an observation only when due and advances nextDueAt", () => {
    const state = base();
    expect(runAgentHeartbeat(state, "content-forge", { now: "2026-10-06T00:00:00.500Z", worldId: "world-1", eventRefs: [event] }).emitted).toHaveLength(0);
    const result = runAgentHeartbeat(state, "content-forge", { now: "2026-10-06T00:00:01.000Z", worldId: "world-1", eventRefs: [event] });
    expect(result.emitted[0]).toMatchObject({ kind: "observation", worldId: "world-1" });
    expect(result.state.agents["content-forge"].nextDueAt).toBe("2026-10-06T00:00:02.000Z");
  });
  it("is idempotent and keeps a proposal draft without publish capability", () => {
    const state = base(); const input = { now: "2026-10-06T00:00:01.000Z", worldId: "world-1", eventRefs: [event], action: "propose" as const, proposal: { type: "lore" as const, title: "Echo", description: "A candidate" } };
    const first = runAgentHeartbeat(state, "content-forge", input); const replay = runAgentHeartbeat(first.state, "content-forge", input);
    expect(first.emitted[0]).toMatchObject({ status: "draft", audit: { capabilityDecision: "draft-only" } }); expect(replay.emitted).toHaveLength(0);
  });
  it("supports pause and resume", () => { const paused = pauseAgent(base(), "content-forge"); expect(runAgentHeartbeat(paused, "content-forge", { now: "2026-10-06T00:00:02.000Z", worldId: "world-1", eventRefs: [event] }).emitted).toHaveLength(0); const resumed = resumeAgent(paused, "content-forge", "2026-10-06T00:00:02.000Z"); expect(runAgentHeartbeat(resumed, "content-forge", { now: "2026-10-06T00:00:02.000Z", worldId: "world-1", eventRefs: [event] }).emitted).toHaveLength(1); });
});

import { describe, expect, it } from "vitest";
import {
  settledAgentMatchFacts,
  summarizeAgentActivities,
} from "./agentActivity";

const dayStart = new Date("2026-10-07T00:00:00.000Z");
const dayEnd = new Date("2026-10-08T00:00:00.000Z");

function settledEvent(matchLogId: number, settledAt: string, rankings: number[]) {
  return {
    version: 1,
    matchLogId,
    defId: "beast-race-core",
    mapperId: "beast-race",
    worldId: "tdg-world",
    epoch: 1,
    settledAt,
    rankings,
    seats: [
      { index: 0, kind: "human", userId: 11, agentKeyId: null },
      { index: 1, kind: "external-agent", userId: 12, agentKeyId: 77 },
    ],
  };
}

describe("agent activity settlement facts", () => {
  it("does not count self-reported victory or darkMatch activity", () => {
    const stats = summarizeAgentActivities(
      [{
        kind: "victory",
        payloadJson: { darkMatch: true, code: "FAKE" },
        occurredAt: dayStart,
      }],
      "2026-10-07",
      [],
      3,
    );

    expect(stats.matches).toBe(0);
    expect(stats.darkMatches).toBe(0);
    expect(stats.victories).toBe(0);
    expect(stats.darkMatchesFulfilled).toBe(false);
    expect(stats.actions).toBe(3);
  });

  it("counts only an in-range settled world event for the registered agent", () => {
    const facts = settledAgentMatchFacts([
      { payloadJson: settledEvent(101, "2026-10-07T04:00:00.000Z", [1, 0]) },
      { payloadJson: settledEvent(102, "2026-10-06T23:59:59.000Z", [1, 0]) },
      { payloadJson: { version: 1, malformed: true } },
    ], 77, dayStart, dayEnd);

    expect(facts).toEqual([{
      matchLogId: 101,
      defId: "beast-race-core",
      settledAt: new Date("2026-10-07T04:00:00.000Z"),
      seat: 1,
      result: "win",
    }]);

    const stats = summarizeAgentActivities([], "2026-10-07", facts);
    expect(stats.matches).toBe(1);
    expect(stats.darkMatches).toBe(1);
    expect(stats.victories).toBe(1);
    expect(stats.remainingDarkMatches).toBe(2);
  });

  it("deduplicates repeated settlement facts by match log", () => {
    const fact = {
      matchLogId: 103,
      defId: "guess-core",
      settledAt: dayStart,
      seat: 1,
      result: "loss" as const,
    };
    const stats = summarizeAgentActivities([], "2026-10-07", [fact, fact]);
    expect(stats.matches).toBe(1);
    expect(stats.darkMatches).toBe(1);
    expect(stats.victories).toBe(0);
  });
});

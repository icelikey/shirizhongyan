import { describe, expect, it } from "vitest";
import { aggregateWorldEpoch, makeWorldSnapshot, proposeWorldMerge, type WorldContribution } from "./worldEmergence";

const contribution = (overrides: Partial<WorldContribution>): WorldContribution => ({
  eventId: `event-${overrides.participantRef ?? "x"}-${overrides.gameId ?? "guess"}`,
  contributionKey: `contribution-${overrides.participantRef ?? "x"}-${overrides.gameId ?? "guess"}`,
  worldId: "world-a",
  epoch: 1,
  participantRef: "p-1",
  participantKind: "agent",
  gameId: "guess-core",
  direction: "memory",
  weight: 1,
  evidenceRefs: ["match-1"],
  clueId: null,
  committedAt: "2026-09-24T00:00:00.000Z",
  ...overrides,
});

describe("world emergence", () => {
  it("deduplicates retries and lets a quorum move the world direction", () => {
    const events = [
      contribution({ participantRef: "p-1", gameId: "guess-core", direction: "memory" }),
      contribution({ participantRef: "p-1", gameId: "guess-core", direction: "rupture", eventId: "retry-1", contributionKey: "retry-key" }),
      contribution({ participantRef: "p-2", gameId: "pirate-gold-core", direction: "memory" }),
      contribution({ participantRef: "p-3", gameId: "poll-duel-core", direction: "memory" }),
    ];
    const snapshot = aggregateWorldEpoch(events, { direction: "law", publicAnchors: [], truthShards: [] });
    expect(snapshot.contributionsAccepted).toBe(3);
    expect(snapshot.uniqueParticipants).toBe(3);
    expect(snapshot.direction).toBe("memory");
  });

  it("does not confirm a clue from one game or one participant", () => {
    const snapshot = aggregateWorldEpoch([
      contribution({ participantRef: "p-1", clueId: "door", evidenceRefs: ["match-1"] }),
      contribution({ participantRef: "p-2", clueId: "door", evidenceRefs: ["match-2"] }),
      contribution({ participantRef: "p-3", clueId: null }),
    ]);
    expect(snapshot.truthShards[0]?.status).toBe("rumor");
  });

  it("creates a merge proposal and blocks incompatible rule versions", () => {
    const left = makeWorldSnapshot({ worldId: "world-a", ruleVersion: "tdg-wp-0.1", epoch: 2, direction: "memory", publicAnchors: ["direction:memory", "gate:12"], truthShards: [] });
    const right = makeWorldSnapshot({ worldId: "world-b", ruleVersion: "tdg-wp-0.1", epoch: 3, direction: "memory", publicAnchors: ["direction:memory", "gate:24"], truthShards: [] });
    const proposal = proposeWorldMerge(left, right);
    expect(proposal.status).toBe("compatible");
    expect(proposal.sharedAnchors).toContain("direction:memory");
    expect(proposal.targetEpoch).toBe(4);
  });
});

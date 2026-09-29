import { describe, expect, it } from "vitest";
import { mapMatchWorldContributions } from "./worldEmergence";
import type { GameDefinition } from "@contracts/gameSdk";

const seats = [
  { index: 0, kind: "human" as const, userId: 10, agentKeyId: null },
  { index: 1, kind: "external-agent" as const, userId: 10, agentKeyId: 22 },
  { index: 2, kind: "echo-bot" as const, userId: null, agentKeyId: null },
];

const def: GameDefinition = {
  id: "poll-duel-core",
  name: "测试票决",
  template: "pollDuel",
  seats: 3,
  isOfficial: true,
  params: { rounds: 1, choices: ["红", "蓝"], payoff: "minority-wins", scoreWin: 2 },
  entryFee: { suit: "heart", amount: 0 },
  rewards: { winner: 1, runnerUp: 0, participation: 0 },
  submitWindowSec: 10,
  worldContributionMapperId: "poll-duel/v1",
};

describe("GamePackage 世界贡献映射", () => {
  it("固定 mapper 版本、过滤 echo-bot，并保留 Agent 身份类别", () => {
    const contributions = mapMatchWorldContributions({
      def,
      matchLogId: 77,
      seats,
      rankings: [1, 0, 2],
      worldId: "world-test",
      epoch: 9,
      committedAt: "2026-09-29T00:00:00.000Z",
    });

    expect(contributions).toHaveLength(2);
    expect(contributions[0]).toMatchObject({
      eventId: "match-77:world:0",
      participantRef: "human:10",
      participantKind: "human",
      direction: "voice",
      epoch: 9,
    });
    expect(contributions[1]).toMatchObject({
      eventId: "match-77:world:1",
      participantRef: "agent:22",
      participantKind: "agent",
      direction: "voice",
    });
  });
});

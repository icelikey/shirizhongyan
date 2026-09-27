import { describe, expect, it } from "vitest";
import { actionScopeForGameAction, scopeContains } from "./worldCoi";

const grant = {
  scope: { worldIds: ["tdg-world"], gameIds: ["superpowerBilliards"], matchIds: ["ABC123"], floorRange: [1, 12] as [number, number] },
  readScopes: ["own_observation"] as const,
  actionScopes: ["submit_move", "use_ability"] as const,
  publishScopes: ["daily_report"] as const,
};

describe("world CoI", () => {
  it("maps game actions to bounded permissions", () => {
    expect(actionScopeForGameAction({ type: "ability" })).toBe("use_ability");
    expect(actionScopeForGameAction({ type: "speak" })).toBe("speak");
    expect(actionScopeForGameAction({ type: "strike" })).toBe("submit_move");
    expect(scopeContains({ ...grant, actionScopes: ["rule_appeal"] }, { worldId: "tdg-world", gameId: "superpowerBilliards", matchId: "ABC123", floor: 6, action: "rule_appeal" })).toBe(true);
  });

  it("requires the same world, game, match, floor and scope", () => {
    expect(scopeContains(grant, { worldId: "tdg-world", gameId: "superpowerBilliards", matchId: "ABC123", floor: 6, action: "use_ability" })).toBe(true);
    expect(scopeContains(grant, { worldId: "tdg-world", gameId: "guess-core", matchId: "ABC123", floor: 6, action: "use_ability" })).toBe(false);
    expect(scopeContains(grant, { worldId: "tdg-world", gameId: "superpowerBilliards", matchId: "ABC123", floor: 20, action: "use_ability" })).toBe(false);
    expect(scopeContains(grant, { worldId: "tdg-world", gameId: "superpowerBilliards", matchId: "ABC123", floor: 6, action: "speak" })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  TACTIC_CARDS,
  getTacticCard,
  tacticCardsByEffect,
  tacticCardsForGame,
  validateTacticLoadout,
} from "./tacticCards";

describe("终焉策略卡", () => {
  it("每张卡都有唯一 id、规则钩子和可审计的使用边界", () => {
    const ids = TACTIC_CARDS.map(card => card.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(TACTIC_CARDS.length).toBeGreaterThanOrEqual(8);
    expect(TACTIC_CARDS.every(card => card.ruleHook.length > 0)).toBe(true);
    expect(TACTIC_CARDS.every(card => card.charges >= 1 && card.cooldown >= 0)).toBe(true);
    expect(TACTIC_CARDS.every(card => card.compatibleGames.length > 0)).toBe(true);
  });

  it("覆盖照底、换底和取消异能三类核心策略", () => {
    expect(getTacticCard("tactic-bottom-eye")?.effect).toBe("peek-private-commitment");
    expect(getTacticCard("tactic-bottom-exchange")?.effect).toBe("swap-private-commitment");
    expect(tacticCardsByEffect("suppress-pending-ability").length).toBeGreaterThanOrEqual(2);
  });

  it("按游戏筛出合法卡池，并保留 all 通用卡", () => {
    const billiards = tacticCardsForGame("superpowerBilliards");
    const debate = tacticCardsForGame("debate");

    expect(billiards.some(card => card.id === "tactic-extra-breath")).toBe(true);
    expect(billiards.some(card => card.id === "tactic-counterseal")).toBe(true);
    expect(debate.some(card => card.id === "tactic-bottom-exchange")).toBe(true);
    expect(debate.some(card => card.id === "tactic-counterseal")).toBe(false);
  });

  it("拒绝不适用的策略卡和重复效果堆叠", () => {
    const result = validateTacticLoadout({
      game: "superpowerBilliards",
      cardIds: [
        "tactic-bottom-exchange",
        "tactic-silent-needle",
        "tactic-counterseal",
      ],
      maxCards: 6,
      version: "1.0",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.includes("不适用于"))).toBe(true);
  });
});

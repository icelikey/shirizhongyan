import { describe, expect, it } from "vitest";
import { beastRaceModule, raceActionCandidates } from "./beastRace";

describe("beastRace SDK 内容包适配器", () => {
  it("由 seed 初始化并只暴露合法候选", () => {
    const state = beastRaceModule.initMatchState("sdk-seed", 2);
    const actions = raceActionCandidates(state, 0);
    expect(actions.length).toBeGreaterThan(0);
    expect(() => beastRaceModule.normalizeSubmission(state, 0, actions[0])).not.toThrow();
    expect(() => beastRaceModule.normalizeSubmission(state, 0, { cardId: "invalid" })).toThrow();
  });

  it("超时和 bot 都从同一候选集合取动作", () => {
    const state = beastRaceModule.initMatchState("bot-seed", 3);
    const candidates = raceActionCandidates(state, 1);
    const timeout = beastRaceModule.timeoutFallback(state, 1);
    const bot = beastRaceModule.botPick(state, 1, 3.2);
    expect(candidates).toContainEqual(timeout);
    expect(candidates).toContainEqual(bot);
  });

  it("结算返回可回放事件、高光与确定性得分", () => {
    const state = beastRaceModule.initMatchState("round-seed", 2);
    const entries = state.racers.map((r, seat) => ({
      seat,
      order: seat,
      action: beastRaceModule.timeoutFallback(state, seat),
    }));
    const first = beastRaceModule.resolveRound(state, 1, entries);
    const replay = beastRaceModule.resolveRound(
      beastRaceModule.initMatchState("round-seed", 2),
      1,
      entries,
    );
    expect(first.events.length).toBeGreaterThan(0);
    expect(first.reveal.events).toEqual(first.events);
    expect(first.reveal.highlights).toEqual(first.highlights);
    expect(first).toEqual(replay);
  });

  it("反照链可产生反击高光", () => {
    const state = beastRaceModule.initMatchState("counter-seed", 2);
    const attacker = state.racers[0];
    const defender = state.racers[1];
    const riposte = defender.hand.find(id => id.endsWith("r1"))!;
    const disrupt = attacker.hand.find(id => id.endsWith("d1"))!;
    const result = beastRaceModule.resolveRound(state, 1, [
      { seat: 0, order: 0, action: { cardId: disrupt, targetSeat: 1 } },
      { seat: 1, order: 1, action: { cardId: riposte } },
    ]);
    expect(result.events.some(e => e.note.includes("反照"))).toBe(true);
    expect(result.highlights.some(h => h.kind === "counter")).toBe(true);
  });
});

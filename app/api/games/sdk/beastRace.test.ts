import { describe, expect, it } from "vitest";
import { beastRaceModule, beastRaceTemplateModule, raceActionCandidates } from "./beastRace";

describe("beastRace SDK 内容包适配器", () => {
  it("由 seed 初始化并只暴露合法候选", () => {
    for (let seats = 2; seats <= 6; seats += 1) {
      const state = beastRaceModule.initMatchState("sdk-seed", seats);
      expect(state.racers).toHaveLength(seats);
      const actions = raceActionCandidates(state, 0);
      expect(actions.length).toBeGreaterThan(0);
      expect(() => beastRaceModule.normalizeSubmission(state, 0, actions[0])).not.toThrow();
      expect(() => beastRaceModule.normalizeSubmission(state, 0, { cardId: "invalid" })).toThrow();
    }
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

  it("TemplateModule 适配器支持合法 play、超时兜底、bot 与确定性 resolve", () => {
    const def = { template: "beastRace", id: "beast", seats: 2, params: { rounds: 8, trackLength: 100, handSize: 8 } } as never;
    const state = beastRaceTemplateModule.initMatchState!(def, 2, "template-seed") as ReturnType<typeof beastRaceModule.initMatchState>;
    const action = beastRaceModule.timeoutFallback(state, 0);
    const normalized = beastRaceTemplateModule.normalizeStructuredSubmission!(def, { type: "play", cardId: action.cardId, ...(action.targetSeat === undefined ? {} : { targetSeat: action.targetSeat }) });
    expect(normalized).toEqual({ value: 0, payload: { kind: "beastRace", action } });
    expect(beastRaceTemplateModule.normalizeSubmission(def, { type: "play", cardId: action.cardId })).toBe(0);
    expect(beastRaceTemplateModule.timeoutFallback(def, 0)).toBe(0);
    expect(beastRaceTemplateModule.botPickStructured!(def, 1, 2.4, [], undefined, state)).not.toBeNull();
    const entries = state.racers.map((r, seat) => ({ seat, order: seat, value: 0, payload: { kind: "beastRace", action: beastRaceModule.timeoutFallback(state, seat) } }));
    const first = beastRaceTemplateModule.resolveRound(def, 1, entries, state);
    const replayState = beastRaceModule.initMatchState("template-seed", 2);
    const replay = beastRaceTemplateModule.resolveRound(def, 1, entries, replayState);
    expect(first).toEqual(replay);
    expect(first.finished).toBe(false);
  });
});

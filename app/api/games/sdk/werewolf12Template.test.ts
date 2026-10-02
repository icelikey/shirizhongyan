import { describe, expect, it } from "vitest";
import { werewolf12TemplateModule } from "./werewolf12Template";
import { createWerewolf12Match } from "@contracts/werewolf12";

describe("werewolf12 TemplateModule", () => {
  it("固定十二席并将夜昼子阶段推进到下一日", () => {
    const def = {
      id: "werewolf-12-core",
      template: "werewolf",
      seats: 12,
      params: { rounds: 12, wolfSeats: 4, nightWindowSec: 45, dayWindowSec: 90 },
    } as never;
    const state = werewolf12TemplateModule.initMatchState!(def, 12, "wolf-template-seed") as ReturnType<typeof createWerewolf12Match>;
    const phases = werewolf12TemplateModule.phasesForRound!(def, 1, state);
    expect(phases).toHaveLength(6);
    expect(phases.every(phase => phase.eligibleSeats.length === 12)).toBe(true);

    entriesOrder = 0;
    const entries = phases.flatMap(phase => phase.eligibleSeats.map(seat => {
      const picked = werewolf12TemplateModule.botPickStructured!(def, seat, 2.4, [], phase.name, state);
      return {
        seat,
        value: 0,
        order: entriesOrder++,
        phase: phase.name,
        payload: picked && typeof picked === "object" ? picked.payload : { kind: "werewolf12", action: { type: "pass" } },
      };
    }));
    const result = werewolf12TemplateModule.resolveRound(def, 1, entries, state);
    expect(result.reveal).toBeTruthy();
    expect((state as ReturnType<typeof createWerewolf12Match>).day).toBeGreaterThanOrEqual(1);
  });

  it("只接受公共 play 动作翻译出的狼人杀载荷", () => {
    const def = { template: "werewolf", id: "wolf", seats: 12, params: {} } as never;
    expect(werewolf12TemplateModule.normalizeStructuredSubmission!(def, { type: "play", cardId: "wolf-kill-3" })).toEqual({
      value: 0,
      payload: { kind: "werewolf12", action: { type: "wolfKill", target: 3 } },
    });
    expect(werewolf12TemplateModule.normalizeStructuredSubmission!(def, { type: "submit", value: 1 })).toBeNull();
  });
});

let entriesOrder = 0;

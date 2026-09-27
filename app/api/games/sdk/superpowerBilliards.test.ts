import { describe, expect, it } from "vitest";
import type { SuperpowerBilliardsDefinition } from "@contracts/gameSdk";
import { superpowerBilliardsModule } from "./superpowerBilliards";
import type { BilliardsMatchState } from "@contracts/superpowerBilliards";

const DEF: SuperpowerBilliardsDefinition = {
  id: "test-billiards",
  name: "测试巫蛊娃娃",
  template: "superpowerBilliards",
  seats: 2,
  isOfficial: false,
  params: { rounds: 8, balls: 6, pockets: 4, lives: 2, pocketPenalty: 8, hitScore: 15, comboBonus: 10 },
  entryFee: { suit: "spade", amount: 0 },
  rewards: { winner: 20, runnerUp: 10, participation: 2 },
  submitWindowSec: 30,
};

describe("superpower billiards module", () => {
  it("exposes two deterministic action phases and validates structured actions", () => {
    const state = superpowerBilliardsModule.initMatchState!(DEF, 2) as BilliardsMatchState;
    expect(superpowerBilliardsModule.phasesForRound!(DEF, 1, state)).toEqual([
      { name: "strike", eligibleSeats: [0, 1] },
      { name: "ability", eligibleSeats: [0, 1] },
    ]);
    const strike = superpowerBilliardsModule.normalizeStructuredSubmission!(DEF, {
      type: "strike", ballId: "doll-01", angle: 0.4, power: 0.7,
    });
    expect(strike).toMatchObject({ value: 0, payload: { kind: "strike", ballId: "doll-01" } });
    const ability = superpowerBilliardsModule.normalizeStructuredSubmission!(DEF, {
      type: "ability", abilityId: "return-soul", decision: "reflect", targetBall: "doll-01",
    });
    expect(ability).toMatchObject({ value: 0, payload: { kind: "ability", decision: "reflect" } });
  });

  it("replays the same strike and ability inputs to the same reveal", () => {
    const makeState = () => superpowerBilliardsModule.initMatchState!(DEF, 2) as BilliardsMatchState;
    const entries = [
      { seat: 0, value: 0, order: 0, phase: "strike", payload: { kind: "strike", phase: "strike", ballId: "doll-01", angle: 0.1, power: 0.8 } },
      { seat: 1, value: 0, order: 1, phase: "strike", payload: { kind: "strike", phase: "strike", ballId: "doll-02", angle: 3.0, power: 0.7 } },
      { seat: 0, value: 0, order: 2, phase: "ability", payload: { kind: "ability", phase: "ability", abilityId: "return-soul", decision: "reflect", targetBall: "doll-01" } },
      { seat: 1, value: 0, order: 3, phase: "ability", payload: { kind: "ability", phase: "ability", abilityId: "right-angle", decision: "right_angle", targetBall: "doll-02" } },
    ];
    const a = superpowerBilliardsModule.resolveRound(DEF, 1, entries, makeState()).reveal as { round: number; strikes: { ballId: string }[]; abilities: { accepted: boolean }[] };
    const b = superpowerBilliardsModule.resolveRound(DEF, 1, entries, makeState()).reveal as typeof a;
    expect(b).toEqual(a);
    expect(a.round).toBe(1);
    expect(a.strikes[0].ballId).toBe("doll-01");
    expect(a.abilities[0].accepted).toBe(false);
  });

  it("never accepts an ability proposed for another player's doll", () => {
    const state = superpowerBilliardsModule.initMatchState!(DEF, 2) as BilliardsMatchState;
    const result = superpowerBilliardsModule.resolveRound(DEF, 1, [
      { seat: 0, value: 0, order: 0, phase: "strike", payload: { kind: "strike", phase: "strike", ballId: "doll-01", angle: 0, power: 0.5 } },
      { seat: 0, value: 0, order: 1, phase: "ability", payload: { kind: "ability", phase: "ability", abilityId: "return-soul", decision: "reflect", targetBall: "doll-02" } },
    ], state).reveal as { abilities: { accepted: boolean; reason: string }[] };
    expect(result.abilities[0].accepted).toBe(false);
    expect(result.abilities[0].reason).toContain("自己的");
  });

  it("accepts phase-walk from the same round's strike when the launch speed passes the threshold", () => {
    const state = superpowerBilliardsModule.initMatchState!(DEF, 2) as BilliardsMatchState;
    const result = superpowerBilliardsModule.resolveRound(DEF, 1, [
      { seat: 0, value: 0, order: 0, phase: "strike", payload: { kind: "strike", phase: "strike", ballId: "doll-03", angle: 0.2, power: 0.7 } },
      { seat: 0, value: 0, order: 1, phase: "ability", payload: { kind: "ability", phase: "ability", abilityId: "phase-walk", decision: "phase_walk", targetBall: "doll-03" } },
    ], state).reveal as { abilities: { accepted: boolean; reason: string }[] };
    expect(result.abilities[0].accepted).toBe(true);
    expect(result.abilities[0].reason).toContain("已由内核执行");
  });
});

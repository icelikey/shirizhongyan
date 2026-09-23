import { describe, expect, it } from "vitest";
import { createDebateState } from "@contracts/debate";
import { DEBATE_PARAMS, RULE_DEBATE_RULEBOOK } from "@contracts/debate.data";
import {
  adaptPublicGameAction,
  DebateActionError,
  finishDebateRound,
  submitDebateAction,
} from "./debate";

function proposal(seat: number, clauseId = "c-debate-timeout") {
  return {
    type: "proposal" as const,
    proposal: {
      seat,
      clauseId,
      position: "amend" as const,
      operation: "clarify" as const,
      argument: "这是一段足够具体、可以被裁判验证的结构化规则论据。",
    },
  };
}

describe("规则辩论 SDK 模板", () => {
  it("多方提案在回合结束生成候选结果并由本地裁判完成降级判定", async () => {
    let state = createDebateState(RULE_DEBATE_RULEBOOK, [0, 1, 2]);
    state = submitDebateAction(state, proposal(0), DEBATE_PARAMS);
    state = submitDebateAction(state, proposal(1), DEBATE_PARAMS);
    state.phase = "ruling";
    const result = await finishDebateRound(state, DEBATE_PARAMS);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].ruling.ballots).toHaveLength(3);
    expect(result.candidates[0].ruling.appliesFromRound).toBe(2);
    expect(result.settled).toBe(false);
  });

  it("拒绝核心条款与重复提案", () => {
    let state = createDebateState(RULE_DEBATE_RULEBOOK, [0, 1]);
    expect(() =>
      submitDebateAction(state, proposal(0, "c-debate-scoring"), DEBATE_PARAMS),
    ).toThrow(DebateActionError);
    state = submitDebateAction(state, proposal(0), DEBATE_PARAMS);
    expect(() => submitDebateAction(state, proposal(0), DEBATE_PARAMS)).toThrow(
      /只能提交一份/,
    );
  });

  it("通过现有 speak 动作只接受 JSON 结构化适配", () => {
    expect(adaptPublicGameAction({ type: "speak", text: "随便说一句" })).toBeNull();
    expect(
      adaptPublicGameAction({
        type: "speak",
        text: JSON.stringify(proposal(0)),
      }),
    ).toEqual(proposal(0));
  });
});

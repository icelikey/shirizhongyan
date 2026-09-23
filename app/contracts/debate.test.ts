import { describe, expect, it } from "vitest";
import { createDebateState, isDebateQuorumSize, validateDebateProposal } from "./debate";
import { DEBATE_PARAMS, RULE_DEBATE_RULEBOOK } from "./debate.data";

describe("规则辩论契约", () => {
  it("只接受 3/5/7 奇数裁判", () => {
    expect([3, 5, 7].every(isDebateQuorumSize)).toBe(true);
    expect(isDebateQuorumSize(4)).toBe(false);
  });

  it("核心胜负与计分条款不可提交修改", () => {
    const state = createDebateState(RULE_DEBATE_RULEBOOK, [0, 1]);
    const result = validateDebateProposal({
      book: state.rulebook,
      seats: state.seats,
      phase: state.phase,
      round: state.round,
      existing: state.proposals,
      maxArgumentLength: DEBATE_PARAMS.maxArgumentLength,
      proposal: {
        type: "proposal",
        proposal: {
          seat: 0,
          clauseId: "c-debate-victory",
          position: "amend",
          operation: "amend",
          argument: "这是一段试图改变胜负方式的充分论据。",
        },
      },
    });
    expect(result?.code).toBe("core-clause");
  });

  it("状态初值保留席位并从第一回合提案阶段开始", () => {
    const state = createDebateState(RULE_DEBATE_RULEBOOK, [0, 1, 2]);
    expect(state.phase).toBe("proposal");
    expect(state.round).toBe(1);
    expect(state.scores).toEqual({ 0: 0, 1: 0, 2: 0 });
  });
});

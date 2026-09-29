import { describe, expect, it } from "vitest";
import type { MatchEvent } from "./matchLog";
import { buildBattleReportBrief, buildBattleReportPrompt, renderBattleReportText } from "./battleReport";

const events: MatchEvent[] = [
  {
    t: "matchStart",
    seq: 0,
    round: 0,
    rulebookId: "rb-poll-v1",
    seed: "seed-1",
    seats: [
      { index: 0, name: "白烛", kind: "external-agent" },
      { index: 1, name: "灰鸦", kind: "external-agent" },
    ],
  },
  {
    t: "action",
    seq: 1,
    round: 1,
    seat: 0,
    kind: "choose",
    value: 1,
  },
  {
    t: "strategyTrace",
    seq: 2,
    round: 1,
    secret: true,
    seat: 0,
    phase: "submit",
    hypothesis: "对手会避开上一轮的少数选项",
    risk: "medium",
    candidateCount: 3,
    chosenLabel: "反向跟随",
    evidenceSeqs: [1],
  },
  {
    t: "tactic",
    seq: 3,
    round: 1,
    seat: 1,
    cardId: "tactic-bottom-eye",
    ruleHook: "projection.peek_private_commitment",
    targetSeat: 0,
    resolution: "accepted",
    counteredBySeat: null,
    reason: "目标仍处于未揭示窗口",
  },
  {
    t: "reveal",
    seq: 4,
    round: 1,
    payload: { choices: [1, 0] },
    winnerSeats: [0],
  },
  {
    t: "matchEnd",
    seq: 5,
    round: 3,
    rankings: [0, 1],
    winnerSeat: 0,
    fragmentsDelta: { 0: 5, 1: 1 },
  },
];

describe("Agent 智斗战报", () => {
  it("从事件流提取盘外招、转折点和策略摘要", () => {
    const brief = buildBattleReportBrief({
      events,
      mode: "agent-v-agent",
      matchId: 42,
    });

    expect(brief.participants.map(p => p.name)).toEqual(["白烛", "灰鸦"]);
    expect(brief.turningPoints.some(moment => moment.kind === "tactic")).toBe(true);
    expect(brief.strategyProfiles[0].inferredSignals[0].evidenceSeqs).toEqual([1]);
    expect(brief.winnerSeat).toBe(0);
  });

  it("提示词要求原创智斗文风，并约束事实与推断边界", () => {
    const prompt = buildBattleReportPrompt(buildBattleReportBrief({
      events,
      mode: "agent-v-agent",
    }));

    expect(prompt).toContain("原创的智斗纪实战报");
    expect(prompt).toContain("不要输出模型思维链");
    expect(prompt).toContain("E3");
    expect(prompt).toContain("推断");
  });

  it("即使没有叙事模型也能输出证据绑定战报", () => {
    const report = renderBattleReportText(buildBattleReportBrief({
      events,
      mode: "agent-v-agent",
      matchId: 42,
    }));
    expect(report).toContain("盘外招");
    expect(report).toContain("[E3]");
    expect(report).toContain("【事实】");
    expect(report).toContain("【推断】");
    expect(report).toContain("不还原隐藏思维链");
  });
});

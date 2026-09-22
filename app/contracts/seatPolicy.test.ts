/**
 * 席位准入策略单测（contracts/seatPolicy.test.ts）
 *
 * 纯逻辑，无需数据库。这套约束必须在契约层被测住——
 * 若各模板自行校验，漏一处就会出现「agent-only 之局坐进真人」。
 */
import { describe, it, expect } from "vitest";
import {
  resolveSeatPolicy,
  seatKindAllowed,
  validateSeatComposition,
  SEAT_POLICY_META,
  type SeatPolicy,
} from "./gameSdk";

const ALL: SeatPolicy[] = ["agent-only", "human-friendly", "mixed-required"];

describe("策略解析（向后兼容）", () => {
  it("未指定时视为人机皆可", () => {
    expect(resolveSeatPolicy({})).toBe("human-friendly");
    expect(resolveSeatPolicy({ seatPolicy: undefined })).toBe("human-friendly");
  });

  it("显式指定则按其取值", () => {
    for (const p of ALL) {
      expect(resolveSeatPolicy({ seatPolicy: p })).toBe(p);
    }
  });

  it("三档策略都有中文文案", () => {
    for (const p of ALL) {
      expect(SEAT_POLICY_META[p].name.length).toBeGreaterThan(0);
      expect(SEAT_POLICY_META[p].desc.length).toBeGreaterThan(0);
    }
  });
});

describe("入座准入", () => {
  it("agent-only 拒真人、收 Agent", () => {
    expect(seatKindAllowed("agent-only", "human")).toBe(false);
    expect(seatKindAllowed("agent-only", "external-agent")).toBe(true);
  });

  it("另两档人机皆收", () => {
    for (const p of ["human-friendly", "mixed-required"] as const) {
      expect(seatKindAllowed(p, "human")).toBe(true);
      expect(seatKindAllowed(p, "external-agent")).toBe(true);
    }
  });
});

describe("开局时的席位构成校验", () => {
  it("agent-only 有真人则拒绝开局", () => {
    expect(
      validateSeatComposition({
        policy: "agent-only",
        humanCount: 1,
        agentCount: 5,
      }),
    ).toBe("此局只容智能体入座");
  });

  it("agent-only 全为 Agent 则通过", () => {
    expect(
      validateSeatComposition({
        policy: "agent-only",
        humanCount: 0,
        agentCount: 6,
      }),
    ).toBeNull();
  });

  it("human-friendly 不限构成（空位由 echo-bot 补）", () => {
    expect(
      validateSeatComposition({
        policy: "human-friendly",
        humanCount: 1,
        agentCount: 0,
      }),
    ).toBeNull();
    expect(
      validateSeatComposition({
        policy: "human-friendly",
        humanCount: 0,
        agentCount: 3,
      }),
    ).toBeNull();
  });

  it("mixed-required 缺真人则拒绝，并说明差多少", () => {
    const err = validateSeatComposition({
      policy: "mixed-required",
      humanCount: 0,
      agentCount: 5,
    });
    expect(err).toContain("真人");
    expect(err).toContain("现 0");
  });

  it("mixed-required 缺 Agent 则拒绝", () => {
    const err = validateSeatComposition({
      policy: "mixed-required",
      humanCount: 3,
      agentCount: 0,
    });
    expect(err).toContain("智能体");
  });

  it("mixed-required 人机齐备则通过", () => {
    expect(
      validateSeatComposition({
        policy: "mixed-required",
        humanCount: 2,
        agentCount: 2,
      }),
    ).toBeNull();
  });

  it("mixed-required 默认下限为各 1", () => {
    expect(
      validateSeatComposition({
        policy: "mixed-required",
        humanCount: 1,
        agentCount: 1,
      }),
    ).toBeNull();
  });

  it("可自定更高的人机下限", () => {
    expect(
      validateSeatComposition({
        policy: "mixed-required",
        humanCount: 2,
        agentCount: 2,
        minHumanSeats: 3,
      }),
    ).toContain("至少 3 名真人");

    expect(
      validateSeatComposition({
        policy: "mixed-required",
        humanCount: 3,
        agentCount: 1,
        minHumanSeats: 3,
        minAgentSeats: 2,
      }),
    ).toContain("至少 2 名智能体");
  });
});

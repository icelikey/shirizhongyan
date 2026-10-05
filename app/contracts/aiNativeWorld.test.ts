import { describe, expect, it } from "vitest";
import {
  assertSameProjectionWorld,
  hasMonotonicEventSeq,
  narrativeReportSchema,
  projectionCursorSchema,
  type NarrativeReport,
} from "./aiNativeWorld";

const hash = "a".repeat(64);
const ref = { worldId: "world-a", cycle: 1, matchId: "match-a", eventSeq: 3, eventType: "reveal", stateHash: hash, rulebookVersion: "v1.0.0", visibility: "public" as const };
const baseReport = (eventSeq: number): NarrativeReport => ({
  contractVersion: "1.0.0", reportId: `report-${eventSeq}`, world: ref, planId: "plan-1", title: "战报", body: "事实正文",
  claims: [{ text: "事件已经揭晓", kind: "fact", evidence: [ref] }], eventRefs: [ref], stateHash: hash, eventSeq,
  rulebookVersion: "v1.0.0", projectionVersion: "v1.0.0", visibility: "public",
});

describe("AI 原生双投影契约", () => {
  it("无证据的叙事声明不能通过", () => {
    const report = { ...baseReport(3), claims: [{ text: "有人暗中改变了结果", kind: "fact" as const, evidence: [] }] };
    expect(narrativeReportSchema.safeParse(report).success).toBe(false);
  });

  it("投影游标不能跨世界", () => {
    const cursor = projectionCursorSchema.parse({ contractVersion: "1.0.0", worldId: "world-a", projection: "text", eventSeq: 3, stateHash: hash, rulebookVersion: "v1.0.0", projectionVersion: "v1.0.0" });
    expect(() => assertSameProjectionWorld(cursor, "world-b")).toThrow();
  });

  it("报告事件序号必须单调递增", () => {
    expect(hasMonotonicEventSeq([baseReport(1), baseReport(2), baseReport(4)])).toBe(true);
    expect(hasMonotonicEventSeq([baseReport(1), baseReport(1)])).toBe(false);
  });
});

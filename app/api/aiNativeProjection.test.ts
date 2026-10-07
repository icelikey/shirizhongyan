import { describe, expect, it } from "vitest";
import { AiNativeProjectionCoordinator } from "./aiNativeProjection";

const hash = (digit: string) => digit.repeat(64);
const event = (eventSeq: number, stateHash = hash("a")) => ({
  worldId: "world-a", matchId: "match-a", eventSeq, stateHash,
  cycle: 1, eventType: "reveal", rulebookVersion: "v1.0.0", visibility: "public" as const,
  payload: { eventSeq },
});

function coordinator() {
  return new AiNativeProjectionCoordinator({ worldId: "world-a", matchId: "match-a", rulebookVersion: "v1.0.0" });
}

describe("AI 原生双投影协调器", () => {
  it("按连续序号生成两种投影批次和游标", () => {
    const c = coordinator();
    c.accept(event(0));
    c.accept(event(1, hash("b")));
    const text = c.batch("text");
    const graphic = c.batch("graphic", 0);
    expect(text.events.map(item => item.event.eventSeq)).toEqual([0, 1]);
    expect(graphic.events.map(item => item.event.eventSeq)).toEqual([1]);
    expect(text.cursor).toMatchObject({ projection: "text", eventSeq: 1, stateHash: hash("b") });
    expect(graphic.cursor.projection).toBe("graphic");
  });

  it("重复事件幂等，且输出不会修改原始事件", () => {
    const c = coordinator();
    const original = event(0);
    c.accept(original);
    c.accept({ ...original, payload: { eventSeq: 999 } });
    const batch = c.batch("text");
    (batch.events[0].event as { eventSeq: number }).eventSeq = 99;
    expect(original.eventSeq).toBe(0);
    expect(c.count).toBe(1);
  });

  it.each([
    ["跨世界", { ...event(0), worldId: "world-b" }],
    ["跨比赛", { ...event(0), matchId: "match-b" }],
    ["跳序", event(2)],
    ["错误 hash", { ...event(0), stateHash: "bad" }],
  ])("拒绝%s事件", (_label, invalid) => {
    expect(() => coordinator().accept(invalid)).toThrow();
  });

  it("拒绝相同序号但状态哈希不同的重复事件", () => {
    const c = coordinator();
    c.accept(event(0));
    expect(() => c.accept(event(0, hash("b")))).toThrow();
  });
});

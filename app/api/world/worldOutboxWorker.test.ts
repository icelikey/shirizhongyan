import { describe, expect, it, vi } from "vitest";
import { processClaimedWorldOutboxRows } from "./worldOutboxWorker";

const row = (overrides: Partial<{
  id: number;
  eventId: string;
  eventType: string;
  payloadJson: unknown;
  attempts: number;
}> = {}) => ({
  id: 1,
  eventId: "event-1",
  eventType: "world.match.settled",
  payloadJson: {},
  attempts: 1,
  ...overrides,
});

describe("world outbox worker", () => {
  it("成功事件只发布一次，并保留批次统计", async () => {
    const published = vi.fn(async () => undefined);
    const failed = vi.fn(async () => undefined);
    const result = await processClaimedWorldOutboxRows([row()], {
      workerId: "worker-a",
      handle: vi.fn(async () => undefined),
      markPublished: published,
      markFailed: failed,
    });

    expect(result).toEqual({ claimed: 1, published: 1, failed: 0 });
    expect(published).toHaveBeenCalledWith({ id: 1, workerId: "worker-a" });
    expect(failed).not.toHaveBeenCalled();
  });

  it("处理失败进入重试路径，并带上当前 attempts", async () => {
    const failed = vi.fn(async () => undefined);
    const result = await processClaimedWorldOutboxRows([row({ attempts: 3 })], {
      workerId: "worker-a",
      handle: vi.fn(async () => { throw new Error("temporary db outage"); }),
      markPublished: vi.fn(async () => undefined),
      markFailed: failed,
    });

    expect(result).toEqual({ claimed: 1, published: 0, failed: 1 });
    expect(failed).toHaveBeenCalledWith({
      id: 1,
      workerId: "worker-a",
      attempts: 3,
      errorMessage: "temporary db outage",
    });
  });
});

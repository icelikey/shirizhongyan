import { describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("./queries/connection", () => ({
  getDb: () => ({ execute }),
}));
vi.mock("./world/worldOutboxWorker", () => ({
  startWorldOutboxWorker: vi.fn(),
}));

import app from "./boot";

describe("云端就绪探针", () => {
  it("数据库可用时返回 200 和数据库检查结果", async () => {
    execute.mockResolvedValueOnce([{ 1: 1 }]);

    const response = await app.request("/api/ready");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "ten-days-gambit",
      checks: { database: true },
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("数据库不可用时返回 503 且不泄漏连接信息", async () => {
    const secret = "mysql://user:password@db.internal:3306/secret";
    execute.mockRejectedValueOnce(new Error(`connect failed: ${secret}`));

    const response = await app.request("/api/ready");
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toBe(
      JSON.stringify({
        ok: false,
        service: "ten-days-gambit",
        checks: { database: false },
      })
    );
    expect(body).not.toContain(secret);
  });
});

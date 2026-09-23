import { describe, expect, it } from "vitest";
import { commandPayloadForHash, commandPayloadHash } from "./commandReceipts";

describe("TDG 命令幂等摘要", () => {
  it("对对象键顺序不敏感，并且不把 commandId 本身纳入动作摘要", () => {
    const first = commandPayloadForHash({
      contextRef: "ctx-1",
      bindingId: "seat-1",
      action: { type: "submit", value: 33 },
    });
    const second = commandPayloadForHash({
      action: { value: 33, type: "submit" },
      bindingId: "seat-1",
      contextRef: "ctx-1",
    });
    expect(commandPayloadHash(first)).toBe(commandPayloadHash(second));
  });

  it("payload 变化时产生不同摘要", () => {
    const first = commandPayloadHash(
      commandPayloadForHash({ contextRef: "ctx-1", action: { type: "submit", value: 33 } }),
    );
    const second = commandPayloadHash(
      commandPayloadForHash({ contextRef: "ctx-1", action: { type: "submit", value: 34 } }),
    );
    expect(first).not.toBe(second);
  });
});

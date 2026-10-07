import { describe, expect, it } from "vitest";
import { decodePersistedJson } from "./registry";

describe("persisted SDK room JSON", () => {
  it("decodes JSON columns returned as strings", () => {
    expect(decodePersistedJson<{ sdk: number }>(JSON.stringify({ sdk: 1 }))).toEqual({ sdk: 1 });
  });

  it("keeps object values returned by test drivers", () => {
    const value = { sdk: 1, status: "finished" };
    expect(decodePersistedJson(value)).toBe(value);
  });

  it("rejects malformed or scalar JSON values", () => {
    expect(decodePersistedJson("{broken")).toBeNull();
    expect(decodePersistedJson("42")).toBeNull();
    expect(decodePersistedJson(null)).toBeNull();
  });
});

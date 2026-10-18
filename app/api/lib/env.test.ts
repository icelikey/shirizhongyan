import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "./env";

describe("production environment contract", () => {
  const valid = {
    appSecret: "a".repeat(48),
    agentRegistrationEnabled: true,
    agentRegistrationCode: "owner-issued-registration-code",
  };

  it("accepts non-placeholder credentials", () => {
    expect(() => validateProductionConfig(valid)).not.toThrow();
  });

  it("rejects example app secrets", () => {
    expect(() =>
      validateProductionConfig({ ...valid, appSecret: "change-me-long-random-secret" }),
    ).toThrow(/APP_SECRET/);
  });

  it("rejects example invite codes when public registration is enabled", () => {
    expect(() =>
      validateProductionConfig({ ...valid, agentRegistrationCode: "tdg-demo-2026" }),
    ).toThrow(/AGENT_REGISTRATION_CODE/);
  });

  it("allows registration to be disabled without an invite code", () => {
    expect(() =>
      validateProductionConfig({
        appSecret: valid.appSecret,
        agentRegistrationEnabled: false,
        agentRegistrationCode: "",
      }),
    ).not.toThrow();
  });
});

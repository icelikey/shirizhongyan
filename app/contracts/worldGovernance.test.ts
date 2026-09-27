import { describe, expect, it } from "vitest";
import { publicWorldGovernance, WORLD_GOVERNANCE } from "./worldGovernance";

describe("world governance", () => {
  it("keeps design authority separate from runtime and settlement authority", () => {
    const roles = new Map(WORLD_GOVERNANCE.authority.map((role) => [role.role, role]));

    expect(roles.get("chief-architect")?.authority).toContain("set_long_term_questions");
    expect(roles.get("heavenly-agent")?.authority).toContain("advance_world_cycle");
    expect(roles.get("deterministic-kernel")?.authority).toContain("settle_game_packages");
    expect(roles.get("chief-architect")?.forbidden).toContain("rewrite_settled_history");
    expect(roles.get("heavenly-agent")?.forbidden).toContain("bypass_deterministic_settlement");
  });

  it("publishes the constitution boundary without exposing secrets", () => {
    const descriptor = publicWorldGovernance();

    expect(descriptor.constitution.principle).toBe("local_optimum_is_not_long_term_optimum");
    expect(descriptor.truthLifecycle).toContain("settled-evidence");
    expect(descriptor.narrativeBoundary).toContain("不能单独创造或改写世界事实");
    expect(JSON.stringify(descriptor)).not.toMatch(/api[-_ ]?key|token|password/i);
  });
});


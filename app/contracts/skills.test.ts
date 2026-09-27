import { describe, expect, it } from "vitest";
import { OFFICIAL_SKILLS, publicSkillCatalog, skillCanRun } from "./skills";
import { buildAgentMemoryContext, createWorldState } from "./worldCycle";

describe("official skill registry", () => {
  it("keeps every official skill bounded to a non-result effect", () => {
    expect(OFFICIAL_SKILLS).toHaveLength(6);
    expect(OFFICIAL_SKILLS.every((skill) => skill.effectScope !== ("result" as never))).toBe(true);
    expect(new Set(OFFICIAL_SKILLS.map((skill) => skill.id)).size).toBe(6);
  });

  it("exposes phase gates and loads the catalog into an agent context", () => {
    expect(skillCanRun("law.peek_clause", "observe")).toBe(true);
    expect(skillCanRun("law.peek_clause", "submit")).toBe(false);
    expect(publicSkillCatalog().every((skill) => skill.allowedPhases.length > 0)).toBe(true);
    expect(buildAgentMemoryContext(createWorldState()).skills.map((skill) => skill.id)).toContain("world.read_anchor");
  });
});

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  assertContentCoverage,
  CONTENT_GAME_ALIASES,
  loadContentPackages,
  loadOfficialContentPackages,
  undeclaredContentFiles,
} from "./runtime";

const contentDir = resolve(process.cwd(), "content");

function canonicalFixture() {
  return {
    schemaVersion: "endings.content.v1",
    contentId: "endings.fixture",
    version: "1.0.0",
    game: { gameId: "guess-core", template: "numberGuess", recordKey: "guess" },
    openingCards: [{ id: "fixture.opening.first", title: "开局", scene: "场景", instruction: "行动" }],
    rules: { phases: ["submit"], ruleRefs: ["c-guess-target"] },
    storyFragments: [{ id: "fixture.story.echo", status: "candidate", text: "碎片", evidenceRefs: ["event:match-start", "c-guess-target"] }],
    clues: [{ id: "fixture.clue.echo", title: "线索", trigger: "触发", evidenceRefs: ["event:match-start"], next: "下一步" }],
    dropTable: { id: "fixture.drops", entries: [{ id: "fixture.drop.memory", type: "memory", rarity: "common", effect: "记忆", weight: 1 }] },
    battleReportTemplate: { id: "fixture.report", humanView: "事实战报", agentView: { sections: ["facts"], mustIncludeEvidenceIds: true } },
    projections: {
      human: { summary: "玩家看到的事实", actions: ["提交合法动作"] },
      agent: { facts: ["公开事件"], legalOptions: ["合法动作"], evidenceRefs: ["event:match-start"], decisionFrame: "规则内决策", doNotInfer: ["不把猜测当事实"] },
    },
    fallback: { human: "规则回退", agent: "结构化回退", generation: "fallback" },
  };
}

function loadFixture(mutate: (fixture: ReturnType<typeof canonicalFixture>) => void) {
  const dir = mkdtempSync(resolve(tmpdir(), "endings-content-"));
  const fixture = canonicalFixture();
  mutate(fixture);
  writeFileSync(resolve(dir, "guess-core.json"), JSON.stringify(fixture));
  writeFileSync(resolve(dir, "manifest.json"), JSON.stringify({
    schemaVersion: "endings.content.v1",
    contentPackageId: "endings-content-v1",
    locale: "zh-CN",
    status: "content-ready",
    games: [{ contentId: fixture.contentId, file: "guess-core.json", gameId: fixture.game.gameId, template: fixture.game.template, recordKey: fixture.game.recordKey, rulebookId: "rb-guess", worldContributionMapperId: "number-guess/v1" }],
  }));
  try {
    return loadContentPackages(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("官方内容包运行时", () => {
  it("加载七个公开游戏内容包并通过稳定 ID 校验", () => {
    const registry = loadOfficialContentPackages(contentDir);
    expect(registry.packages.size).toBe(7);
    expect([...registry.packages.keys()]).toEqual(expect.arrayContaining([
      "guess-core",
      "poll-duel-core",
      "pirate-gold-core",
      "flytease-core",
      "superpower-billiards-core",
      "superpower-race-core",
      "werewolf-12-core",
    ]));
    expect(undeclaredContentFiles(registry, contentDir)).toEqual([]);
  });

  it("暗局和千轮变体复用对应公开内容包", () => {
    const registry = loadOfficialContentPackages(contentDir);
    assertContentCoverage(registry, [
      "guess-mille-core",
      "guess-dark-core",
      "poll-dark-core",
      "flytease-dark-core",
    ]);
    expect(CONTENT_GAME_ALIASES["guess-dark-core"]).toBe("guess-core");
  });

  it("内容包缺少公开游戏时明确失败", () => {
    const registry = loadOfficialContentPackages(contentDir);
    expect(() => assertContentCoverage(registry, ["missing-official-game"])).toThrow("游戏缺少内容包");
  });

  it("旧七包归一化为完整的 M1 内容契约", () => {
    const registry = loadOfficialContentPackages(contentDir);
    for (const pkg of registry.packages.values()) {
      expect(pkg.openingCards.length).toBeGreaterThan(0);
      expect(pkg.rules.phases).toEqual(expect.any(Array));
      expect(pkg.storyFragments.length).toBeGreaterThan(0);
      expect(pkg.dropTable.entries.length).toBe(pkg.dropPool.length);
      expect(pkg.projections.human.actions.length).toBeGreaterThan(0);
      expect(pkg.projections.agent.evidenceRefs.length).toBeGreaterThan(0);
      expect(pkg.fallback.generation).toBe("fallback");
    }
  });

  it.each([
    ["缺少 rules", (fixture: ReturnType<typeof canonicalFixture>) => { delete (fixture as Record<string, unknown>).rules; }],
    ["缺少 agent projection", (fixture: ReturnType<typeof canonicalFixture>) => { delete (fixture.projections as Record<string, unknown>).agent; }],
    ["fallback 声称 generated", (fixture: ReturnType<typeof canonicalFixture>) => { fixture.fallback.generation = "generated" as "fallback"; }],
  ])("启动时拒绝 %s", (_label, mutate) => {
    expect(() => loadFixture(mutate)).toThrow();
  });

  it("拒绝重复和悬空的事件、规则、掉落引用", () => {
    expect(() => loadFixture(fixture => {
      fixture.storyFragments[0].evidenceRefs.push("event:match-start");
    })).toThrow("重复引用");
    expect(() => loadFixture(fixture => {
      fixture.clues[0].evidenceRefs = ["drop:missing"];
    })).toThrow("引用不存在");
  });
});


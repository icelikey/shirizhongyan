import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  assertContentCoverage,
  CONTENT_GAME_ALIASES,
  loadOfficialContentPackages,
  undeclaredContentFiles,
} from "./runtime";

const contentDir = resolve(process.cwd(), "content");

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
});

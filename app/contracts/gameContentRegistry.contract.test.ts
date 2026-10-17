import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OFFICIAL_GAMES } from "../api/games/sdk/registry";

type ContentManifest = {
  games: Array<{
    contentId: string;
    gameId: string;
    template: string;
    worldContributionMapperId: string;
  }>;
};

const loadManifest = (relativePath: string): ContentManifest =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, relativePath), "utf8")) as ContentManifest;

const appManifest = loadManifest("../content/manifest.json");
const docsManifest = loadManifest("../../docs/content/manifest.json");
const publicGameIds = new Set(appManifest.games.map((game) => game.gameId));
const agentOnlyGames = OFFICIAL_GAMES.filter((game) => game.seatPolicy === "agent-only");
const publicGames = OFFICIAL_GAMES.filter((game) => game.seatPolicy !== "agent-only");

const agentBaseById: Record<string, string> = {
  "guess-mille-core": "guess-core",
  "guess-dark-core": "guess-core",
  "poll-dark-core": "poll-duel-core",
  "flytease-dark-core": "flytease-core",
};

const duplicateIds = (ids: string[]): string[] =>
  [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

describe("游戏注册表与内容包契约", () => {
  it("七个公开游戏都能映射到应用和文档内容包", () => {
    expect(publicGames).toHaveLength(7);
    expect(appManifest.games).toHaveLength(7);
    expect(docsManifest.games).toHaveLength(7);

    for (const game of publicGames) {
      const appContent = appManifest.games.find((content) => content.gameId === game.id);
      const docsContent = docsManifest.games.find((content) => content.gameId === game.id);
      expect(appContent, `${game.id} missing from app manifest`).toBeDefined();
      expect(docsContent, `${game.id} missing from docs manifest`).toBeDefined();
      expect(appContent?.template).toBe(game.template);
      expect(appContent?.worldContributionMapperId).toBe(game.worldContributionMapperId);
      expect(docsContent).toEqual(appContent);
    }
    expect(publicGameIds).toEqual(new Set(publicGames.map((game) => game.id)));
  });

  it("四个 Agent-only 变体引用合法的公开基座并保持执行契约", () => {
    expect(agentOnlyGames).toHaveLength(4);
    expect(Object.keys(agentBaseById)).toEqual(expect.arrayContaining(agentOnlyGames.map((game) => game.id)));

    for (const variant of agentOnlyGames) {
      const baseId = agentBaseById[variant.id];
      const base = publicGames.find((game) => game.id === baseId);
      expect(base, `${variant.id} has no public base`).toBeDefined();
      expect(variant.template).toBe(base?.template);
      expect(variant.worldContributionMapperId).toBe(base?.worldContributionMapperId);
    }
  });

  it("注册表和两份 manifest 都不存在重复 ID", () => {
    expect(duplicateIds(OFFICIAL_GAMES.map((game) => game.id))).toEqual([]);
    expect(duplicateIds(appManifest.games.map((game) => game.gameId))).toEqual([]);
    expect(duplicateIds(appManifest.games.map((game) => game.contentId))).toEqual([]);
    expect(duplicateIds(docsManifest.games.map((game) => game.gameId))).toEqual([]);
    expect(duplicateIds(docsManifest.games.map((game) => game.contentId))).toEqual([]);
  });
});

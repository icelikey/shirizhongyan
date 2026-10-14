import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const contentEntrySchema = z.object({
  contentId: z.string().min(1),
  file: z.string().regex(/^[A-Za-z0-9._-]+\.json$/),
  gameId: z.string().min(1),
  template: z.string().min(1),
  recordKey: z.string().min(1),
  rulebookId: z.string().min(1),
  worldContributionMapperId: z.string().min(1),
});

const manifestSchema = z.object({
  schemaVersion: z.literal("endings.content.v1"),
  contentPackageId: z.string().min(1),
  locale: z.string().min(1),
  status: z.string().min(1),
  games: z.array(contentEntrySchema).min(1),
});

const cardSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["memory", "skill", "map"]),
  rarity: z.string().min(1),
  effect: z.string().min(1),
});

const contentPackageSchema = z.object({
  contentId: z.string().min(1),
  version: z.string().min(1),
  gameId: z.string().min(1),
  template: z.string().min(1),
  recordKey: z.string().min(1),
  openingCards: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    scene: z.string().min(1),
    instruction: z.string().min(1),
  })).min(1),
  rulesSummary: z.record(z.string(), z.unknown()),
  loreFragments: z.array(z.object({ id: z.string().min(1), status: z.string().min(1), text: z.string().min(1), source: z.string().min(1) })),
  clues: z.array(z.object({ id: z.string().min(1), title: z.string().min(1), trigger: z.string().min(1), evidence: z.string().min(1), next: z.string().min(1) })),
  dropPool: z.array(cardSchema).min(1),
  battleReportTemplate: z.object({
    humanView: z.string().min(1),
    agentView: z.object({ sections: z.array(z.string().min(1)).min(1), mustIncludeEvidenceIds: z.boolean() }),
  }),
});

export type ContentManifestEntry = z.infer<typeof contentEntrySchema>;
export type ContentPackage = z.infer<typeof contentPackageSchema>;
export type ContentManifest = z.infer<typeof manifestSchema>;
export interface ContentRegistry {
  manifest: ContentManifest;
  packages: ReadonlyMap<string, ContentPackage>;
}

/** Agent-only 暗局沿用公开游戏的规则、内容和世界贡献映射。 */
export const CONTENT_GAME_ALIASES: Readonly<Record<string, string>> = {
  "guess-mille-core": "guess-core",
  "guess-dark-core": "guess-core",
  "poll-dark-core": "poll-duel-core",
  "flytease-dark-core": "flytease-core",
};

export const PUBLIC_CONTENT_GAME_IDS = [
  "guess-core",
  "poll-duel-core",
  "pirate-gold-core",
  "flytease-core",
  "superpower-billiards-core",
  "superpower-race-core",
  "werewolf-12-core",
] as const;

function parseJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`内容包无法读取：${path}`, { cause: error });
  }
}

function assertUniqueIds(pkg: ContentPackage): void {
  const ids = [
    ...pkg.openingCards.map(card => card.id),
    ...pkg.loreFragments.map(fragment => fragment.id),
    ...pkg.clues.map(clue => clue.id),
    ...pkg.dropPool.map(drop => drop.id),
  ];
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`内容包存在重复 ID：${pkg.contentId} / ${duplicate}`);
}

export function loadContentPackages(contentDir = resolve(process.cwd(), "content")): ContentRegistry {
  const manifestPath = resolve(contentDir, "manifest.json");
  const manifest = manifestSchema.parse(parseJson(manifestPath));
  const packages = new Map<string, ContentPackage>();
  const manifestIds = new Set<string>();

  for (const entry of manifest.games) {
    if (manifestIds.has(entry.gameId)) throw new Error(`manifest 重复绑定游戏：${entry.gameId}`);
    manifestIds.add(entry.gameId);
    const filePath = resolve(contentDir, entry.file);
    const pkg = contentPackageSchema.parse(parseJson(filePath));
    if (pkg.gameId !== entry.gameId || pkg.template !== entry.template || pkg.recordKey !== entry.recordKey) {
      throw new Error(`内容包运行时绑定不一致：${entry.gameId}`);
    }
    assertUniqueIds(pkg);
    if (packages.has(pkg.gameId)) throw new Error(`内容包重复：${pkg.gameId}`);
    packages.set(pkg.gameId, pkg);
  }

  return { manifest, packages };
}

export function assertContentCoverage(registry: ContentRegistry, gameIds: readonly string[]): void {
  for (const gameId of gameIds) {
    const contentId = CONTENT_GAME_ALIASES[gameId] ?? gameId;
    if (!registry.packages.has(contentId)) throw new Error(`游戏缺少内容包：${gameId} → ${contentId}`);
  }
}

export function loadOfficialContentPackages(contentDir = resolve(process.cwd(), "content")): ContentRegistry {
  const registry = loadContentPackages(contentDir);
  assertContentCoverage(registry, PUBLIC_CONTENT_GAME_IDS);
  return registry;
}

/** 检查目录里是否存在未被 manifest 声明的 JSON，避免发布时漏包。 */
export function undeclaredContentFiles(registry: ContentRegistry, contentDir = resolve(process.cwd(), "content")): string[] {
  const declared = new Set(["manifest.json", ...registry.manifest.games.map(entry => entry.file)]);
  return readdirSync(contentDir).filter(file => file.endsWith(".json") && !declared.has(file));
}

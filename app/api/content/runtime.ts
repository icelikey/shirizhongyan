import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { mapperIdForTemplate } from "@contracts/worldContributionMapper";
import { ruleBookForTemplate } from "@contracts/rulebooks.data";

const contentEntrySchema = z.object({
  contentId: z.string().min(1),
  file: z.string().regex(/^[A-Za-z0-9._-]+\.json$/),
  gameId: z.string().min(1),
  template: z.enum([
    "numberGuess",
    "pollDuel",
    "pirateGold",
    "flyTease",
    "superpowerBilliards",
    "beastRace",
    "werewolf",
    "spire",
  ]),
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

const stableIdSchema = z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
const referenceSchema = z.string().min(1);
const cardSchema = z.object({
  id: stableIdSchema,
  type: z.enum(["memory", "skill", "map"]),
  rarity: z.string().min(1),
  effect: z.string().min(1),
}).passthrough();

const legacyContentPackageSchema = z.object({
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
    agentView: z.object({ sections: z.array(z.string().min(1)).min(1), mustIncludeEvidenceIds: z.literal(true) }),
  }),
});

const canonicalContentPackageSchema = z.object({
  schemaVersion: z.literal("endings.content.v1"),
  contentId: stableIdSchema,
  version: z.string().min(1),
  game: z.object({
    gameId: z.string().min(1),
    template: z.string().min(1),
    recordKey: z.string().min(1),
    rulebookId: z.string().min(1).optional(),
    worldContributionMapperId: z.string().min(1).optional(),
  }),
  openingCards: z.array(z.object({
    id: stableIdSchema,
    title: z.string().min(1),
    scene: z.string().min(1),
    instruction: z.string().min(1),
  })).min(1),
  rules: z.object({ phases: z.array(z.string().min(1)).min(1) }).passthrough(),
  storyFragments: z.array(z.object({
    id: stableIdSchema,
    status: z.string().min(1),
    text: z.string().min(1),
    evidenceRefs: z.array(referenceSchema).min(1),
  })).min(1),
  clues: z.array(z.object({
    id: stableIdSchema,
    title: z.string().min(1),
    trigger: z.string().min(1),
    evidenceRefs: z.array(referenceSchema).min(1),
    next: z.string().min(1),
  })).min(1),
  dropTable: z.object({
    id: stableIdSchema,
    entries: z.array(cardSchema.extend({ weight: z.number().positive() })).min(1),
  }),
  battleReportTemplate: z.object({
    id: stableIdSchema,
    humanView: z.string().min(1),
    agentView: z.object({ sections: z.array(z.string().min(1)).min(1), mustIncludeEvidenceIds: z.literal(true) }),
  }),
  projections: z.object({
    human: z.object({ summary: z.string().min(1), actions: z.array(z.string().min(1)).min(1) }).passthrough(),
    agent: z.object({
      facts: z.array(z.string().min(1)).min(1),
      legalOptions: z.array(z.string().min(1)).min(1),
      evidenceRefs: z.array(referenceSchema).min(1),
      decisionFrame: z.string().min(1),
      doNotInfer: z.array(z.string().min(1)).min(1),
    }).passthrough(),
  }),
  fallback: z.object({
    human: z.string().min(1),
    agent: z.string().min(1),
    generation: z.literal("fallback"),
  }),
}).passthrough();

type CanonicalContentPackage = z.infer<typeof canonicalContentPackageSchema>;

export type ContentManifestEntry = z.infer<typeof contentEntrySchema>;
export type ContentPackage = Omit<z.infer<typeof legacyContentPackageSchema>, "battleReportTemplate"> & {
  schemaVersion: "endings.content.v1";
  rules: Record<string, unknown>;
  storyFragments: CanonicalContentPackage["storyFragments"];
  dropTable: CanonicalContentPackage["dropTable"];
  projections: CanonicalContentPackage["projections"];
  fallback: CanonicalContentPackage["fallback"];
  battleReportTemplate: CanonicalContentPackage["battleReportTemplate"];
};
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
    ...pkg.clues.map(clue => clue.id),
    ...pkg.storyFragments.map(fragment => fragment.id),
    pkg.dropTable.id,
    ...pkg.dropTable.entries.map(entry => entry.id),
    pkg.battleReportTemplate.id,
  ];
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) throw new Error(`内容包存在重复 ID：${pkg.contentId} / ${duplicate}`);
}

function assertUniqueReferences(label: string, refs: readonly string[]): void {
  const duplicate = refs.find((ref, index) => refs.indexOf(ref) !== index);
  if (duplicate) throw new Error(`内容包存在重复引用：${label} / ${duplicate}`);
}

function assertCanonicalReferences(pkg: CanonicalContentPackage, rulebook: ReturnType<typeof ruleBookForTemplate>): void {
  const knownIds = new Set([
    ...pkg.openingCards.map(card => card.id),
    ...pkg.storyFragments.map(fragment => fragment.id),
    ...pkg.clues.map(clue => clue.id),
    ...pkg.dropTable.entries.map(entry => entry.id),
    pkg.dropTable.id,
    pkg.battleReportTemplate.id,
  ]);
  const ruleIds = new Set(rulebook?.clauses.map(clause => clause.id) ?? []);
  const validate = (label: string, refs: readonly string[]) => {
    assertUniqueReferences(label, refs);
    for (const ref of refs) {
      if (knownIds.has(ref) || ruleIds.has(ref) || ref.startsWith("event:") || ref.startsWith("runtime:")) continue;
      throw new Error(`内容包引用不存在：${pkg.contentId} / ${label} / ${ref}`);
    }
  };
  for (const fragment of pkg.storyFragments) validate(`storyFragments.${fragment.id}`, fragment.evidenceRefs);
  for (const clue of pkg.clues) validate(`clues.${clue.id}`, clue.evidenceRefs);
  validate("projections.agent", pkg.projections.agent.evidenceRefs);
  const rules = pkg.rules as { evidenceRefs?: string[]; eventRefs?: string[]; dropRefs?: string[] };
  for (const [name, refs] of Object.entries({ evidenceRefs: rules.evidenceRefs, eventRefs: rules.eventRefs, dropRefs: rules.dropRefs })) {
    if (refs) validate(`rules.${name}`, refs);
  }
  for (const entry of pkg.dropTable.entries) {
    const refs = (entry as typeof entry & { evidenceRefs?: string[] }).evidenceRefs;
    if (refs) validate(`dropTable.entries.${entry.id}`, refs);
  }
}

function normalizeLegacyPackage(raw: z.infer<typeof legacyContentPackageSchema>, rulebook: ReturnType<typeof ruleBookForTemplate>): ContentPackage {
  const runtimeRef = `runtime:${raw.recordKey}`;
  const storyFragments = raw.loreFragments.map(fragment => ({
    id: fragment.id,
    status: fragment.status,
    text: fragment.text,
    evidenceRefs: [runtimeRef],
  }));
  const dropTable = {
    id: `drop.${raw.gameId}`,
    entries: raw.dropPool.map((entry, index) => ({ ...entry, weight: index + 1 })),
  };
  const battleReportTemplate = {
    id: `report.${raw.gameId}`,
    ...raw.battleReportTemplate,
  };
  const rules = {
    ...raw.rulesSummary,
    phases: Array.isArray(raw.rulesSummary.phases) && raw.rulesSummary.phases.length > 0
      ? raw.rulesSummary.phases
      : ["setup", "action", "settlement"],
    ruleRefs: rulebook?.clauses.map(clause => clause.id) ?? [],
  };
  return {
    ...raw,
    schemaVersion: "endings.content.v1",
    rules,
    storyFragments,
    dropTable,
    projections: {
      human: { summary: raw.battleReportTemplate.humanView, actions: raw.openingCards.map(card => card.instruction) },
      agent: { facts: ["只使用已公开事件"], legalOptions: ["提交规则允许的动作"], evidenceRefs: [runtimeRef], decisionFrame: "由规则内核确定结果", doNotInfer: ["不得把猜测写成事实"] },
    },
    fallback: { human: raw.battleReportTemplate.humanView, agent: "仅返回已公开事件和规则版本。", generation: "fallback" },
    battleReportTemplate,
  };
}

function parseContentPackage(raw: unknown, entry: ContentManifestEntry): ContentPackage {
  if (typeof raw === "object" && raw !== null && "game" in raw) {
    const canonical = canonicalContentPackageSchema.parse(raw);
    if (canonical.game.gameId !== entry.gameId || canonical.game.template !== entry.template || canonical.game.recordKey !== entry.recordKey) {
      throw new Error(`内容包运行时绑定不一致：${entry.gameId}`);
    }
    assertCanonicalReferences(canonical, ruleBookForTemplate(canonical.game.template));
    const legacy = {
      contentId: canonical.contentId,
      version: canonical.version,
      gameId: canonical.game.gameId,
      template: canonical.game.template,
      recordKey: canonical.game.recordKey,
      openingCards: canonical.openingCards,
      rulesSummary: canonical.rules,
      loreFragments: canonical.storyFragments.map(fragment => ({ ...fragment, source: fragment.evidenceRefs.join(",") })),
      clues: canonical.clues.map(clue => ({ ...clue, evidence: clue.evidenceRefs.join(",") })),
      dropPool: canonical.dropTable.entries,
      battleReportTemplate: canonical.battleReportTemplate,
    } as z.infer<typeof legacyContentPackageSchema>;
    return { ...legacy, schemaVersion: canonical.schemaVersion, rules: canonical.rules, storyFragments: canonical.storyFragments, dropTable: canonical.dropTable, projections: canonical.projections, fallback: canonical.fallback, battleReportTemplate: canonical.battleReportTemplate };
  }
  const legacy = legacyContentPackageSchema.parse(raw);
  return normalizeLegacyPackage(legacy, ruleBookForTemplate(entry.template));
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
    const pkg = parseContentPackage(parseJson(filePath), entry);
    if (pkg.contentId !== entry.contentId || pkg.gameId !== entry.gameId || pkg.template !== entry.template || pkg.recordKey !== entry.recordKey) {
      throw new Error(`内容包运行时绑定不一致：${entry.gameId}`);
    }
    const rulebook = ruleBookForTemplate(entry.template);
    if (!rulebook || rulebook.id !== entry.rulebookId) {
      throw new Error(`内容包规则书绑定不一致：${entry.gameId} / ${entry.rulebookId}`);
    }
    const mapperId = mapperIdForTemplate(entry.template);
    if (mapperId !== entry.worldContributionMapperId) {
      throw new Error(`内容包世界映射绑定不一致：${entry.gameId} / ${entry.worldContributionMapperId}`);
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


export type OfficialGameContentDefinition = {
  id: string;
  seatPolicy?: string;
};

/**
 * 将注册表中的公开游戏和 Agent-only 暗局绑定到内容包。
 * 暗局必须显式声明基座别名，避免出现“能创建房间但没有世界内容”的孤儿定义。
 */
export function assertOfficialGameContentCoverage(
  registry: ContentRegistry,
  definitions: readonly OfficialGameContentDefinition[],
): void {
  const ids = new Set<string>();
  const publicDefinitions = definitions.filter(definition => definition.seatPolicy !== "agent-only");
  for (const definition of definitions) {
    if (ids.has(definition.id)) throw new Error(`官方游戏定义重复：${definition.id}`);
    ids.add(definition.id);

    const contentId = CONTENT_GAME_ALIASES[definition.id] ?? definition.id;
    if (!registry.packages.has(contentId)) {
      throw new Error(`官方游戏缺少内容包绑定：${definition.id} → ${contentId}`);
    }
    if (definition.seatPolicy === "agent-only" && !CONTENT_GAME_ALIASES[definition.id]) {
      throw new Error(`Agent-only 游戏必须声明公开基座：${definition.id}`);
    }
  }

  const publicIds = new Set(publicDefinitions.map(definition => definition.id));
  for (const gameId of PUBLIC_CONTENT_GAME_IDS) {
    if (!publicIds.has(gameId)) throw new Error(`注册表缺少公开游戏：${gameId}`);
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


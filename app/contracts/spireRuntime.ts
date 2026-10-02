/**
 * 碎境爬塔运行时契约。
 *
 * 这里连接世界层的生命/轮回状态与 spire-loop 内容包，但不进入任何
 * GameModule 的动作或胜负函数。小游戏先给出已经结算的结果，运行时只
 * 记录结果、生成确定性掉落、处理携带选择和死亡回底。
 *
 * 持久化边界：WorldCycleState 仍是 recordsJson.world 的权威；本文件的
 * SpireRuntimeState 可序列化到 recordsJson.spire。两者可以分别回放，不能
 * 由叙事文本或 Agent 直接覆盖。
 */
import {
  applyWorldGame,
  floorCrisis,
  isLifeCritical,
  memoryCapacity,
  normalizeWorldState,
  restoreAfterDeath,
  WORLD_MAP_FRAGMENTS,
  WORLD_MEMORY_CARDS,
  MAX_MEMORY_CAPACITY,
  type WorldCycleState,
  type WorldGameResult,
  type WorldMemoryKind,
} from "./worldCycle";
import { OFFICIAL_SKILLS } from "./skills";
import { TOTAL_FLOORS } from "./spire";

export const SPIRE_RUNTIME_VERSION = 1 as const;
export const SPIRE_GAME_ID = "spire-loop" as const;
export const SPIRE_DROP_OFFER_COUNT = 3;
/** 运行时新增的 Skill 载荷上限；记忆槽仍由世界异能决定。 */
export const SPIRE_SKILL_CAPACITY = 2;
/** 当前世界地图碎片目录共四张，运行时保留显式上限以便以后扩容。 */
export const SPIRE_MAP_FRAGMENT_CAPACITY = 4;

export type SpireRunStatus = "active" | "dead" | "escaped";
export type SpireEncounterKind = "battle" | "elite" | "boss";
export type SpireDropKind = "memory" | "skill" | "mapFragment";
export type SpireDropPhase = "floor-win" | "death";

export interface SpireCarryLimits {
  memory: number;
  skill: number;
  mapFragment: number;
}

export interface SpireLoadout {
  memoryIds: string[];
  skillIds: string[];
  mapFragmentIds: string[];
}

export interface SpireCarryItem {
  id: string;
  kind: SpireDropKind;
  title: string;
  summary: string;
  capacityCost: number;
  source: "world-cycle" | "world.spire-loop";
  canonStatus: "published" | "draft";
  /** 所有实际效果都只能作用于信息、规划、路线或解释。 */
  effectScope: "information" | "planning" | "budget" | "route" | "explanation";
}

/**
 * spire-loop 草稿中已经登记的结构化掉落。
 * 这些条目只提供候选载荷，不代表草稿已经升级为公共正史。
 */
export const SPIRE_DROP_CATALOG: readonly SpireCarryItem[] = [
  {
    id: "sp.memory-loop-index",
    kind: "memory",
    title: "轮回索引",
    summary: "记录死亡、携带选择与回到底层后的差异。",
    capacityCost: 2,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "explanation",
  },
  {
    id: "sp.map-layer-seam",
    kind: "mapFragment",
    title: "层缝残图",
    summary: "标出两层地图的非固定接缝，提示一个非固定入口。",
    capacityCost: 1,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "route",
  },
  {
    id: "sp.skill-memory-loadout",
    kind: "skill",
    title: "记忆编组",
    summary: "按当前容量列出记忆组合与被舍弃的风险，不能替玩家自动选择。",
    capacityCost: 1,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "planning",
  },
  {
    id: "sp.memory-death-witness",
    kind: "memory",
    title: "死亡见证",
    summary: "保存独立观战者眼中的死亡过程，可能与死者自述冲突。",
    capacityCost: 1,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "explanation",
  },
  {
    id: "sp.map-server-bridge",
    kind: "mapFragment",
    title: "服务器桥图",
    summary: "提示另一服务器存在相同异常地点，不能改写对方世界。",
    capacityCost: 1,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "route",
  },
  {
    id: "sp.skill-long-horizon",
    kind: "skill",
    title: "长期视野",
    summary: "在即时奖励与长期证据冲突时生成两套方案供玩家选择。",
    capacityCost: 1,
    source: "world.spire-loop",
    canonStatus: "draft",
    effectScope: "planning",
  },
];

export interface SpireSettlementRecord {
  eventId: string;
  cycle: number;
  floorBefore: number;
  floorAfter: number;
  encounter: SpireEncounterKind;
  result: WorldGameResult;
  offerSeed: number;
  dropChoiceIds: string[];
  selectedDropId: string | null;
  worldStatusAfter: WorldCycleState["status"];
}

export interface SpireDeathSelection {
  eventId: string;
  floor: number;
  candidateIds: string[];
  limits: SpireCarryLimits;
  offerSeed: number;
}

export interface SpireDeathRecord {
  eventId: string;
  floor: number;
  candidateIds: string[];
  selectedIds: string[];
  limits: SpireCarryLimits;
}

export interface SpireRuntimeState {
  version: typeof SPIRE_RUNTIME_VERSION;
  runId: string;
  seed: number;
  cycle: number;
  floor: number;
  status: SpireRunStatus;
  carryLimits: SpireCarryLimits;
  carried: SpireLoadout;
  seenDropIds: string[];
  pendingDeathSelection: SpireDeathSelection | null;
  settlementHistory: SpireSettlementRecord[];
  deathHistory: SpireDeathRecord[];
}

export interface SpireLifeCrisis {
  floor: number;
  title: string;
  threshold: number;
  rule: string;
  lifeScore: number;
  critical: boolean;
  lethal: boolean;
}

export interface SpireDropEvidence {
  /** 独立观战事件数量；没有事件引用时不能凭旁白生成死亡见证。 */
  independentObserverCount?: number;
  /** 已互证的服务器快照数量；单个服务器不能生成桥图。 */
  crossServerSnapshotCount?: number;
}

export interface SpireSettlementInput {
  eventId: string;
  encounter: SpireEncounterKind;
  result: WorldGameResult;
  /** 对局回放的结算时刻；调用方应传入事件中的固定时间。 */
  now?: number;
  evidence?: SpireDropEvidence;
}

export interface SpireSettlementResult {
  ok: boolean;
  status: "settled" | "duplicate" | "rejected";
  reason?: "missing-event-id" | "run-not-active";
  world: WorldCycleState;
  runtime: SpireRuntimeState;
  crisisBefore: SpireLifeCrisis;
  crisisAfter: SpireLifeCrisis;
  dropChoices: SpireCarryItem[];
}

export interface SpireDropSelectionResult {
  ok: boolean;
  status: "selected" | "duplicate" | "rejected";
  reason?: "run-not-active" | "settlement-not-found" | "drop-not-offered" | "capacity-exceeded" | "already-carried";
  world: WorldCycleState;
  runtime: SpireRuntimeState;
}

export interface SpireDeathCarryResult {
  ok: boolean;
  status: "restored" | "duplicate" | "rejected";
  reason?: "not-awaiting-death-selection" | "unknown-candidate" | "capacity-exceeded";
  world: WorldCycleState;
  runtime: SpireRuntimeState;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function itemFromWorldMemory(id: string): SpireCarryItem | undefined {
  const card = WORLD_MEMORY_CARDS.find((entry) => entry.id === id);
  if (!card) return undefined;
  return {
    id: card.id,
    kind: "memory",
    title: card.title,
    summary: card.summary,
    capacityCost: 1,
    source: "world-cycle",
    canonStatus: "published",
    effectScope: card.kind === "skill" ? "planning" : "information",
  };
}

function itemFromWorldMap(id: string): SpireCarryItem | undefined {
  const fragment = WORLD_MAP_FRAGMENTS.find((entry) => entry.id === id);
  if (!fragment) return undefined;
  return {
    id: fragment.id,
    kind: "mapFragment",
    title: fragment.title,
    summary: fragment.clue,
    capacityCost: 1,
    source: "world-cycle",
    canonStatus: "published",
    effectScope: "route",
  };
}

function itemFromOfficialSkill(id: string): SpireCarryItem | undefined {
  const skill = OFFICIAL_SKILLS.find((entry) => entry.id === id);
  if (!skill) return undefined;
  return {
    id: skill.id,
    kind: "skill",
    title: skill.title,
    summary: skill.summary,
    capacityCost: 1,
    source: "world-cycle",
    canonStatus: "published",
    effectScope: skill.effectScope,
  };
}

export function getSpireCarryItem(id: string): SpireCarryItem | undefined {
  return itemFromWorldMemory(id)
    ?? itemFromWorldMap(id)
    ?? itemFromOfficialSkill(id)
    ?? SPIRE_DROP_CATALOG.find((item) => item.id === id);
}

export function carryLimitsForWorld(
  world: WorldCycleState,
  overrides: Partial<Omit<SpireCarryLimits, "memory">> = {},
): SpireCarryLimits {
  const normalized = normalizeWorldState(world, 0, world.ability?.sourceEchoId ?? "xuanji");
  return {
    memory: memoryCapacity(normalized),
    skill: clampInt(overrides.skill ?? SPIRE_SKILL_CAPACITY, 0, SPIRE_SKILL_CAPACITY),
    mapFragment: clampInt(overrides.mapFragment ?? SPIRE_MAP_FRAGMENT_CAPACITY, 0, SPIRE_MAP_FRAGMENT_CAPACITY),
  };
}

export function loadoutUsage(loadout: SpireLoadout): SpireCarryLimits {
  const sum = (ids: readonly string[], kind: SpireDropKind) => ids.reduce((total, id) => {
    const item = getSpireCarryItem(id);
    return total + (item?.kind === kind ? item.capacityCost : 0);
  }, 0);
  return {
    memory: sum(loadout.memoryIds, "memory"),
    skill: sum(loadout.skillIds, "skill"),
    mapFragment: sum(loadout.mapFragmentIds, "mapFragment"),
  };
}

export function emptySpireLoadout(): SpireLoadout {
  return { memoryIds: [], skillIds: [], mapFragmentIds: [] };
}

function idsForKind(loadout: SpireLoadout, kind: SpireDropKind): string[] {
  if (kind === "memory") return loadout.memoryIds;
  if (kind === "skill") return loadout.skillIds;
  return loadout.mapFragmentIds;
}

function withItem(loadout: SpireLoadout, item: SpireCarryItem): SpireLoadout {
  const next = {
    memoryIds: [...loadout.memoryIds],
    skillIds: [...loadout.skillIds],
    mapFragmentIds: [...loadout.mapFragmentIds],
  };
  const ids = idsForKind(next, item.kind);
  if (!ids.includes(item.id)) ids.push(item.id);
  return next;
}

function normalizeLoadout(input: Partial<SpireLoadout> | undefined, limits: SpireCarryLimits): SpireLoadout {
  const out = emptySpireLoadout();
  for (const kind of ["memory", "skill", "mapFragment"] as const) {
    const source = kind === "memory" ? input?.memoryIds : kind === "skill" ? input?.skillIds : input?.mapFragmentIds;
    for (const id of uniqueStrings(source ?? [])) {
      const item = getSpireCarryItem(id);
      if (!item || item.kind !== kind || idsForKind(out, kind).includes(id)) continue;
      const candidate = withItem(out, item);
      if (loadoutUsage(candidate)[kind] <= limits[kind]) {
        if (kind === "memory") out.memoryIds = candidate.memoryIds;
        if (kind === "skill") out.skillIds = candidate.skillIds;
        if (kind === "mapFragment") out.mapFragmentIds = candidate.mapFragmentIds;
      }
    }
  }
  return out;
}

function loadoutForIds(ids: readonly string[]): SpireLoadout {
  const out = emptySpireLoadout();
  for (const id of uniqueStrings(ids)) {
    const item = getSpireCarryItem(id);
    if (!item) continue;
    if (item.kind === "memory") out.memoryIds.push(id);
    if (item.kind === "skill") out.skillIds.push(id);
    if (item.kind === "mapFragment") out.mapFragmentIds.push(id);
  }
  return out;
}

function candidateIdsForLoadout(loadout: SpireLoadout): string[] {
  return uniqueStrings([...loadout.memoryIds, ...loadout.skillIds, ...loadout.mapFragmentIds]);
}

function hashSeed(seed: number, ...parts: readonly string[]): number {
  let hash = seed | 0;
  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      hash = Math.imul(hash ^ part.charCodeAt(index), 0x45d9f3b) | 0;
      hash ^= hash >>> 16;
    }
  }
  return hash | 0;
}

function nextRandom(holder: { value: number }): number {
  holder.value = (holder.value + 0x6d2b79f5) | 0;
  let value = holder.value;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const holder = { value: seed | 0 };
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom(holder) * (index + 1));
    const current = out[index];
    out[index] = out[swapIndex];
    out[swapIndex] = current;
  }
  return out;
}

function catalogOfferAllowed(
  item: SpireCarryItem,
  phase: SpireDropPhase,
  floor: number,
  evidence: SpireDropEvidence,
): boolean {
  if (phase === "death") {
    if (item.id === "sp.memory-loop-index") return true;
    return item.id === "sp.memory-death-witness" && (evidence.independentObserverCount ?? 0) >= 1;
  }
  if (item.id === "sp.map-server-bridge") return (evidence.crossServerSnapshotCount ?? 0) >= 2;
  if (item.id === "sp.skill-long-horizon") return floor >= 12;
  return item.id === "sp.map-layer-seam" || item.id === "sp.skill-memory-loadout";
}

export function deterministicSpireDropChoices(input: {
  seed: number;
  eventId: string;
  cycle: number;
  floor: number;
  phase: SpireDropPhase;
  carriedIds?: readonly string[];
  seenDropIds?: readonly string[];
  evidence?: SpireDropEvidence;
  count?: number;
}): { offerSeed: number; items: SpireCarryItem[] } {
  const evidence = input.evidence ?? {};
  const excluded = new Set(uniqueStrings([...(input.carriedIds ?? []), ...(input.seenDropIds ?? [])]));
  const worldPool: SpireCarryItem[] = WORLD_MEMORY_CARDS
    .map((card) => itemFromWorldMemory(card.id))
    .filter((item): item is SpireCarryItem => Boolean(item));
  const catalogPool = SPIRE_DROP_CATALOG.filter((item) => catalogOfferAllowed(item, input.phase, input.floor, evidence));
  const pool = [...worldPool, ...catalogPool].filter((item) => !excluded.has(item.id));
  const offerSeed = hashSeed(input.seed, SPIRE_GAME_ID, String(input.cycle), String(input.floor), input.phase, input.eventId);
  return {
    offerSeed,
    items: shuffled(pool, offerSeed).slice(0, input.count ?? SPIRE_DROP_OFFER_COUNT),
  };
}

export function lifeCrisisForWorld(world: WorldCycleState): SpireLifeCrisis {
  const normalized = normalizeWorldState(world, 0, world.ability?.sourceEchoId ?? "xuanji");
  const crisis = floorCrisis(normalized.floor);
  return {
    floor: normalized.floor,
    title: crisis.title,
    threshold: crisis.threshold,
    rule: crisis.rule,
    lifeScore: normalized.lifeScore,
    critical: isLifeCritical(normalized),
    lethal: normalized.lifeScore <= 0,
  };
}

function defaultRuntime(world: WorldCycleState, input: {
  runId: string;
  seed: number;
  carry?: Partial<SpireLoadout>;
  limits?: Partial<Omit<SpireCarryLimits, "memory">>;
}): SpireRuntimeState {
  const normalizedWorld = normalizeWorldState(world, 0, world.ability?.sourceEchoId ?? "xuanji");
  const carryLimits = carryLimitsForWorld(normalizedWorld, input.limits);
  const carried = normalizeLoadout({
    memoryIds: input.carry?.memoryIds ?? normalizedWorld.equippedMemoryIds,
    skillIds: input.carry?.skillIds,
    mapFragmentIds: input.carry?.mapFragmentIds ?? normalizedWorld.mapFragments,
  }, carryLimits);
  return {
    version: SPIRE_RUNTIME_VERSION,
    runId: input.runId,
    seed: input.seed | 0,
    cycle: normalizedWorld.cycle,
    floor: clampInt(normalizedWorld.floor, 1, TOTAL_FLOORS),
    status: normalizedWorld.status === "dead" ? "dead" : normalizedWorld.status === "escaped" ? "escaped" : "active",
    carryLimits,
    carried,
    seenDropIds: [],
    pendingDeathSelection: null,
    settlementHistory: [],
    deathHistory: [],
  };
}

export function createSpireRuntime(input: {
  world: WorldCycleState;
  runId: string;
  seed: number;
  carry?: Partial<SpireLoadout>;
  limits?: Partial<Omit<SpireCarryLimits, "memory">>;
}): SpireRuntimeState {
  return defaultRuntime(input.world, input);
}

export function normalizeSpireRuntime(input: unknown, world: WorldCycleState, now = 0): SpireRuntimeState {
  const normalizedWorld = normalizeWorldState(world, now, world.ability?.sourceEchoId ?? "xuanji");
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createSpireRuntime({ world: normalizedWorld, runId: `spire-cycle-${normalizedWorld.cycle}`, seed: 0 });
  }
  const value = input as Partial<SpireRuntimeState>;
  const runId = typeof value.runId === "string" && value.runId.length > 0 ? value.runId : `spire-cycle-${normalizedWorld.cycle}`;
  const seed = typeof value.seed === "number" && Number.isFinite(value.seed) ? value.seed | 0 : 0;
  const carryLimits = carryLimitsForWorld(normalizedWorld, {
    skill: value.carryLimits?.skill,
    mapFragment: value.carryLimits?.mapFragment,
  });
  const carried = normalizeLoadout(value.carried, carryLimits);
  const base = defaultRuntime(normalizedWorld, { runId, seed, carry: carried, limits: carryLimits });
  const status = value.status === "dead" || value.status === "escaped" || value.status === "active"
    ? value.status
    : base.status;
  return {
    ...base,
    version: SPIRE_RUNTIME_VERSION,
    cycle: typeof value.cycle === "number" ? Math.max(1, Math.floor(value.cycle)) : base.cycle,
    floor: typeof value.floor === "number" ? clampInt(value.floor, 1, TOTAL_FLOORS) : base.floor,
    status,
    seenDropIds: uniqueStrings(value.seenDropIds ?? []),
    pendingDeathSelection: value.pendingDeathSelection && typeof value.pendingDeathSelection === "object"
      ? {
        eventId: typeof value.pendingDeathSelection.eventId === "string" ? value.pendingDeathSelection.eventId : `${runId}:death`,
        floor: typeof value.pendingDeathSelection.floor === "number" ? clampInt(value.pendingDeathSelection.floor, 1, TOTAL_FLOORS) : base.floor,
        candidateIds: uniqueStrings(value.pendingDeathSelection.candidateIds ?? []),
        limits: carryLimits,
        offerSeed: typeof value.pendingDeathSelection.offerSeed === "number" ? value.pendingDeathSelection.offerSeed | 0 : 0,
      }
      : null,
    settlementHistory: Array.isArray(value.settlementHistory) ? value.settlementHistory.filter(isSettlementRecord).map(cloneSettlementRecord) : [],
    deathHistory: Array.isArray(value.deathHistory) ? value.deathHistory.filter(isDeathRecord).map(cloneDeathRecord) : [],
  };
}

function isSettlementRecord(value: unknown): value is SpireSettlementRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SpireSettlementRecord>;
  return typeof record.eventId === "string" && typeof record.floorBefore === "number" && Array.isArray(record.dropChoiceIds);
}

function cloneSettlementRecord(record: SpireSettlementRecord): SpireSettlementRecord {
  return {
    ...record,
    dropChoiceIds: uniqueStrings(record.dropChoiceIds),
    selectedDropId: typeof record.selectedDropId === "string" ? record.selectedDropId : null,
  };
}

function isDeathRecord(value: unknown): value is SpireDeathRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SpireDeathRecord>;
  return typeof record.eventId === "string" && Array.isArray(record.candidateIds) && Array.isArray(record.selectedIds);
}

function cloneDeathRecord(record: SpireDeathRecord): SpireDeathRecord {
  return {
    ...record,
    candidateIds: uniqueStrings(record.candidateIds),
    selectedIds: uniqueStrings(record.selectedIds),
    limits: { ...record.limits },
  };
}

function resultFor(
  status: SpireSettlementResult["status"],
  world: WorldCycleState,
  runtime: SpireRuntimeState,
  before: SpireLifeCrisis,
  choices: SpireCarryItem[],
  reason?: SpireSettlementResult["reason"],
): SpireSettlementResult {
  return {
    ok: status !== "rejected",
    status,
    ...(reason ? { reason } : {}),
    world,
    runtime,
    crisisBefore: before,
    crisisAfter: lifeCrisisForWorld(world),
    dropChoices: choices,
  };
}

function appendSettlement(runtime: SpireRuntimeState, record: SpireSettlementRecord): SpireRuntimeState {
  return {
    ...runtime,
    settlementHistory: [...runtime.settlementHistory, cloneSettlementRecord(record)],
    seenDropIds: uniqueStrings([...runtime.seenDropIds, ...record.dropChoiceIds]),
  };
}

function deathCandidates(
  world: WorldCycleState,
  runtime: SpireRuntimeState,
  input: SpireSettlementInput,
): { candidateIds: string[]; offerSeed: number } {
  const base = uniqueStrings([
    ...world.pendingDeathSelection,
    ...candidateIdsForLoadout(runtime.carried),
  ]);
  const deathOffer = deterministicSpireDropChoices({
    seed: runtime.seed,
    eventId: `${input.eventId}:death`,
    cycle: world.cycle,
    floor: runtime.floor,
    phase: "death",
    carriedIds: base,
    seenDropIds: runtime.seenDropIds,
    evidence: input.evidence,
    count: SPIRE_DROP_OFFER_COUNT,
  });
  return {
    // 真实死亡必然产生轮回索引；其他死亡见证仍须按证据与种子抽取。
    candidateIds: uniqueStrings(["sp.memory-loop-index", ...base, ...deathOffer.items.map((item) => item.id)]),
    offerSeed: deathOffer.offerSeed,
  };
}

export function settleSpireFloor(
  worldInput: WorldCycleState,
  runtimeInput: SpireRuntimeState,
  input: SpireSettlementInput,
): SpireSettlementResult {
  const now = input.now ?? 0;
  const world = normalizeWorldState(worldInput, now, worldInput.ability?.sourceEchoId ?? "xuanji");
  const runtime = normalizeSpireRuntime(runtimeInput, world, now);
  const before = lifeCrisisForWorld(world);
  if (!input.eventId.trim()) return resultFor("rejected", world, runtime, before, [], "missing-event-id");
  const existing = runtime.settlementHistory.find((record) => record.eventId === input.eventId);
  if (existing) {
    return resultFor("duplicate", world, runtime, before, existing.dropChoiceIds.map((id) => getSpireCarryItem(id)).filter((item): item is SpireCarryItem => Boolean(item)));
  }
  if (runtime.status !== "active" || world.status !== "alive") {
    return resultFor("rejected", world, runtime, before, [], "run-not-active");
  }

  // result 是 GameModule 已经提交的事实；此函数不会计算、覆盖或修正战斗结果。
  const worldAfter = applyWorldGame(world, input.result, now);
  const floorBefore = runtime.floor;
  const choices = input.result === "win" && worldAfter.status === "alive"
    ? deterministicSpireDropChoices({
      seed: runtime.seed,
      eventId: input.eventId,
      cycle: world.cycle,
      floor: floorBefore,
      phase: "floor-win",
      carriedIds: candidateIdsForLoadout(runtime.carried),
      seenDropIds: runtime.seenDropIds,
      evidence: input.evidence,
    })
    : { offerSeed: hashSeed(runtime.seed, input.eventId, "no-drop"), items: [] };
  const record: SpireSettlementRecord = {
    eventId: input.eventId,
    cycle: world.cycle,
    floorBefore,
    floorAfter: worldAfter.floor,
    encounter: input.encounter,
    result: input.result,
    offerSeed: choices.offerSeed,
    dropChoiceIds: choices.items.map((item) => item.id),
    selectedDropId: null,
    worldStatusAfter: worldAfter.status,
  };
  let runtimeAfter = appendSettlement({
    ...runtime,
    cycle: worldAfter.cycle,
    floor: worldAfter.floor,
    status: worldAfter.status === "dead" ? "dead" : worldAfter.status === "escaped" ? "escaped" : "active",
  }, record);
  if (worldAfter.status === "dead") {
    const death = deathCandidates(worldAfter, runtimeAfter, input);
    runtimeAfter = {
      ...runtimeAfter,
      pendingDeathSelection: {
        eventId: `${input.eventId}:death`,
        floor: floorBefore,
        candidateIds: death.candidateIds,
        limits: runtimeAfter.carryLimits,
        offerSeed: death.offerSeed,
      },
    };
  }
  return resultFor("settled", worldAfter, runtimeAfter, before, choices.items);
}

export function selectSpireDrop(
  worldInput: WorldCycleState,
  runtimeInput: SpireRuntimeState,
  input: { settlementId: string; dropId: string },
): SpireDropSelectionResult {
  const world = normalizeWorldState(worldInput, 0, worldInput.ability?.sourceEchoId ?? "xuanji");
  const runtime = normalizeSpireRuntime(runtimeInput, world);
  const recordIndex = runtime.settlementHistory.findIndex((record) => record.eventId === input.settlementId);
  if (runtime.status !== "active") return { ok: false, status: "rejected", reason: "run-not-active", world, runtime };
  if (recordIndex < 0) return { ok: false, status: "rejected", reason: "settlement-not-found", world, runtime };
  const record = runtime.settlementHistory[recordIndex];
  if (record.selectedDropId === input.dropId) return { ok: true, status: "duplicate", world, runtime };
  if (record.selectedDropId) return { ok: false, status: "rejected", reason: "drop-not-offered", world, runtime };
  if (!record.dropChoiceIds.includes(input.dropId)) return { ok: false, status: "rejected", reason: "drop-not-offered", world, runtime };
  const item = getSpireCarryItem(input.dropId);
  if (!item) return { ok: false, status: "rejected", reason: "drop-not-offered", world, runtime };
  if (candidateIdsForLoadout(runtime.carried).includes(item.id)) return { ok: false, status: "rejected", reason: "already-carried", world, runtime };
  const nextLoadout = withItem(runtime.carried, item);
  if (loadoutUsage(nextLoadout)[item.kind] > runtime.carryLimits[item.kind]) {
    return { ok: false, status: "rejected", reason: "capacity-exceeded", world, runtime };
  }
  let nextWorld = world;
  if (item.source === "world-cycle" && item.kind === "memory") {
    nextWorld = {
      ...world,
      memoryCards: world.memoryCards.includes(item.id) || world.memoryCards.length >= MAX_MEMORY_CAPACITY
        ? [...world.memoryCards]
        : [...world.memoryCards, item.id],
      memoryArchiveIds: world.memoryArchiveIds.includes(item.id) ? [...world.memoryArchiveIds] : [...world.memoryArchiveIds, item.id],
    };
  }
  const settlementHistory = runtime.settlementHistory.map((entry, index) => index === recordIndex ? { ...entry, selectedDropId: item.id } : entry);
  return {
    ok: true,
    status: "selected",
    world: nextWorld,
    runtime: { ...runtime, carried: nextLoadout, settlementHistory },
  };
}

export function resolveSpireDeathCarry(
  worldInput: WorldCycleState,
  runtimeInput: SpireRuntimeState,
  input: { selectedIds: readonly string[]; now?: number },
): SpireDeathCarryResult {
  const world = normalizeWorldState(worldInput, input.now ?? 0, worldInput.ability?.sourceEchoId ?? "xuanji");
  const runtime = normalizeSpireRuntime(runtimeInput, world, input.now ?? 0);
  const pending = runtime.pendingDeathSelection;
  if (!pending || runtime.status !== "dead" || world.status !== "dead") {
    return { ok: false, status: "rejected", reason: "not-awaiting-death-selection", world, runtime };
  }
  const selectedIds = uniqueStrings(input.selectedIds);
  if (selectedIds.some((id) => !pending.candidateIds.includes(id) || !getSpireCarryItem(id))) {
    return { ok: false, status: "rejected", reason: "unknown-candidate", world, runtime };
  }
  const selectedLoadout = loadoutForIds(selectedIds);
  const usage = loadoutUsage(selectedLoadout);
  if (usage.memory > pending.limits.memory || usage.skill > pending.limits.skill || usage.mapFragment > pending.limits.mapFragment) {
    return { ok: false, status: "rejected", reason: "capacity-exceeded", world, runtime };
  }
  const worldMemoryIds = selectedLoadout.memoryIds.filter((id) => itemFromWorldMemory(id));
  const restoredWorld = restoreAfterDeath(world, worldMemoryIds, input.now ?? 0);
  const restoredRuntime: SpireRuntimeState = {
    ...runtime,
    cycle: restoredWorld.cycle,
    floor: 1,
    status: "active",
    carryLimits: carryLimitsForWorld(restoredWorld, runtime.carryLimits),
    carried: selectedLoadout,
    seenDropIds: [],
    pendingDeathSelection: null,
    deathHistory: [
      ...runtime.deathHistory,
      {
        eventId: pending.eventId,
        floor: pending.floor,
        candidateIds: [...pending.candidateIds],
        selectedIds,
        limits: { ...pending.limits },
      },
    ],
  };
  return { ok: true, status: "restored", world: restoredWorld, runtime: restoredRuntime };
}

export function replaySpireDropChoices(record: Pick<SpireSettlementRecord, "dropChoiceIds">): SpireCarryItem[] {
  return record.dropChoiceIds
    .map((id) => getSpireCarryItem(id))
    .filter((item): item is SpireCarryItem => Boolean(item));
}

/** 供 Agent/主线读取的只读运行时投影；不包含任何可改胜负的钩子。 */
export function spireRuntimeContext(worldInput: WorldCycleState, runtimeInput: SpireRuntimeState) {
  const world = normalizeWorldState(worldInput, 0, worldInput.ability?.sourceEchoId ?? "xuanji");
  const runtime = normalizeSpireRuntime(runtimeInput, world);
  return {
    gameId: SPIRE_GAME_ID,
    cycle: world.cycle,
    floor: runtime.floor,
    status: runtime.status,
    lifeScore: world.lifeScore,
    crisis: lifeCrisisForWorld(world),
    carryLimits: runtime.carryLimits,
    carried: runtime.carried,
    carryUsage: loadoutUsage(runtime.carried),
    pendingDeathSelection: runtime.pendingDeathSelection,
    rule: "memory_and_skill_may_change_information_planning_route_or_explanation; they_may_not_change_battle_result",
  };
}

/** 防止未使用的 WorldMemoryKind 在后续扩展时被误删：类型约束用于内容映射审计。 */
export type PublishedWorldMemoryKind = WorldMemoryKind;

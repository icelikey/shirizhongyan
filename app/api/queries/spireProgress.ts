/**
 * 碎境爬塔运行时的查询/持久化边界。
 *
 * 当前数据库没有专门的 spire_runs 表，因此这里把 world 与 spire 快照
 * 分别放在已有 traveler_profiles.recordsJson.world / .spire 下。纯结算
 * 仍在 contracts/spireRuntime.ts；本文件只负责读档、调用纯函数、原子
 * 回写 JSON，并把残章门禁进度合并到查询结果。
 */
import { eq } from "drizzle-orm";
import { travelerProfiles } from "@db/schema";
import {
  buildAgentMemoryContext,
  createWorldState,
  normalizeWorldState,
  reconcileWorldState,
  type WorldCycleState,
} from "@contracts/worldCycle";
import {
  carryLimitsForWorld,
  createSpireRuntime,
  lifeCrisisForWorld,
  normalizeSpireRuntime,
  selectSpireDrop,
  settleSpireFloor,
  spireRuntimeContext,
  resolveSpireDeathCarry,
  type SpireDropEvidence,
  type SpireEncounterKind,
  type SpireRuntimeState,
  type SpireSettlementInput,
  type SpireSettlementResult,
  type SpireDropSelectionResult,
  type SpireDeathCarryResult,
} from "@contracts/spireRuntime";
import { completedSetIdsForUser } from "./relicProgress";
import { findProfileByUserId } from "./profiles";
import { getDb } from "./connection";

export const SPIRE_RECORD_KEY = "spire" as const;
export const SPIRE_PERSISTENCE_VERSION = 1 as const;

export interface SpireStoredSnapshot {
  world: WorldCycleState;
  runtime: SpireRuntimeState;
}

export interface SpireProgressView extends SpireStoredSnapshot {
  userId: number;
  crisis: ReturnType<typeof lifeCrisisForWorld>;
  runtimeContext: ReturnType<typeof spireRuntimeContext>;
  worldContext: ReturnType<typeof buildAgentMemoryContext>;
  relics: {
    completedSetIds: string[];
  };
  persistence: {
    version: typeof SPIRE_PERSISTENCE_VERSION;
    recordsKey: typeof SPIRE_RECORD_KEY;
    schemaChanged: false;
  };
}

export interface SpireRecordsEnvelope {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: unknown): SpireRecordsEnvelope {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRecord(value) ? { ...value } : {};
}

/** 从现有 recordsJson 读取两个快照；不执行数据库写入。 */
export function readSpireSnapshot(recordsJson: unknown, now = Date.now()): SpireStoredSnapshot {
  const records = parseJsonObject(recordsJson);
  const storedWorld = isRecord(records.world) ? records.world : createWorldState(now);
  const world = reconcileWorldState(
    normalizeWorldState(storedWorld, now),
    now,
  );
  const runtime = normalizeSpireRuntime(records[ SPIRE_RECORD_KEY ], world, now);
  return { world, runtime };
}

/**
 * 把快照写回已有 JSON 列。调用方应在事务内使用返回值；其他 records
 * 键原样保留，故不会覆盖 agent/world 的既有扩展字段。
 */
export function writeSpireSnapshot(
  recordsJson: unknown,
  snapshot: SpireStoredSnapshot,
): SpireRecordsEnvelope {
  const records = parseJsonObject(recordsJson);
  return {
    ...records,
    world: snapshot.world,
    [SPIRE_RECORD_KEY]: snapshot.runtime,
  };
}

export function projectSpireProgress(input: {
  userId: number;
  recordsJson: unknown;
  completedRelicSetIds: readonly string[];
  now?: number;
}): SpireProgressView {
  const snapshot = readSpireSnapshot(input.recordsJson, input.now ?? Date.now());
  return {
    userId: input.userId,
    ...snapshot,
    crisis: lifeCrisisForWorld(snapshot.world),
    runtimeContext: spireRuntimeContext(snapshot.world, snapshot.runtime),
    worldContext: buildAgentMemoryContext(snapshot.world),
    relics: { completedSetIds: [...new Set(input.completedRelicSetIds)] },
    persistence: {
      version: SPIRE_PERSISTENCE_VERSION,
      recordsKey: SPIRE_RECORD_KEY,
      schemaChanged: false,
    },
  };
}

/** 查询世界层、爬塔载荷和残章门禁的合并视图。 */
export async function getSpireProgressForUser(userId: number, now = Date.now()): Promise<SpireProgressView> {
  const [profile, completedRelicSetIds] = await Promise.all([
    findProfileByUserId(userId),
    completedSetIdsForUser(userId),
  ]);
  return projectSpireProgress({
    userId,
    recordsJson: profile?.recordsJson,
    completedRelicSetIds,
    now,
  });
}

async function mutateStoredSnapshot<T>(
  userId: number,
  mutate: (snapshot: SpireStoredSnapshot) => { snapshot: SpireStoredSnapshot; result: T },
): Promise<T | null> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const profile = await tx.query.travelerProfiles.findFirst({
      where: eq(travelerProfiles.userId, userId),
    });
    if (!profile) return null;
    const current = readSpireSnapshot(profile.recordsJson);
    const changed = mutate(current);
    await tx
      .update(travelerProfiles)
      .set({ recordsJson: writeSpireSnapshot(profile.recordsJson, changed.snapshot) as never })
      .where(eq(travelerProfiles.userId, userId));
    return changed.result;
  });
}

/**
 * 初始化一轮爬塔。runId 与 seed 必须由主线/回放事件提供；这里不生成
 * 隐式随机种子，避免同一事件重试时得到不同的掉落。
 */
export async function startSpireRunForUser(input: {
  userId: number;
  runId: string;
  seed: number;
  carry?: Parameters<typeof createSpireRuntime>[0]["carry"];
  skillCapacity?: number;
  mapFragmentCapacity?: number;
}): Promise<SpireRuntimeState | null> {
  return mutateStoredSnapshot(input.userId, (current) => {
    const runtime = createSpireRuntime({
      world: current.world,
      runId: input.runId,
      seed: input.seed,
      carry: input.carry,
      limits: {
        skill: input.skillCapacity,
        mapFragment: input.mapFragmentCapacity,
      },
    });
    return { snapshot: { ...current, runtime }, result: runtime };
  });
}

/**
 * 写入一次已由 GameModule 结算的结果，并生成确定性候选掉落。
 * input.result 是事实入口，函数不会重新计算战斗或接受叙事覆盖。
 */
export async function settleSpireForUser(input: {
  userId: number;
  eventId: string;
  encounter: SpireEncounterKind;
  result: SpireSettlementInput["result"];
  now?: number;
  evidence?: SpireDropEvidence;
}): Promise<SpireSettlementResult | null> {
  return mutateStoredSnapshot(input.userId, (current) => {
    const settled = settleSpireFloor(current.world, current.runtime, {
      eventId: input.eventId,
      encounter: input.encounter,
      result: input.result,
      now: input.now ?? Date.now(),
      evidence: input.evidence,
    });
    return { snapshot: { world: settled.world, runtime: settled.runtime }, result: settled };
  });
}

/** 确认某一层的单个掉落选择；重复提交同一选择保持幂等。 */
export async function chooseSpireDropForUser(input: {
  userId: number;
  settlementId: string;
  dropId: string;
}): Promise<SpireDropSelectionResult | null> {
  return mutateStoredSnapshot(input.userId, (current) => {
    const selected = selectSpireDrop(current.world, current.runtime, {
      settlementId: input.settlementId,
      dropId: input.dropId,
    });
    return { snapshot: { world: selected.world, runtime: selected.runtime }, result: selected };
  });
}

/** 确认死亡后的携带选择；未选择的局内载荷不会进入下一轮。 */
export async function resolveSpireDeathForUser(input: {
  userId: number;
  selectedIds: readonly string[];
  now?: number;
}): Promise<SpireDeathCarryResult | null> {
  return mutateStoredSnapshot(input.userId, (current) => {
    const restored = resolveSpireDeathCarry(current.world, current.runtime, {
      selectedIds: input.selectedIds,
      now: input.now ?? Date.now(),
    });
    return { snapshot: { world: restored.world, runtime: restored.runtime }, result: restored };
  });
}

/** 供主线展示当前容量；容量计算仍以纯契约为准。 */
export function spireCarryLimits(world: WorldCycleState, runtime?: SpireRuntimeState) {
  return runtime?.carryLimits ?? carryLimitsForWorld(world);
}

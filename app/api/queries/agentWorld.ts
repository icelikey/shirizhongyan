import { eq } from "drizzle-orm";
import { travelerProfiles } from "@db/schema";
import {
  applyWorldGame,
  buildAgentMemoryContext,
  buildWorldIntelContext,
  createWorldState,
  reconcileWorldState,
  type WorldCycleState,
  type WorldGameResult,
} from "@contracts/worldCycle";
import {
  readSpireSnapshot,
  writeSpireSnapshot,
} from "./spireProgress";
import { settleSpireFloor } from "@contracts/spireRuntime";
import { getDb } from "./connection";
import { getSpireProgressForUser } from "./spireProgress";

function parseJsonColumn<T>(value: unknown): T | null {
  if (typeof value !== "string") return (value as T) ?? null;
  try { return JSON.parse(value) as T; } catch { return null; }
}

async function readWorldState(userId: number) {
  const profile = await getDb().query.travelerProfiles.findFirst({ where: eq(travelerProfiles.userId, userId) });
  const records = profile ? parseJsonColumn<{ world?: unknown }>(profile.recordsJson) : null;
  const stored = records?.world && typeof records.world === "object" ? records.world as WorldCycleState : createWorldState();
  return { profile, records: records ?? {}, state: reconcileWorldState(stored) };
}

export async function getAgentWorldContext(userId: number) {
  const { profile, records, state } = await readWorldState(userId);
  const storedState = records.world && typeof records.world === "object" ? records.world as WorldCycleState : null;
  if (profile && JSON.stringify(storedState) !== JSON.stringify(state)) {
    await getDb().update(travelerProfiles)
      .set({ recordsJson: { ...records, world: state } as never })
      .where(eq(travelerProfiles.userId, userId));
  }
  const spire = await getSpireProgressForUser(userId);
  return {
    worldContext: buildAgentMemoryContext(state),
    worldIntel: buildWorldIntelContext(state),
    /** Agent 每次观测都能读到当前载荷；选择和结算仍只能走 spire API。 */
    spire: {
      floor: spire.runtime.floor,
      cycle: spire.runtime.cycle,
      status: spire.runtime.status,
      crisis: spire.crisis,
      carryLimits: spire.runtime.carryLimits,
      carried: spire.runtime.carried,
      relics: spire.relics,
    },
  };
}

export interface AgentGameSettlementInput {
  userId: number;
  result: WorldGameResult;
  /** 房间与席位组成的稳定事实 ID；用于 spire 结算与重启恢复幂等。 */
  eventId?: string;
  now?: number;
}

/**
 * 把已结算的黑暗对局写回 Agent 世界周期与爬塔运行时。
 *
 * eventId 存在时，world 与 spire 在同一事务内推进；spireRuntime 会负责
 * 生命归零、死亡候选和轮回边界，不能由叙事层或 Agent 自己改写。旧调用
 * 没有 eventId 时保留 world-only 兼容路径，便于读取历史任务与迁移旧数据。
 */
export async function recordAgentGameResult(input: AgentGameSettlementInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const profile = await tx.query.travelerProfiles.findFirst({ where: eq(travelerProfiles.userId, input.userId) });
    if (!profile) return null;
    const records = parseJsonColumn<Record<string, unknown>>(profile.recordsJson) ?? {};
    const stored = records.world && typeof records.world === "object" ? records.world as WorldCycleState : createWorldState();
    if (!input.eventId) {
      const next = applyWorldGame(stored, input.result, input.now ?? Date.now());
      await tx.update(travelerProfiles).set({ recordsJson: { ...records, world: next } as never }).where(eq(travelerProfiles.userId, input.userId));
      return next;
    }

    const snapshot = readSpireSnapshot(profile.recordsJson, input.now ?? Date.now());
    const settled = settleSpireFloor(snapshot.world, snapshot.runtime, {
      eventId: input.eventId,
      encounter: "battle",
      result: input.result,
      now: input.now ?? Date.now(),
    });
    await tx.update(travelerProfiles)
      .set({ recordsJson: writeSpireSnapshot(profile.recordsJson, { world: settled.world, runtime: settled.runtime }) as never })
      .where(eq(travelerProfiles.userId, input.userId));
    const next = settled.world;
    return next;
  });
}

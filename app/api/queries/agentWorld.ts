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
import { getDb } from "./connection";

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
  return { worldContext: buildAgentMemoryContext(state), worldIntel: buildWorldIntelContext(state) };
}

/** 把已结算的黑暗对局写回 Agent 世界周期；同一房间由 settled 保证幂等。 */
export async function recordAgentGameResult(input: { userId: number; result: WorldGameResult }) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const profile = await tx.query.travelerProfiles.findFirst({ where: eq(travelerProfiles.userId, input.userId) });
    if (!profile) return null;
    const records = parseJsonColumn<Record<string, unknown>>(profile.recordsJson) ?? {};
    const stored = records.world && typeof records.world === "object" ? records.world as WorldCycleState : createWorldState();
    const next = applyWorldGame(stored, input.result);
    await tx.update(travelerProfiles).set({ recordsJson: { ...records, world: next } as never }).where(eq(travelerProfiles.userId, input.userId));
    return next;
  });
}

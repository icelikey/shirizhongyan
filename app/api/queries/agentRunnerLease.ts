import { and, eq, lte, or, sql } from "drizzle-orm";
import { agentRunnerLeases } from "@db/schema";
import { getDb } from "./connection";

export type RunnerLeaseResult = { acquired: boolean; leaseUntil: Date; runnerId: string };

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062;
}

function until(now: Date, ttlMs: number) {
  return new Date(now.getTime() + Math.max(1_000, ttlMs));
}

export async function acquireAgentRunnerLease(agentKeyId: number, runnerId: string, ttlMs = 30_000, now = new Date()): Promise<RunnerLeaseResult> {
  const db = getDb();
  const leaseUntil = until(now, ttlMs);
  try {
    await db.insert(agentRunnerLeases).values({ agentKeyId, runnerId, leaseUntil, lastHeartbeatAt: now });
    return { acquired: true, leaseUntil, runnerId };
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    const existing = await db.query.agentRunnerLeases.findFirst({ where: eq(agentRunnerLeases.agentKeyId, agentKeyId) });
    if (!existing) return { acquired: false, leaseUntil, runnerId };
    if (existing.releasedAt || existing.leaseUntil <= now || existing.runnerId === runnerId) {
      const result = await db.update(agentRunnerLeases).set({ runnerId, leaseUntil, lastHeartbeatAt: now, releasedAt: null })
        .where(and(eq(agentRunnerLeases.agentKeyId, agentKeyId), or(eq(agentRunnerLeases.runnerId, runnerId), lte(agentRunnerLeases.leaseUntil, now))));
      if (result[0].affectedRows === 1) return { acquired: true, leaseUntil, runnerId };
    }
    return { acquired: false, leaseUntil: existing.leaseUntil, runnerId: existing.runnerId };
  }
}

export async function heartbeatAgentRunnerLease(agentKeyId: number, runnerId: string, ttlMs = 30_000, now = new Date()): Promise<RunnerLeaseResult | null> {
  const leaseUntil = until(now, ttlMs);
  const result = await getDb().update(agentRunnerLeases).set({ leaseUntil, lastHeartbeatAt: now })
    .where(and(eq(agentRunnerLeases.agentKeyId, agentKeyId), eq(agentRunnerLeases.runnerId, runnerId), sql`${agentRunnerLeases.releasedAt} IS NULL`, sql`${agentRunnerLeases.leaseUntil} > ${now}`));
  return result[0].affectedRows === 1 ? { acquired: true, leaseUntil, runnerId } : null;
}

export async function releaseAgentRunnerLease(agentKeyId: number, runnerId: string, now = new Date()) {
  const result = await getDb().update(agentRunnerLeases).set({ releasedAt: now, leaseUntil: now })
    .where(and(eq(agentRunnerLeases.agentKeyId, agentKeyId), eq(agentRunnerLeases.runnerId, runnerId), sql`${agentRunnerLeases.releasedAt} IS NULL`));
  return result[0].affectedRows === 1;
}

export async function expireAgentRunnerLease(agentKeyId: number, now = new Date()) {
  const result = await getDb().update(agentRunnerLeases).set({ releasedAt: now })
    .where(and(eq(agentRunnerLeases.agentKeyId, agentKeyId), lte(agentRunnerLeases.leaseUntil, now), sql`${agentRunnerLeases.releasedAt} IS NULL`));
  return result[0].affectedRows === 1;
}

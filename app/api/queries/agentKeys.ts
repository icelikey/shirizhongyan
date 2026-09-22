import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { agentKeys } from "@db/schema";
import type { AgentKey } from "@db/schema";
import { getDb } from "./connection";

export function hashAgentKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateAgentKey(): string {
  return `tdg_${randomBytes(24).toString("hex")}`;
}

export async function createAgentKey(userId: number, name: string) {
  const key = generateAgentKey();
  const keyHash = hashAgentKey(key);
  const prefix = key.slice(0, 8); // "tdg_" + 4 hex chars
  const db = getDb();
  const [{ id }] = await db
    .insert(agentKeys)
    .values({ userId, name, keyHash, prefix })
    .$returningId();
  return { id, key };
}

export async function findActiveAgentKey(key: string) {
  if (!key.startsWith("tdg_")) return undefined;
  return getDb().query.agentKeys.findFirst({
    where: and(
      eq(agentKeys.keyHash, hashAgentKey(key)),
      eq(agentKeys.active, true),
    ),
  });
}

export async function findAgentKeysByUser(userId: number) {
  return getDb()
    .select()
    .from(agentKeys)
    .where(eq(agentKeys.userId, userId));
}

export async function revokeAgentKey(userId: number, id: number) {
  const db = getDb();
  const existing = await db.query.agentKeys.findFirst({
    where: and(eq(agentKeys.id, id), eq(agentKeys.userId, userId)),
  });
  if (!existing) return false;
  await db
    .update(agentKeys)
    .set({ active: false })
    .where(eq(agentKeys.id, id));
  return true;
}

export async function touchAgentKey(id: AgentKey["id"]) {
  await getDb()
    .update(agentKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentKeys.id, id));
}

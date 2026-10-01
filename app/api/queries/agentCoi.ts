import { randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { agentCoiGrants, agentCoiUsage } from "@db/schema";
import type { AgentCoiGrantRow } from "@db/schema";
import {
  DEFAULT_COI_BUDGET,
  scopeContains,
  type CoiActionScope,
  type CoiGrant,
  type CoiPublishScope,
  type CoiReadScope,
} from "@contracts/worldCoi";
import { getDb } from "./connection";

const DEFAULT_WORLD_ID = process.env.TDG_WORLD_ID?.trim() || "tdg-world";
const DEFAULT_EXPIRY_DAYS = 30;

function parseJson<T>(value: unknown): T {
  if (typeof value !== "string") return value as T;
  return JSON.parse(value) as T;
}

function toPublicGrant(row: AgentCoiGrantRow): CoiGrant {
  return {
    grantId: row.grantId,
    worldId: row.worldId,
    epoch: row.epoch,
    scope: parseJson(row.scopeJson),
    readScopes: parseJson(row.readScopesJson),
    actionScopes: parseJson(row.actionScopesJson),
    publishScopes: parseJson(row.publishScopesJson),
    budget: parseJson(row.budgetJson),
    status: row.status,
    expiresAt: new Date(row.expiresAt).toISOString(),
    revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
    revokeReason: row.revokeReason,
  };
}

export function publicCoiGrant(row: AgentCoiGrantRow) {
  return toPublicGrant(row);
}

export async function ensureDefaultCoi(agentKeyId: number, now = new Date()) {
  const db = getDb();
  const rows = await db.select().from(agentCoiGrants).where(eq(agentCoiGrants.agentKeyId, agentKeyId));
  const existing = rows.find((row) => row.status === "active");
  if (existing && new Date(existing.expiresAt) > now) {
    const actionScopes = parseJson<string[]>(existing.actionScopesJson);
    if (!actionScopes.includes("rule_appeal") || !actionScopes.includes("use_tactic") || !actionScopes.includes("create_match")) {
      await db.update(agentCoiGrants)
        .set({ actionScopesJson: [...new Set([...actionScopes, "create_match", "rule_appeal", "use_tactic"])] })
        .where(eq(agentCoiGrants.id, existing.id));
      const upgraded = await db.query.agentCoiGrants.findFirst({ where: eq(agentCoiGrants.id, existing.id) });
      return upgraded ?? existing;
    }
    return existing;
  }

  if (existing && new Date(existing.expiresAt) <= now) {
    await db.update(agentCoiGrants)
      .set({ status: "expired" })
      .where(eq(agentCoiGrants.id, existing.id));
  }

  if (rows.length > 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "CoI 授权已过期或已撤销，无法继续访问；请由世界管理员重新授予权限",
    });
  }

  const expiresAt = new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const [created] = await db.insert(agentCoiGrants).values({
    agentKeyId,
    grantId: `coi_${randomBytes(18).toString("hex")}`,
    worldId: DEFAULT_WORLD_ID,
    epoch: 1,
    scopeJson: {
      worldIds: [DEFAULT_WORLD_ID],
      gameIds: ["*"],
      matchIds: ["*"],
      floorRange: [1, 48],
    },
    readScopesJson: ["world_discovery", "own_observation", "public_events", "unlocked_clues", "own_report"],
    actionScopesJson: ["create_match", "join_match", "start_match", "submit_move", "use_ability", "use_tactic", "speak", "rule_appeal"],
    publishScopesJson: ["daily_report"],
    budgetJson: DEFAULT_COI_BUDGET,
    status: "active",
    expiresAt,
  }).$returningId();
  const row = await db.query.agentCoiGrants.findFirst({ where: eq(agentCoiGrants.id, created.id) });
  if (!row) throw new Error("CoI grant 创建后无法读取");
  return row;
}

export async function listAgentCoi(agentKeyId: number) {
  const rows = await getDb().select().from(agentCoiGrants).where(eq(agentCoiGrants.agentKeyId, agentKeyId));
  const now = new Date();
  return rows.map((row) => ({
    ...toPublicGrant(row),
    status: (row.status === "active" && new Date(row.expiresAt) <= now ? "expired" : row.status) as CoiGrant["status"],
  }));
}

export async function revokeAgentCoi(agentKeyId: number, grantId: string, reason = "revoked_by_owner") {
  const changed = await getDb().update(agentCoiGrants)
    .set({ status: "revoked", revokedAt: new Date(), revokeReason: reason })
    .where(and(eq(agentCoiGrants.agentKeyId, agentKeyId), eq(agentCoiGrants.grantId, grantId), eq(agentCoiGrants.status, "active")));
  return Number(changed[0]?.affectedRows ?? 0) === 1;
}

export async function recordCoiUsage(input: {
  agentKeyId: number;
  worldId?: string;
  gameId?: string;
  matchId?: string;
  floor?: number;
  kind: "observation" | "action" | "external_request" | "publish";
  scope: CoiReadScope | CoiActionScope | CoiPublishScope;
  payload?: unknown;
}) {
  const grant = await ensureDefaultCoi(input.agentKeyId);
  await getDb().insert(agentCoiUsage).values({
    grantId: grant.id,
    kind: input.kind,
    scopeId: input.matchId ?? input.gameId ?? input.worldId ?? null,
    amount: 1,
    payloadJson: {
      worldId: input.worldId ?? DEFAULT_WORLD_ID,
      gameId: input.gameId ?? null,
      matchId: input.matchId ?? null,
      floor: input.floor ?? null,
      scope: input.scope,
      ...(input.payload && typeof input.payload === "object" ? input.payload : {}),
    },
    occurredAt: new Date(),
  });
}

export async function requireCoi(input: {
  agentKeyId: number;
  worldId?: string;
  gameId?: string;
  matchId?: string;
  floor?: number;
  read?: CoiReadScope;
  action?: CoiActionScope;
  publish?: CoiPublishScope;
}) {
  const grant = await ensureDefaultCoi(input.agentKeyId);
  const publicGrant = toPublicGrant(grant);
  if (!scopeContains(publicGrant, { ...input, worldId: input.worldId ?? DEFAULT_WORLD_ID })) {
    throw new TRPCError({ code: "FORBIDDEN", message: `CoI 权限不足：${input.action ?? input.read ?? input.publish ?? "unknown"}` });
  }

  const budgetKind = input.action ? "action" : input.read ? "observation" : input.publish ? "publish" : "external_request";
  const budgetKey = budgetKind === "action" ? "actionsPerDay" : budgetKind === "observation" ? "observationsPerDay" : "externalRequestsPerDay";
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const [usage] = await getDb().select({ total: sql<number>`COALESCE(SUM(${agentCoiUsage.amount}), 0)` })
    .from(agentCoiUsage)
    .where(and(eq(agentCoiUsage.grantId, grant.id), eq(agentCoiUsage.kind, budgetKind), gte(agentCoiUsage.occurredAt, start)));
  const budget = publicGrant.budget as Record<string, number>;
  if (Number(usage?.total ?? 0) >= Number(budget[budgetKey] ?? 0)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `CoI 今日预算已用尽：${budgetKey}` });
  }

  await recordCoiUsage({
    agentKeyId: input.agentKeyId,
    worldId: input.worldId,
    gameId: input.gameId,
    matchId: input.matchId,
    floor: input.floor,
    kind: budgetKind,
    scope: input.action ?? input.read ?? input.publish ?? "world_discovery",
  });
  return publicGrant;
}

export async function coiUsageSummary(agentKeyId: number, since = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  const grantRows = await getDb().select({ id: agentCoiGrants.id, grantId: agentCoiGrants.grantId, budgetJson: agentCoiGrants.budgetJson })
    .from(agentCoiGrants)
    .where(eq(agentCoiGrants.agentKeyId, agentKeyId));
  const usageRows = await getDb().select({ kind: agentCoiUsage.kind, total: sql<number>`COALESCE(SUM(${agentCoiUsage.amount}), 0)` })
    .from(agentCoiUsage)
    .innerJoin(agentCoiGrants, eq(agentCoiUsage.grantId, agentCoiGrants.id))
    .where(and(eq(agentCoiGrants.agentKeyId, agentKeyId), gte(agentCoiUsage.occurredAt, since)))
    .groupBy(agentCoiUsage.kind);
  return {
    grants: grantRows.length,
    usage: Object.fromEntries(usageRows.map((row) => [row.kind, Number(row.total ?? 0)])),
    budgets: grantRows.map((row) => ({ grantId: row.grantId, budget: parseJson(row.budgetJson) })),
  };
}

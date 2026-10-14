import { eq, sql } from "drizzle-orm";
import { playerCards, travelerProfiles } from "@db/schema";
import type { CardKind, CardSource } from "@contracts/cards";
import { getDb } from "./connection";

export type ContentDrop = { id: string; type: "memory" | "skill" | "map"; rarity: string; effect?: string };
export type ProgressionResult = "win" | "loss" | "draw";
export interface SettlementReceipt {
  eventId: string;
  matchLogId: number;
  gameId: string;
  result: ProgressionResult;
  dropId: string | null;
  dropType: ContentDrop["type"] | null;
  cardGranted: boolean;
  settledAt: number;
}

const RARITY_WEIGHT: Record<string, number> = { common: 100, uncommon: 45, rare: 15, epic: 5 };
const CARD_KIND: Record<ContentDrop["type"], CardKind> = { memory: "relic", skill: "tactic", map: "relic" };

function parseRecords(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? { ...(parsed as Record<string, unknown>) }
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function stableDropPool(pool: readonly ContentDrop[]): ContentDrop[] {
  return [...pool].sort((a, b) => a.id.localeCompare(b.id));
}

export function selectContentDrop(pool: readonly ContentDrop[], eventId: string, result: ProgressionResult): ContentDrop | null {
  if (result !== "win" || pool.length === 0) return null;
  const ordered = stableDropPool(pool);
  const total = ordered.reduce((sum, item) => sum + (RARITY_WEIGHT[item.rarity] ?? 1), 0);
  let cursor = hashSeed(eventId) % total;
  for (const item of ordered) { cursor -= RARITY_WEIGHT[item.rarity] ?? 1; if (cursor < 0) return item; }
  return ordered.at(-1) ?? null;
}

export function applyProgressionRecords(recordsJson: unknown, input: {
  receipt: SettlementReceipt; drop: ContentDrop | null; death: boolean; pendingDeathSelection?: readonly string[];
}): { records: Record<string, unknown>; duplicate: boolean } {
  const records = parseRecords(recordsJson);
  const progression = typeof records.progression === "object" && records.progression && !Array.isArray(records.progression) ? { ...(records.progression as Record<string, unknown>) } : {};
  const settlements = typeof progression.settlements === "object" && progression.settlements && !Array.isArray(progression.settlements) ? { ...(progression.settlements as Record<string, unknown>) } : {};
  if (settlements[input.receipt.eventId]) return { records, duplicate: true };
  settlements[input.receipt.eventId] = input.receipt;
  progression.settlements = settlements;
  progression.lastReceipt = input.receipt;
  if (input.drop) {
    const longTerm = Array.isArray(progression.longTermMemoryIds) ? [...progression.longTermMemoryIds as string[]] : [];
    if (input.drop.type === "memory" && !longTerm.includes(input.drop.id)) longTerm.push(input.drop.id);
    progression.longTermMemoryIds = [...new Set(longTerm)];
    const world = typeof records.world === "object" && records.world && !Array.isArray(records.world) ? { ...(records.world as Record<string, unknown>) } : null;
    if (world && input.drop.type === "memory") {
      const archive = Array.isArray(world.memoryArchiveIds) ? [...world.memoryArchiveIds as string[]] : [];
      world.memoryArchiveIds = [...new Set([...archive, input.drop.id])];
      records.world = world;
    }
    if (world && input.drop.type === "map") {
      const fragments = Array.isArray(world.mapFragments) ? [...world.mapFragments as string[]] : [];
      world.mapFragments = [...new Set([...fragments, input.drop.id])];
      records.world = world;
    }
    if (input.death) {
      progression.pendingDeathSelection = [...new Set(input.pendingDeathSelection ?? [input.drop.id])];
    }
  }
  records.progression = progression;
  return { records, duplicate: false };
}

export async function settleContentProgression(input: {
  userId: number; eventId: string; matchLogId: number; gameId: string; result: ProgressionResult;
  pool: readonly ContentDrop[]; death?: boolean; pendingDeathSelection?: readonly string[]; now?: number;
}): Promise<SettlementReceipt | null> {
  const drop = selectContentDrop(input.pool, input.eventId, input.result);
  const receipt: SettlementReceipt = { eventId: input.eventId, matchLogId: input.matchLogId, gameId: input.gameId, result: input.result, dropId: drop?.id ?? null, dropType: drop?.type ?? null, cardGranted: Boolean(drop), settledAt: input.now ?? Date.now() };
  return getDb().transaction(async (tx) => {
    const profile = await tx.query.travelerProfiles.findFirst({ where: eq(travelerProfiles.userId, input.userId) });
    if (!profile) return null;
    const applied = applyProgressionRecords(profile.recordsJson, { receipt, drop, death: Boolean(input.death), pendingDeathSelection: input.pendingDeathSelection });
    if (applied.duplicate) {
      const prior = typeof profile.recordsJson === "string" ? JSON.parse(profile.recordsJson) as Record<string, unknown> : profile.recordsJson as Record<string, unknown> | null;
      const priorProgression = prior?.progression as Record<string, unknown> | undefined;
      return (priorProgression?.settlements as Record<string, SettlementReceipt> | undefined)?.[input.eventId] ?? receipt;
    }
    if (drop) {
      await tx.insert(playerCards).values({ userId: input.userId, cardId: drop.id, kind: CARD_KIND[drop.type], count: 1, source: "victory" as CardSource }).onDuplicateKeyUpdate({ set: { count: sql`${playerCards.count}` } });
    }
    await tx.update(travelerProfiles).set({ recordsJson: applied.records as never }).where(eq(travelerProfiles.userId, input.userId));
    return receipt;
  });
}

import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  agentActivities,
  agentDailyReports,
  agentKeys,
  playerCards,
  travelerProfiles,
  worldOutbox,
} from "@db/schema";
import { getDb } from "./connection";
import {
  buildAgentMemoryContext,
  buildWorldIntelContext,
  createWorldState,
  reconcileWorldState,
  type WorldCycleState,
} from "@contracts/worldCycle";
import { coiUsageSummary } from "./agentCoi";
import { matchSettledWorldEventSchema, type MatchSettledWorldEvent } from "@contracts/worldOutbox";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseJsonColumn<T>(value: unknown): T | null {
  if (typeof value !== "string") return (value as T) ?? null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) throw new Error("日报日期格式必须是 YYYY-MM-DD");
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export async function recordAgentActivity(input: {
  agentKeyId: number;
  kind: string;
  title: string;
  detail?: string | null;
  payload?: unknown;
  occurredAt?: Date;
}) {
  await getDb().insert(agentActivities).values({
    agentKeyId: input.agentKeyId,
    kind: input.kind.slice(0, 32),
    title: input.title.slice(0, 128),
    detail: input.detail?.slice(0, 4000) ?? null,
    payloadJson: input.payload === undefined ? null : (input.payload as never),
    occurredAt: input.occurredAt ?? new Date(),
  });
}

export async function listAgentActivities(agentKeyId: number, limit = 80) {
  return getDb()
    .select()
    .from(agentActivities)
    .where(eq(agentActivities.agentKeyId, agentKeyId))
    .orderBy(desc(agentActivities.occurredAt), desc(agentActivities.id))
    .limit(Math.max(1, Math.min(200, limit)));
}

export interface SettledAgentMatchFact {
  matchLogId: number;
  defId: string;
  settledAt: Date;
  seat: number;
  result: "win" | "loss";
}

export interface AgentActivitySummaryInput {
  kind: string;
  payloadJson: unknown;
  occurredAt: Date;
}

function parseSettlement(value: unknown): MatchSettledWorldEvent | null {
  const parsed = parseJsonColumn<unknown>(value);
  const result = matchSettledWorldEventSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function settledAgentMatchFacts(
  rows: readonly { payloadJson: unknown }[],
  agentKeyId: number,
  start: Date,
  end: Date,
): SettledAgentMatchFact[] {
  const facts: SettledAgentMatchFact[] = [];
  for (const row of rows) {
    const event = parseSettlement(row.payloadJson);
    if (!event) continue;
    const settledAt = new Date(event.settledAt);
    if (settledAt < start || settledAt >= end) continue;
    const seat = event.seats.find((item) => item?.agentKeyId === agentKeyId);
    const rank = seat ? event.rankings.indexOf(seat.index) : -1;
    if (!seat || rank < 0) continue;
    facts.push({
      matchLogId: event.matchLogId,
      defId: event.defId,
      settledAt,
      seat: seat.index,
      result: rank === 0 ? "win" : "loss",
    });
  }
  return facts;
}

export function summarizeAgentActivities(
  activities: readonly AgentActivitySummaryInput[],
  reportDate: string,
  settledFacts: readonly SettledAgentMatchFact[] = [],
  actionCount = 0,
) {
  const matches = new Set(
    settledFacts.map((fact) => fact.matchLogId),
  );
  const wins = settledFacts.filter((fact) => fact.result === "win").length;
  const encounters = activities.filter((item) => item.kind === "encounter").length;
  const games = [...new Set(
    activities
      .map((item) => (item.payloadJson as { gameName?: string } | null)?.gameName)
      .filter((name): name is string => Boolean(name)),
  )];

  return {
    date: reportDate,
    events: activities.length,
    actions: actionCount,
    matches: matches.size,
    darkMatches: matches.size,
    requiredDarkMatches: 3,
    remainingDarkMatches: Math.max(0, 3 - matches.size),
    darkMatchesFulfilled: matches.size >= 3,
    victories: wins,
    encounters,
    games,
    lastActivityAt: activities[0]?.occurredAt ?? null,
  };
}

export async function buildDailyReport(agentKeyId: number, reportDate = dateKey(new Date())) {
  const { start, end } = dayRange(reportDate);
  const [activities, settlementRows, coi] = await Promise.all([
    getDb()
      .select()
      .from(agentActivities)
      .where(
        and(
          eq(agentActivities.agentKeyId, agentKeyId),
          gte(agentActivities.occurredAt, start),
          lte(agentActivities.occurredAt, end),
        ),
      )
      .orderBy(desc(agentActivities.occurredAt), desc(agentActivities.id)),
    getDb()
      .select({ payloadJson: worldOutbox.payloadJson })
      .from(worldOutbox)
      .where(eq(worldOutbox.eventType, "world.match.settled")),
    coiUsageSummary(agentKeyId, start),
  ]);
  const settledFacts = settledAgentMatchFacts(settlementRows, agentKeyId, start, end);
  const stats = {
    ...summarizeAgentActivities(activities, reportDate, settledFacts, coi.usage.action ?? 0),
    coi,
  };
  const summary = stats.events === 0
    ? `第 ${reportDate} 日，影从尚未留下新的活动；今日暗局进度 ${stats.darkMatches}/3。`
    : `第 ${reportDate} 日，影从留下 ${stats.events} 条记录，完成 ${stats.actions} 次行动，走过 ${stats.matches} 场牌局；暗局 ${stats.darkMatches}/3${stats.victories ? `，赢下 ${stats.victories} 场` : ""}。`;

  const db = getDb();
  const existing = await db.query.agentDailyReports.findFirst({
    where: and(
      eq(agentDailyReports.agentKeyId, agentKeyId),
      eq(agentDailyReports.reportDate, reportDate),
    ),
  });
  if (existing) {
    await db
      .update(agentDailyReports)
      .set({ summary, statsJson: stats as never })
      .where(eq(agentDailyReports.id, existing.id));
  } else {
    await db.insert(agentDailyReports).values({
      agentKeyId,
      reportDate,
      summary,
      statsJson: stats as never,
    });
  }
  return { reportDate, summary, stats, activities };
}

export async function getAgentReportSnapshot(agentKeyId: number, reportDate = dateKey(new Date())) {
  const key = await getDb().query.agentKeys.findFirst({ where: eq(agentKeys.id, agentKeyId) });
  if (!key) return null;
  const [profile, cards, report, activities, coi] = await Promise.all([
    getDb().query.travelerProfiles.findFirst({ where: eq(travelerProfiles.userId, key.userId) }),
    getDb().select().from(playerCards).where(eq(playerCards.userId, key.userId)),
    getDb().query.agentDailyReports.findFirst({
      where: and(
        eq(agentDailyReports.agentKeyId, agentKeyId),
        eq(agentDailyReports.reportDate, reportDate),
      ),
    }),
    listAgentActivities(agentKeyId, 60),
    coiUsageSummary(agentKeyId),
  ]);
  const profileRecords = profile ? parseJsonColumn<{ world?: unknown }>(profile.recordsJson) : null;
  const storedWorld = profileRecords?.world && typeof profileRecords.world === "object"
    ? profileRecords.world as WorldCycleState
    : createWorldState();
  const world = buildAgentMemoryContext(reconcileWorldState(storedWorld));
  const worldIntel = buildWorldIntelContext(reconcileWorldState(storedWorld));
  return {
    agent: { agentId: key.id, name: key.name, active: key.active, lastUsedAt: key.lastUsedAt },
    profile: profile
      ? {
          nickname: profile.nickname,
          tier: profile.tier,
          fragments: {
            spade: profile.fragSpade,
            heart: profile.fragHeart,
            club: profile.fragClub,
            diamond: profile.fragDiamond,
          },
          companion: profile.companionJson,
          world,
        }
      : null,
    cards: cards.map((card) => ({ cardId: card.cardId, kind: card.kind, count: card.count, source: card.source })),
    world,
    worldIntel,
    coi,
    report,
    activities,
  };
}

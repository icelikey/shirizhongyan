import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  agentActivities,
  agentDailyReports,
  agentKeys,
  playerCards,
  travelerProfiles,
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

function summarize(
  activities: Awaited<ReturnType<typeof listAgentActivities>>,
  reportDate: string,
) {
  const actionCount = activities.filter((item) => item.kind === "action").length;
  const matches = new Set(
    activities
      .map((item) => {
        const payload = item.payloadJson as { code?: string; gameName?: string } | null;
        return payload?.code ? `${payload.code}:${payload.gameName ?? ""}` : null;
      })
      .filter(Boolean),
  );
  const darkMatches = new Set(
    activities
      .map((item) => {
        const payload = item.payloadJson as { code?: string; darkMatch?: boolean } | null;
        return payload?.darkMatch && payload.code ? payload.code : null;
      })
      .filter(Boolean),
  );
  const wins = activities.filter((item) => item.kind === "victory").length;
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
    darkMatches: darkMatches.size,
    requiredDarkMatches: 3,
    remainingDarkMatches: Math.max(0, 3 - darkMatches.size),
    darkMatchesFulfilled: darkMatches.size >= 3,
    victories: wins,
    encounters,
    games,
    lastActivityAt: activities[0]?.occurredAt ?? null,
  };
}

export async function buildDailyReport(agentKeyId: number, reportDate = dateKey(new Date())) {
  const { start, end } = dayRange(reportDate);
  const activities = await getDb()
    .select()
    .from(agentActivities)
    .where(
      and(
        eq(agentActivities.agentKeyId, agentKeyId),
        gte(agentActivities.occurredAt, start),
        lte(agentActivities.occurredAt, end),
      ),
    )
    .orderBy(desc(agentActivities.occurredAt), desc(agentActivities.id));
  const stats = {
    ...summarize(activities, reportDate),
    coi: await coiUsageSummary(agentKeyId, start),
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

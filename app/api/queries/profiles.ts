import { eq, sql } from "drizzle-orm";
import { travelerProfiles } from "@db/schema";
import type { Suit } from "@contracts/gameSdk";
import { getDb } from "./connection";

/** 花色 → 碎片列名 */
const FRAG_COLUMN = {
  spade: "fragSpade",
  heart: "fragHeart",
  club: "fragClub",
  diamond: "fragDiamond",
} as const satisfies Record<Suit, keyof typeof travelerProfiles.$inferSelect>;

export interface ProfileSaveInput {
  nickname: string;
  fragSpade: number;
  fragHeart: number;
  fragClub: number;
  fragDiamond: number;
  tier: string;
  zodiacJson?: unknown;
  companionJson?: unknown;
  recordsJson?: unknown;
  echoMemoriesJson?: unknown;
  unlockedLoreJson?: unknown;
}

export async function findProfileByUserId(userId: number) {
  return getDb().query.travelerProfiles.findFirst({
    where: eq(travelerProfiles.userId, userId),
  });
}

/** 全量保存档案（无则创建，有则覆盖），返回保存后的行 */
export async function upsertProfile(userId: number, data: ProfileSaveInput) {
  const db = getDb();
  await db
    .insert(travelerProfiles)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: { ...data } });
  return findProfileByUserId(userId);
}

/**
 * v4 SDK 通用对局结算：事务内给 authed 人类席位按花色加/减碎片并累计战绩。
 * - delta 可为负（门票 > 奖励时净扣），GREATEST 兜底不为负；
 * - 读改写均在事务内（行锁防并发），与 v3 awardGuessResult 同一模式；
 * - 幂等由调用方保证（房间 actor settled 标记 + stateJson 持久化）。
 */
export async function awardGameResult(
  userId: number,
  opts: { suit: Suit; delta: number; won: boolean; recordKey: string },
) {
  const col = FRAG_COLUMN[opts.suit];
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx.query.travelerProfiles.findFirst({
      where: eq(travelerProfiles.userId, userId),
    });
    if (!existing) {
      await tx.insert(travelerProfiles).values({
        userId,
        [col]: Math.max(0, opts.delta),
        recordsJson: { [opts.recordKey]: { played: 1, won: opts.won ? 1 : 0 } },
      });
      return;
    }
    const records = (existing.recordsJson ?? {}) as Record<string, unknown>;
    const rec = (records[opts.recordKey] ?? { played: 0, won: 0 }) as {
      played?: number;
      won?: number;
    };
    await tx
      .update(travelerProfiles)
      .set({
        [col]: sql`GREATEST(0, ${travelerProfiles[col]} + ${opts.delta})`,
        recordsJson: {
          ...records,
          [opts.recordKey]: {
            played: (rec.played ?? 0) + 1,
            won: (rec.won ?? 0) + (opts.won ? 1 : 0),
          },
        },
      })
      .where(eq(travelerProfiles.userId, userId));
  });
}

/**
 * 对局结算：事务内给 authed 人类席位加 ♣ 碎片并累计 guess 战绩。
 * 读改写均发生在事务内（行锁防并发），同时兜底 fragClub 不为负。
 */
export async function awardGuessResult(
  userId: number,
  fragClubDelta: number,
  won: boolean,
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = await tx.query.travelerProfiles.findFirst({
      where: eq(travelerProfiles.userId, userId),
    });
    if (!existing) {
      await tx.insert(travelerProfiles).values({
        userId,
        fragClub: Math.max(0, fragClubDelta),
        recordsJson: { guess: { played: 1, won: won ? 1 : 0 } },
      });
      return;
    }
    const records = (existing.recordsJson ?? {}) as Record<string, unknown>;
    const guess = (records.guess ?? { played: 0, won: 0 }) as {
      played?: number;
      won?: number;
    };
    await tx
      .update(travelerProfiles)
      .set({
        fragClub: sql`GREATEST(0, ${travelerProfiles.fragClub} + ${fragClubDelta})`,
        recordsJson: {
          ...records,
          guess: {
            played: (guess.played ?? 0) + 1,
            won: (guess.won ?? 0) + (won ? 1 : 0),
          },
        },
      })
      .where(eq(travelerProfiles.userId, userId));
  });
}

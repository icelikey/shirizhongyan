import { desc, eq, sql } from "drizzle-orm";
import { gameDefs } from "@db/schema";
import type { InsertGameDefRow } from "@db/schema";
import { getDb } from "./connection";

export async function insertGameDef(
  data: Omit<InsertGameDefRow, "id" | "createdAt" | "plays">,
) {
  await getDb().insert(gameDefs).values(data);
}

export async function findGameDefByDefId(defId: string) {
  return getDb().query.gameDefs.findFirst({
    where: eq(gameDefs.defId, defId),
  });
}

/** 热门 UGC 定义（按开局数倒序） */
export async function listPopularGameDefs(limit = 20) {
  return getDb()
    .select()
    .from(gameDefs)
    .orderBy(desc(gameDefs.plays), desc(gameDefs.createdAt))
    .limit(limit);
}

/** 房间终局后累计该定义的开局数（官方定义不入库，调用方跳过） */
export async function incrementGameDefPlays(defId: string) {
  await getDb()
    .update(gameDefs)
    .set({ plays: sql`${gameDefs.plays} + 1` })
    .where(eq(gameDefs.defId, defId));
}

/**
 * 该用户创建的定义数。
 * 用于塔第 37 层起的 authoredGame 门禁——门后是执笔之人的席位。
 */
export async function countGameDefsByCreator(userId: number): Promise<number> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(gameDefs)
    .where(eq(gameDefs.creatorUserId, userId));
  return Number(rows[0]?.n ?? 0);
}

/** 该用户创建的全部定义（个人作品页） */
export async function listGameDefsByCreator(userId: number) {
  return getDb()
    .select()
    .from(gameDefs)
    .where(eq(gameDefs.creatorUserId, userId))
    .orderBy(desc(gameDefs.createdAt));
}

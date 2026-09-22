/**
 * 判例落库（api/queries/rulings.ts）
 *
 * 判例是「世界的规则由 AI 的博弈真实地演化」的物质载体：
 * 一条被采纳的质询沉淀为判例 → 同规则书的未来对局都受其影响。
 *
 * 【铁律·判例不溯及既往】判例永不改判已结算的胜负。
 * 因为 match_logs 的回放依赖「seed + rulebookId + 事件流」可复现，
 * 若判例能追溯改判，历史回放即失效。
 */
import { and, desc, eq } from "drizzle-orm";
import { rulings } from "@db/schema";
import type { Verdict } from "@contracts/rulebook";
import { getDb } from "./connection";

/** 采纳的裁决沉淀为判例，返回判例 id（判例卡 id 形如 'j_<id>'） */
export async function insertRuling(params: {
  verdict: Verdict;
  matchLogId: number | null;
  discovererUserId: number | null;
  discovererName: string | null;
}): Promise<number> {
  const { verdict } = params;

  const [res] = await getDb()
    .insert(rulings)
    .values({
      rulebookId: verdict.rulebookId,
      clauseId: verdict.clauseId,
      assertion: verdict.assertion,
      summary: verdict.summary,
      upheld: verdict.upheld,
      matchLogId: params.matchLogId,
      discovererUserId: params.discovererUserId,
      discovererName: params.discovererName,
    })
    .$returningId();

  return res.id;
}

/** 某规则书的全部已采纳判例（开局时加载，影响本局规则解释） */
export async function findUpheldRulings(rulebookId: string) {
  return getDb()
    .select()
    .from(rulings)
    .where(and(eq(rulings.rulebookId, rulebookId), eq(rulings.upheld, true)))
    .orderBy(desc(rulings.createdAt));
}

/** 某条款的判例历史（规则图鉴里条款下方的「判例沿革」） */
export async function findRulingsByClause(
  rulebookId: string,
  clauseId: string,
) {
  return getDb()
    .select()
    .from(rulings)
    .where(
      and(eq(rulings.rulebookId, rulebookId), eq(rulings.clauseId, clauseId)),
    )
    .orderBy(desc(rulings.createdAt));
}

/** 全站最新判例（首页「规则正在演化」的展示位） */
export async function findRecentRulings(limit = 10) {
  return getDb()
    .select()
    .from(rulings)
    .where(eq(rulings.upheld, true))
    .orderBy(desc(rulings.createdAt))
    .limit(limit);
}

/**
 * 规则书的有效版本号 = 基础版本 + 已采纳判例数。
 *
 * 判例令规则书演化，版本号必须随之增长，否则回放时无从判断
 * 该用哪一版规则解释事件流。
 */
export async function effectiveRuleBookVersion(
  rulebookId: string,
  baseVersion: number,
): Promise<number> {
  const upheld = await findUpheldRulings(rulebookId);
  return baseVersion + upheld.length;
}

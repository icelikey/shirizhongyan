/**
 * 玩家卡牌落库（api/queries/playerCards.ts）
 *
 * 【铁律】世界卡牌不直接参与任何对局的胜负计算（见 contracts/cards.ts）。
 * 策略卡只能调用规则书声明的资讯、时机和反制钩子；不决定谁赢。
 * 因此新游戏上线无需重新平衡卡池：规则内核从不读取卡牌。
 *
 * 三种获取途径对应三种玩家动机：
 *   victory 常规获胜 → 常见残章
 *   egg     彩蛋触发 → 珍稀卡（不可刷）
 *   appeal  质询成功 → 判例卡（judicial，唯一）
 *   tactic  世界掉落或交易 → 策略卡（按游戏规则书装配）
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { playerCards } from "@db/schema";
import type { CardKind, CardSource } from "@contracts/cards";
import { getDb } from "./connection";

/**
 * 发一张卡。同一张卡可重复获得（count +1），重复份可用于交易。
 * 使用 upsert 保证并发安全——结算与彩蛋可能同时发同一张卡。
 */
export async function grantCard(params: {
  userId: number;
  cardId: string;
  kind: CardKind;
  source: CardSource;
}): Promise<void> {
  await getDb()
    .insert(playerCards)
    .values({
      userId: params.userId,
      cardId: params.cardId,
      kind: params.kind,
      count: 1,
      source: params.source,
    })
    .onDuplicateKeyUpdate({
      set: { count: sql`${playerCards.count} + 1` },
    });
}

/** 批量发卡（一局结算可能同时掉多张） */
export async function grantCards(
  cards: readonly {
    userId: number;
    cardId: string;
    kind: CardKind;
    source: CardSource;
  }[],
): Promise<void> {
  for (const c of cards) await grantCard(c);
}

/** 某玩家的全部卡牌（卡册页） */
export async function findCardsByUser(userId: number) {
  return getDb()
    .select()
    .from(playerCards)
    .where(eq(playerCards.userId, userId))
    .orderBy(desc(playerCards.acquiredAt));
}

/** 某玩家某类卡牌（残章拼图进度 / 判例列表） */
export async function findCardsByKind(userId: number, kind: CardKind) {
  return getDb()
    .select()
    .from(playerCards)
    .where(and(eq(playerCards.userId, userId), eq(playerCards.kind, kind)));
}

/** 是否持有某张卡（塔门门禁判定） */
export async function hasCard(
  userId: number,
  cardId: string,
): Promise<boolean> {
  const row = await getDb().query.playerCards.findFirst({
    where: and(
      eq(playerCards.userId, userId),
      eq(playerCards.cardId, cardId),
    ),
  });
  return !!row;
}

/**
 * Agent 首次接入的最小盘外招载荷。按“缺什么补什么”执行，重复注册同一用户
 * 不会无限叠加基础卡；后续掉落和交易仍走普通 grantCard。
 */
export async function ensureStarterTacticCards(userId: number): Promise<void> {
  for (const cardId of ["tactic-extra-breath", "tactic-false-signal", "tactic-echo-lens"]) {
    if (await hasCard(userId, cardId)) continue;
    await grantCard({ userId, cardId, kind: "tactic", source: "grant" });
  }
}

/** 持有的卡 id 集合（批量判定拼图组是否集齐，避免逐张查询） */
export async function ownedCardIds(userId: number): Promise<Set<string>> {
  const rows = await getDb()
    .select({ cardId: playerCards.cardId })
    .from(playerCards)
    .where(eq(playerCards.userId, userId));
  return new Set(rows.map(r => r.cardId));
}

/** 是否持有任一判例卡（塔门 anyRuling 门禁） */
export async function hasAnyRuling(userId: number): Promise<boolean> {
  const rows = await findCardsByKind(userId, "ruling");
  return rows.length > 0;
}

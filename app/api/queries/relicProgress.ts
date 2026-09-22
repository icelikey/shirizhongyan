/**
 * 残章拼图进度（api/queries/relicProgress.ts）
 *
 * 契约层的纯函数（completedSetIds / isSetComplete）与数据库之间缺一层桥：
 * 在此之前 RELIC_SETS 在 api 与 src 下零引用，488 行残章数据是死代码，
 * 塔门门禁的 relicSet 分支也无从判定。
 *
 * 【职责边界】本文件只做「读库 → 喂给纯函数」。
 * 判定逻辑全在 contracts/relics.ts 与 contracts/spire.ts，不在这里重复。
 */
import {
  RELIC_SETS,
  completedSetIds,
  getRelicSet,
  isSetComplete,
} from "@contracts/relics";
import { checkGate, type GateContext, type GateRequirement } from "@contracts/spire";
import type { Suit } from "@contracts/gameSdk";
import { findCardsByKind, hasAnyRuling, ownedCardIds } from "./playerCards";
import { findProfileByUserId } from "./profiles";

/** 一组残章的进度（卡册页逐组展示） */
export interface RelicSetProgress {
  setId: string;
  name: string;
  suit: Suit;
  /** 已持有的组内卡 id */
  ownedCardIds: string[];
  /** 组内总卡数 */
  total: number;
  complete: boolean;
  /**
   * 拼齐后显现的真相（塔门口令）。
   * 未集齐时为 null——提前泄露真相就等于送出门禁答案。
   */
  truth: string | null;
}

/** 某玩家全部拼图组的进度 */
export async function relicProgressForUser(
  userId: number,
): Promise<RelicSetProgress[]> {
  const owned = await ownedCardIds(userId);

  return RELIC_SETS.map(set => {
    const mine = set.cardIds.filter(id => owned.has(id));
    const complete = mine.length === set.cardIds.length;
    return {
      setId: set.id,
      name: set.name,
      suit: set.suit,
      ownedCardIds: mine,
      total: set.cardIds.length,
      complete,
      truth: complete ? set.truth : null,
    };
  });
}

/** 已集齐的组 id（塔门门禁需要） */
export async function completedSetIdsForUser(
  userId: number,
): Promise<string[]> {
  const owned = await ownedCardIds(userId);
  return completedSetIds([...owned]);
}

/** 单组是否集齐 */
export async function isSetCompleteForUser(
  userId: number,
  setId: string,
): Promise<boolean> {
  if (!getRelicSet(setId)) return false;
  const owned = await ownedCardIds(userId);
  return isSetComplete(setId, [...owned]);
}

/**
 * 组装塔门门禁判定所需的玩家快照。
 *
 * 四项数据来自三张表，故集中在此一次取齐——
 * 让调用方自己拼会导致每个门禁判定点重复四次查询。
 */
export async function gateContextForUser(
  userId: number,
): Promise<GateContext> {
  const [owned, ruling, authored, profile] = await Promise.all([
    ownedCardIds(userId),
    hasAnyRuling(userId),
    hasAuthoredGame(userId),
    findProfileByUserId(userId),
  ]);

  return {
    completedRelicSetIds: completedSetIds([...owned]),
    hasAnyRuling: ruling,
    hasAuthoredGame: authored,
    fragments: {
      spade: profile?.fragSpade ?? 0,
      heart: profile?.fragHeart ?? 0,
      club: profile?.fragClub ?? 0,
      diamond: profile?.fragDiamond ?? 0,
    },
  };
}

/** 判定某道门禁对该玩家是否开启（含未通过时的世界观提示） */
export async function checkGateForUser(
  userId: number,
  gate: GateRequirement,
) {
  const ctx = await gateContextForUser(userId);
  return checkGate(gate, ctx);
}

/** 持有的判例卡数（第 25 层起的门禁与天梯展示用） */
export async function rulingCardCount(userId: number): Promise<number> {
  const rows = await findCardsByKind(userId, "ruling");
  return rows.length;
}

/**
 * 是否有被收录的自创游戏（第 37 层起的门禁）。
 *
 * 判定依据为 game_defs 里由该用户创建的定义。目前只要存在即算通过；
 * 待审核机制上线后此处应加 approved 条件。
 */
async function hasAuthoredGame(userId: number): Promise<boolean> {
  const { countGameDefsByCreator } = await import("./gameDefs");
  return (await countGameDefsByCreator(userId)) > 0;
}

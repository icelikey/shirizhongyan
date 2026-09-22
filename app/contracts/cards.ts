/**
 * ============================================================================
 * 卡牌共享契约（contracts/cards.ts）
 * ----------------------------------------------------------------------------
 * 【铁律】卡牌不参与任何对局的胜负计算。它决定玩家能解开什么、进入哪里、
 * 引用什么条款 —— 不决定能打出多少伤害。
 *
 * 因此新游戏（含 UGC）上线不需要重新平衡卡池：规则内核从不读取卡牌。
 * 现有 src/engine/spire（构筑卡组）与 src/data/poker/affixes（词条）是
 * 战力卡，属塔外练习场，与本契约无关。
 *
 * 四类：
 * - relic    残章卡 · 世界观碎片，集齐一组拼出真相 → 塔门口令
 * - ruling   判例卡 · 规则质询被采纳后铸成，可引用判例
 * - intel    情报卡 · 对手策略档案（由 match_logs 真实统计生成）
 * - contract 契约卡 · 进入塔层 / 开房 / 挑战层主的资格凭证
 * ============================================================================
 */
import type { Suit } from "./gameSdk";

/**
 * 位阶（天地玄黄）。与 src/data/tiers.ts 的 Tier 同义 —— 该文件在 src/ 下，
 * 不属 tsconfig.server 范围，故在契约层独立声明一份，两边取值必须一致。
 */
export type Tier = "huang" | "xuan" | "di" | "tian";

export const TIER_ORDER: readonly Tier[] = ["huang", "xuan", "di", "tian"];

export type CardKind = "relic" | "ruling" | "intel" | "contract";

/** 稀有度：常见（获胜掉落） / 珍稀（彩蛋） / judicial（质询铸成，唯一） */
export type CardRarity = "common" | "rare" | "judicial";

export const CARD_KIND_META: Record<
  CardKind,
  { name: string; glyph: string; desc: string }
> = {
  relic: {
    name: "残章",
    glyph: "章",
    desc: "世界观碎片。集齐一组拼出真相，真相是塔门的口令。",
  },
  ruling: {
    name: "判例",
    glyph: "律",
    desc: "规则质询被裁判团采纳后铸成。可在同类规则书中引用。",
  },
  intel: {
    name: "情报",
    glyph: "谍",
    desc: "对手的策略倾向档案。不改数值，改你的先验。",
  },
  contract: {
    name: "契约",
    glyph: "契",
    desc: "进入塔层、开设房间、挑战层主的资格凭证。",
  },
};

/* ------------------------------------------------------------------ */
/* 卡牌定义                                                            */
/* ------------------------------------------------------------------ */

interface CardBase {
  id: string;
  name: string;
  kind: CardKind;
  rarity: CardRarity;
  /** 归属花色（contract 卡可为 null = 通用） */
  suit: Suit | null;
}

/**
 * 残章卡：携带一句残章正文（切自 src/data/lore.ts 十卷，一字不改）。
 * setId + setIndex 定义它属于哪一组拼图的第几片。
 */
export interface RelicCard extends CardBase {
  kind: "relic";
  /** 残章正文（一句话，浮层展示） */
  text: string;
  /** 出处卷序 1–10（可溯源回 lore.ts） */
  volumeId: number;
  /** 所属拼图组 id */
  setId: string;
  /** 组内序号（0 起） */
  setIndex: number;
}

export interface RulingCard extends CardBase {
  kind: "ruling";
  rarity: "judicial";
  /** 被质询的条款 id */
  clauseId: string;
  /** 判例摘要（裁判团裁决时生成） */
  summary: string;
  /** 铸成于哪一局 */
  matchId: number;
  /** 首位发现者的展示名（留名） */
  discoverer: string;
}

export interface IntelCard extends CardBase {
  kind: "intel";
  /** 被记录的影从 id（对应 src/data/echoes.ts） */
  subjectEchoId: string;
  /** 统计摘要（由 match_logs 聚合，非人工撰写） */
  summary: string;
  /** 样本局数（越多越可信） */
  sampleSize: number;
}

export interface ContractCard extends CardBase {
  kind: "contract";
  /** 可进入的塔层（null = 不限） */
  floorAccess: number | null;
  /** 是否为消耗品 */
  consumable: boolean;
}

export type Card = RelicCard | RulingCard | IntelCard | ContractCard;

/* ------------------------------------------------------------------ */
/* 拼图组 → 塔门口令                                                    */
/* ------------------------------------------------------------------ */

/**
 * 一组残章拼出一条真相。真相文本即塔门口令。
 * 玩家集齐 cardIds 全部后，truth 自动解锁。
 */
export interface RelicSet {
  id: string;
  name: string;
  /** 归属花色 */
  suit: Suit;
  /** 拼齐后显现的真相（塔门口令） */
  truth: string;
  /** 组成本组的残章卡 id（有序） */
  cardIds: string[];
}

/* ------------------------------------------------------------------ */
/* 玩家持有                                                            */
/* ------------------------------------------------------------------ */

/** player_cards 行的前端视图 */
export interface OwnedCard {
  cardId: string;
  /** 同一张卡可重复获得（残章重复 = 可交易） */
  count: number;
  acquiredAt: string;
  /** 获得途径 */
  source: CardSource;
}

export type CardSource = "victory" | "egg" | "appeal" | "trade" | "grant";

export const CARD_SOURCE_LABEL: Record<CardSource, string> = {
  victory: "对局获胜",
  egg: "彩蛋触发",
  appeal: "质询成功",
  trade: "交易所得",
  grant: "世界馈赠",
};

/** 积分：与碎片并行的第二货币，用于天梯排名（碎片是消耗品，积分不可消耗） */
export interface ScoreDelta {
  /** 对局基础分 */
  base: number;
  /** 彩蛋加分 */
  egg: number;
  /** 质询加分 */
  appeal: number;
}

export function totalScore(d: ScoreDelta): number {
  return d.base + d.egg + d.appeal;
}

/**
 * ============================================================================
 * 卡牌共享契约（contracts/cards.ts）
 * ----------------------------------------------------------------------------
 * 【铁律】世界卡牌不直接写入胜负函数。策略卡可以在规则书声明的窗口
 * 改变信息、时机或尚未结算的异能状态，但不能制造伤害、积分或胜负结果。
 *
 * 因此新游戏（含 UGC）只需声明兼容的 ruleHook，不需要把卡牌实现复制进
 * 每一个游戏。规则内核读取的是版本化、白名单化的效果适配器。
 * 现有 src/engine/spire（构筑卡组）与 src/data/poker/affixes（词条）是
 * 战力卡，属塔外练习场，与本契约无关。
 *
 * 四类：
 * - relic    残章卡 · 世界观碎片，集齐一组拼出真相 → 塔门口令
 * - ruling   判例卡 · 规则质询被采纳后铸成，可引用判例
 * - intel    情报卡 · 对手策略档案（由 match_logs 真实统计生成）
 * - contract 契约卡 · 进入塔层 / 开房 / 挑战层主的资格凭证
 * - tactic   策略卡 · 在规则书声明的窗口改变信息、时机或异能是否生效
 * ============================================================================
 */
import type { GameTemplate, Suit } from "./gameSdk";

/**
 * 位阶（天地玄黄）。与 src/data/tiers.ts 的 Tier 同义 —— 该文件在 src/ 下，
 * 不属 tsconfig.server 范围，故在契约层独立声明一份，两边取值必须一致。
 */
export type Tier = "huang" | "xuan" | "di" | "tian";

export const TIER_ORDER: readonly Tier[] = ["huang", "xuan", "di", "tian"];

export type CardKind = "relic" | "ruling" | "intel" | "contract" | "tactic";

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
  tactic: {
    name: "策略",
    glyph: "策",
    desc: "在规则允许的窗口改变信息、时机或异能生效状态；不直接改写胜负。",
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

/**
 * 策略卡是“世界卡组”与具体游戏之间的适配层。
 *
 * 它只声明一个可审计的规则钩子，具体游戏必须在自己的 RuleBook 中声明
 * 是否支持该钩子。策略卡不能携带任意脚本、数值伤害或直接结算结果。
 */
export type TacticGameScope =
  | GameTemplate
  | "beastRace"
  | "werewolf"
  | "debate"
  | "all";

export type TacticTiming =
  | "before-submit"
  | "after-submit"
  | "before-reveal"
  | "on-ability"
  | "after-reveal";

export type TacticEffect =
  | "peek-private-commitment"
  | "swap-private-commitment"
  | "suppress-pending-ability"
  | "extend-decision-window"
  | "plant-false-signal"
  | "restore-public-evidence";

export type TacticTarget = "self" | "opponent" | "mutual" | "public-event";

export interface TacticCard extends CardBase {
  kind: "tactic";
  compatibleGames: readonly TacticGameScope[];
  timing: TacticTiming;
  effect: TacticEffect;
  target: TacticTarget;
  /** 每局可消耗次数；真实消耗由房间运行时记录。 */
  charges: number;
  /** 同一策略卡再次使用前必须经过的轮数。 */
  cooldown: number;
  /** 是否允许被另一张反制卡取消。 */
  counterable: boolean;
  /** 绑定到 RuleBook 的稳定钩子名。 */
  ruleHook: string;
  effectText: string;
  lore: string;
}

export type Card = RelicCard | RulingCard | IntelCard | ContractCard | TacticCard;

/** 玩家按游戏装备的策略卡组，不等同于某一款游戏的临时手牌。 */
export interface TacticLoadout {
  game: TacticGameScope;
  cardIds: readonly string[];
  maxCards: number;
  version: string;
}

export const TACTIC_LOADOUT_LIMITS = {
  minCards: 3,
  maxCards: 8,
  maxCopiesPerEffect: 2,
} as const;

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

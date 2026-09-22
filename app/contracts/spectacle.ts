/**
 * ============================================================================
 * 奇迹演绎契约（contracts/spectacle.ts）
 * ----------------------------------------------------------------------------
 * 目标：让任何玩家的策略 Agent 都能被「惊艳地演绎出来」，
 * 并且每局大概率会出现至少一个小概率事件。
 *
 * 【核心数学：大概率出现小概率事件】
 * 这不是玄学，是判定维度足够多时的必然。
 * 若有 N 个独立判定，每个触发概率 p，则「至少触发一个」的概率为
 *   P = 1 - (1-p)^N
 * 取 p = 0.08（单个看来很稀有），N = 40 时 P ≈ 0.96。
 * 也就是说：单看每条都是小概率，合起来几乎每局必有其一。
 *
 * 所以做法不是提高单条概率（那会让它不再珍贵），
 * 而是**增加判定条数**。现有 api/world/eggs.ts 只有 6 条，
 * 故每局命中率偏低；扩到 40 条即可让「奇迹」成为常态而每条仍稀有。
 *
 * 【与彩蛋的分工】
 * eggs.ts 判定「是否值得给卡」（奖励侧，影响掉落）。
 * 本文件判定「是否值得演一段」（演出侧，影响画面）。
 * 两者分开的理由：值得看的瞬间远多于值得奖励的瞬间——
 * 一次精彩的反超不必给卡，但必须有镜头。
 *
 * 【铁律·演出不改胜负】与 cards.ts / ability.ts 同源。
 * 本文件全部结构只读事件流，不回写任何对局状态。
 * ============================================================================
 */
import type { MatchEvent } from "./matchLog";

/* ------------------------------------------------------------------ */
/* 稀有度：由实际触发频率定，不由设计者拍脑袋定                            */
/* ------------------------------------------------------------------ */

/**
 * 稀有度分档。
 *
 * 【关键设计】档位由「历史触发率」动态决定，而非硬编码。
 * 因为设计者猜不准什么难——某个自以为很难的条件可能人人都中，
 * 而某个随手写的条件可能千局一遇。让数据说话。
 */
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

/** 触发率上界 → 稀有度。查表时取第一个满足 rate <= 上界的档 */
export const RARITY_THRESHOLDS: readonly {
  rarity: Rarity;
  maxRate: number;
  label: string;
  /** 演出时长（毫秒）——越稀有演得越久，但上限 4 秒，否则拖慢节奏 */
  durationMs: number;
}[] = [
  { rarity: "mythic", maxRate: 0.002, label: "天地失色", durationMs: 4000 },
  { rarity: "legendary", maxRate: 0.01, label: "举世罕闻", durationMs: 3000 },
  { rarity: "epic", maxRate: 0.05, label: "百局难逢", durationMs: 2200 },
  { rarity: "rare", maxRate: 0.15, label: "颇为难得", durationMs: 1500 },
  { rarity: "common", maxRate: 1, label: "可圈可点", durationMs: 900 },
];

/** 按历史触发率定档 */
export function rarityOf(triggerRate: number): Rarity {
  for (const t of RARITY_THRESHOLDS) {
    if (triggerRate <= t.maxRate) return t.rarity;
  }
  return "common";
}

export function rarityMeta(rarity: Rarity) {
  return RARITY_THRESHOLDS.find(t => t.rarity === rarity)!;
}

/* ------------------------------------------------------------------ */
/* 演出片段                                                            */
/* ------------------------------------------------------------------ */

/**
 * 镜头语言。前端据此选动画，新增 kind 需要前端配合，
 * 故刻意收敛到六种——足以表达，又不至于让前端做不完。
 */
export type ShotKind =
  /** 定格放大：把某一瞬间拍下来 */
  | "freeze"
  /** 慢放：把关键动作拉长 */
  | "slowmo"
  /** 追焦：镜头跟着某个座位 */
  | "track"
  /** 分屏对比：两个座位的决策并列 */
  | "split"
  /** 回溯：倒放到伏笔处再快进回来 */
  | "rewind"
  /** 全场：拉远看整体局势 */
  | "wide";

export const SHOT_META: Record<ShotKind, { name: string; desc: string }> = {
  freeze: { name: "定格", desc: "此一瞬值得被记住。" },
  slowmo: { name: "缓照", desc: "把快得看不清的，放慢给你看。" },
  track: { name: "追影", desc: "镜头不离其人。" },
  split: { name: "对照", desc: "两人的算计并列而观。" },
  rewind: { name: "回溯", desc: "原来早有伏笔。" },
  wide: { name: "远观", desc: "退一步，看全局。" },
};

/**
 * 一个演出片段。
 *
 * 由判定器产出，前端据此编排动画。**不含任何动画实现细节**——
 * 那是前端的事，契约只说「演什么」不说「怎么演」。
 */
export interface Highlight {
  /** 判定器 id */
  id: string;
  /** 标题（浮层大字） */
  title: string;
  /** 一句解说——**这是让观众看懂的关键** */
  caption: string;
  rarity: Rarity;
  shot: ShotKind;
  /** 主角座位 */
  seat: number;
  /** 配角座位（split/对照类需要） */
  coSeat: number | null;
  /** 锚定的事件序号（演出从这里起） */
  anchorSeq: number;
  /** 回溯类需要的伏笔序号 */
  foreshadowSeq: number | null;
  /** 该 Agent 此刻的策略特征，用于「射球集锦」归档 */
  tags: readonly string[];
}

/* ------------------------------------------------------------------ */
/* 判定上下文                                                          */
/* ------------------------------------------------------------------ */

/**
 * 判定器只读事件流的索引视图。
 *
 * 与 eggs.ts 的 EggContext 刻意分开：那个为「给不给卡」服务，
 * 字段偏结果；这个为「演不演」服务，字段偏过程与转折。
 */
export interface SpectacleContext {
  events: readonly MatchEvent[];
  /** 座位 → 各轮的动作数值（用于算转折幅度） */
  valuesBySeat: Map<number, number[]>;
  /** 每轮的胜者座位 */
  winnersByRound: Map<number, number[]>;
  /** 座位 → 名次变化轨迹（算逆转的依据） */
  rankTrailBySeat: Map<number, number[]>;
  /** 终局名次 */
  finalRankings: number[];
  winnerSeat: number | null;
  totalRounds: number;
  /** 座位 → 使用过的异能 id */
  abilitiesBySeat: Map<number, string[]>;
  /** 质询裁决记录 */
  rulings: { clauseId: string; upheld: boolean; appellantSeat: number }[];
}

export interface HighlightDef {
  id: string;
  title: string;
  shot: ShotKind;
  tags: readonly string[];
  /**
   * 判定并产出片段（未命中返回空数组）。
   *
   * 返回时不填 rarity——那由统计层按历史触发率注入，
   * 判定器不该自己宣称自己稀有。
   */
  detect(ctx: SpectacleContext): Omit<Highlight, "rarity">[];
}

/* ------------------------------------------------------------------ */
/* 集锦                                                                */
/* ------------------------------------------------------------------ */

/**
 * 一局的集锦。
 *
 * 【为何要挑选而非全放】一局可能命中十几个片段，
 * 全演完要半分钟，观众会失去耐心。故按稀有度取前若干个。
 */
export const MAX_HIGHLIGHTS_PER_MATCH = 5;

export interface MatchReel {
  matchLogId: number | null;
  /** 按演出顺序（= 事件序号）排列 */
  highlights: Highlight[];
  /** 总时长，前端据此决定是否可跳过 */
  totalMs: number;
}

const RARITY_RANK: Record<Rarity, number> = {
  mythic: 5,
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
};

/**
 * 从候选片段中挑出集锦。
 *
 * 先按稀有度取前 N 个，再按事件序号重排——
 * 因为**挑选要看价值，播放要看时序**。若直接按稀有度播放，
 * 观众会看到倒叙，理解成本陡增。
 */
export function buildReel(
  candidates: readonly Highlight[],
  matchLogId: number | null,
  limit = MAX_HIGHLIGHTS_PER_MATCH,
): MatchReel {
  const picked = [...candidates]
    .sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity])
    .slice(0, limit)
    .sort((a, b) => a.anchorSeq - b.anchorSeq);

  return {
    matchLogId,
    highlights: picked,
    totalMs: picked.reduce((s, h) => s + rarityMeta(h.rarity).durationMs, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Agent 个人集锦（跨局累积）                                           */
/* ------------------------------------------------------------------ */

/**
 * 某个 Agent 的历史集锦。
 *
 * 这是「让玩家感受到自己的策略被惊艳演绎」的落点：
 * 玩家调教的 Agent 打出的精彩瞬间会被永久归档，
 * 可回看、可分享。策略的价值因此可见。
 */
export interface AgentReel {
  agentKeyId: number;
  agentName: string;
  /** 最精彩的若干片段（跨局） */
  best: Highlight[];
  /** 各稀有度的累计次数 */
  counts: Record<Rarity, number>;
  /** 该 Agent 的策略画像（由 tags 聚合） */
  signature: string[];
}

/** 从 tags 频次聚合出策略画像 */
export function signatureFrom(highlights: readonly Highlight[]): string[] {
  const freq = new Map<string, number>();
  for (const h of highlights) {
    for (const t of h.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}

/**
 * 「至少命中一个」的概率——用于校准判定器数量。
 *
 * 部署新判定器后跑一遍：若结果低于 0.9，说明判定条数不够，
 * 玩家会觉得平淡；若高于 0.99 且多数命中的是 common，
 * 说明门槛太松，奇迹会廉价。
 */
export function atLeastOneRate(perDefRate: number, defCount: number): number {
  return 1 - Math.pow(1 - perDefRate, defCount);
}

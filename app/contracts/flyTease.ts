/**
 * ============================================================================
 * flyTease —— 「逗蛐蛐」共享契约（contracts/flyTease.ts）
 * ----------------------------------------------------------------------------
 * 果蝇全脑驱动的博弈小游戏。与其它模板的三点不同，都在这里说清楚：
 *
 * 1. **动作空间来自一颗真大脑**。每张「刺激牌」= (通道, 脉冲频率, 静默通道)，
 *    对应模型真实的两个动词 + 一个强度旋钮。牌堆由离线响应表给出
 *    （`flyTease.data.ts`，由 flybrain/scripts/precompute_atlas.py 生成）。
 *    玩家要真正去读那张表，才能找到「能踩中蛐蛐偏好、又不会撞车」的牌。
 *
 * 2. **规则完全不依赖跨轮状态**。运行时的 `resolveRound` 是同步函数，
 *    拿不到 matchState（见 api/games/sdk/runtime.ts）。所以本模板设计成
 *    无状态：每轮独立结算，总分逐轮累加——与 numberGuess / pollDuel 同构。
 *    代价是没有「厌倦累积」，收益是零侵入、可回放、易测试。
 *
 * 3. **铁律守住**：大脑只决定「这只果蝇倾向做什么」，不参与胜负计算。
 *    胜负仍由分值与名次决定，与 cards.ts / ability.ts 的两条铁律一致。
 * ============================================================================
 */
import { z } from "zod";
import type { GuessRoomView } from "./room";

/* ------------------------------------------------------------------ */
/* 模板标识                                                            */
/* ------------------------------------------------------------------ */

export const FLYTEASE_TEMPLATE = "flyTease" as const;

/** 官方定义 id（registry.ts 里注册） */
export const FLYTEASE_CORE_ID = "flytease-core";

/* ------------------------------------------------------------------ */
/* 六种行为                                                            */
/* ------------------------------------------------------------------ */

/**
 * 行为 id。这不是「果蝇在做什么」，而是**放电模式的解释标签**——
 * 论文的口径也是「预测」。写文案与答评委时守这条线。
 */
export const FLY_BEHAVIORS = [
  "lick",
  "charge",
  "groom",
  "drink",
  "retreat",
  "freeze",
] as const;

export type FlyBehavior = (typeof FLY_BEHAVIORS)[number];

export interface FlyBehaviorMeta {
  /** 中文名 */
  label: string;
  /** 一句话说明它的神经依据 */
  basis: string;
  /** 激怒蛐蛐的权重（0 = 完全不激怒） */
  rage: number;
}

export const FLY_BEHAVIOR_META: Record<FlyBehavior, FlyBehaviorMeta> = {
  lick: {
    label: "吐舌",
    basis: "MN9 放电（论文验证的伸喙运动神经元）",
    rage: 1,
  },
  charge: {
    label: "扑击",
    basis: "运动侧神经元池整体放电",
    rage: 3,
  },
  groom: {
    label: "拂须",
    basis: "一级中继神经元活动",
    rage: 0,
  },
  drink: {
    label: "汲饮",
    basis: "被刺激的感受神经元自身放电",
    rage: 0,
  },
  retreat: {
    label: "退避",
    basis: "静默动词被用掉时必然出现",
    rage: 0,
  },
  freeze: { label: "僵住", basis: "全网络平均放电率跌入低谷", rage: 0 },
};

/** 蛐蛐会记恨的行为（怒气值超过阈值则反击，本轮全场无人得分） */
export function rageOf(behavior: FlyBehavior): number {
  return FLY_BEHAVIOR_META[behavior].rage;
}

/* ------------------------------------------------------------------ */
/* 纯函数判定：前后端共用同一套实现，前端才能做无偏差的预览                 */
/* ------------------------------------------------------------------ */

/**
 * 拥挤系数：本轮里做出**同一个主导行为**的人越多，每人分到的越少。
 *
 * 这是本作的核心张力——偏好是公开的，所以大家会往同一张牌上挤，
 * 而挤本身就吃掉收益。`crowding=0` 时退化成「各打各的」。
 */
export function crowdFactor(sameCount: number, crowding: number): number {
  const n = Math.max(1, Math.floor(sameCount));
  if (n === 1) return 1;
  const c = Math.min(1, Math.max(0, crowding));
  return 1 / (1 + c * (n - 1));
}

/**
 * 单座本轮得分。
 *
 * 三重门槛缺一不可，且都与「大脑倾向」有关而与「胜负规则」无关：
 * 1. `hit` 要摸到 `FLY_HIT_FLOOR` —— 没打中就是没打中；
 * 2. 乘上拥挤系数 —— 撞车就摊薄；
 * 3. 四舍五入到整数，避免浮点尾巴渗进累计分。
 */
export function gainFor(
  hit: number,
  sameCount: number,
  crowding: number,
  scoreWin: number,
): number {
  if (!(hit >= FLY_HIT_FLOOR)) return 0;
  return Math.round(hit * crowdFactor(sameCount, crowding) * scoreWin);
}

/** 一个行为对「激怒蛐蛐」的贡献：只有真做出来了才算数 */
export function rageContribution(
  behavior: FlyBehavior,
  hit: number,
): number {
  if (!(hit >= FLY_HIT_FLOOR)) return 0;
  return rageOf(behavior) * hit;
}

/* ------------------------------------------------------------------ */
/* 牌堆（由响应表生成，见 flyTease.data.ts）                             */
/* ------------------------------------------------------------------ */

export interface FlyChannel {
  id: string;
  label: string;
  /** source 感受 / relay 中继 / motor 运动侧 / center 中枢 */
  tier: "source" | "relay" | "motor" | "center";
  desc: string;
  /** 该通道包含多少个真实 Flywire 神经元 */
  size: number;
  /** true = 由连接组派生；false = 论文仓库中逐字验证过的原组 */
  derived?: boolean;
}

/**
 * 一张刺激牌。`index` 是运行时唯一能携带的载荷（`RoundEntry.value` 是数字），
 * 因此**下标一旦生成不可再变**，否则历史对局回放会错位。
 */
export interface FlyCard {
  index: number;
  /** 形如 `ft:sugar:150:relay`，也用于 agent 网关的可读提交 */
  id: string;
  channel: string;
  /** 脉冲频率（Hz），对应模型的 r_poi */
  rate: number;
  /** 同时静默的通道 id，或 "none" */
  silence: string;
}

export interface FlyTeaseCatalog {
  ratesHz: number[];
  channels: FlyChannel[];
  cards: FlyCard[];
}

/* ------------------------------------------------------------------ */
/* 响应表（atlas）—— 离线跑完所有牌的产物，游戏侧只查表                    */
/* ------------------------------------------------------------------ */

/**
 * 一张牌跑完大脑之后的完整记录。**不是**「果蝇在做什么」，而是
 * 「这条真实回路被这样刺激之后，读出池是怎么放电的」。
 *
 * 它同时是玩家的**公开情报**：牌桌上的表就是它。玩家要读这张表，
 * 才能找到既能踩中蛐蛐偏好、又不容易与别人撞车的牌。
 */
export interface FlyAtlasCard {
  index: number;
  id: string;
  channel: string;
  rate: number;
  silence: string;
  /** 产出本行的引擎（subnet = 真实连接组裁剪子网；brian2 = 论文原版全脑） */
  engine: string;
  /** 各读出池的平均放电率（Hz），键为 poolOrder 中的名字 */
  pools: Record<string, number>;
  /** 六种行为的概率分布（由真实脉冲解码而来，和为 1） */
  behavior: Record<FlyBehavior, number>;
  /**
   * 归一化**之前**的原始得分。
   *
   * 为什么留着：`behavior` 是除以各行为参考分之后的结果，好处是六种行为
   * 可比，代价是「0.3」不再等于「30% 的放电强度」。想知道原始量级就用它。
   * 前端不读，留给调试与答辩时对账。
   */
  raw: Record<FlyBehavior, number>;
  /** 主导行为 */
  top: FlyBehavior;
  /** 分布分歧度 0–1：越高越「犹豫」 */
  spread: number;
  totalSpikes: number;
  activeNeurons: number;
  /** 脉冲雨图采样 `[[t_ms, poolIndex], ...]`，仅供演出，不参与判定 */
  rain: number[][];
  notes: string[];
}

export interface FlyTeaseAtlas {
  version: number;
  engine: string;
  durationMs: number;
  trials: number;
  seed: number;
  /** 标定各池参考率所取的分位 */
  percentile: number;
  /** 标定各行为参考分所取的分位 */
  behaviorPercentile: number;
  behaviors: FlyBehavior[];
  /** 池名顺序：脉冲雨图泳道顺序，也用于把 poolIndex 翻译回可读名 */
  poolOrder: string[];
  /** 各池的参考放电率（Hz），即解码时的半饱和点 */
  poolRefs: Record<string, number>;
  /** 各行为的参考分，用于把六种行为放到同一把尺子上 */
  behaviorRefs: Record<FlyBehavior, number>;
  ratesHz: number[];
  groups: FlyChannel[];
  cards: FlyAtlasCard[];
  /**
   * 牌堆是怎么来的（如实记录，供答辩对账）。
   * 由 flybrain 的实测探针产出：`(刺激通道, 静默目标)` 这一对若静默后
   * 总脉冲数与不静默完全相同，即判无效、不生成牌。
   */
  cardSpace?: {
    /** 每张牌的空间说明，例如「4 通道 × 4 强度 × 实测有效的静默档」 */
    note: string;
    /** 被实测剔除的组合 */
    dropped: string[];
  };
}

/** 从响应表里按牌下标取记录（越界返回 null） */
export function atlasCardOf(
  atlas: FlyTeaseAtlas,
  index: number,
): FlyAtlasCard | null {
  return atlas.cards[index] ?? null;
}

/* ------------------------------------------------------------------ */
/* 判定参数（铁律边界：大脑只影响「倾向」，不影响胜负权重）                 */
/* ------------------------------------------------------------------ */

/**
 * 一个行为要算「真的发生了」所需要的最低概率。
 *
 * 为什么需要它：大脑输出的是分布而非单一动作。若不加地板，哪怕
 * ``cricketMood`` 的概率只有 0.02 也会产出一份「微小但非零」的收益，
 * 于是最优解退化成「随便打」，信息优势消失。地板让「没打中就是没打中」。
 */
export const FLY_HIT_FLOOR = 0.28;

/** 官方默认参数 */
export const FLYTEASE_DEFAULT_PARAMS = {
  rounds: 5,
  fickleness: 0.35,
  crowding: 0.6,
  rageThreshold: 8,
  scoreWin: 4,
} as const;

/* ------------------------------------------------------------------ */
/* 游戏参数                                                            */
/* ------------------------------------------------------------------ */

export interface FlyTeaseParams {
  rounds: number;
  /**
   * 蛐蛐的善变程度 0–1。越高，本轮偏好越难从上轮推断。
   * 它不改变大脑，只改变「什么算踩中」——所以调它不会破坏铁律。
   */
  fickleness: number;
  /**
   * 拥挤衰减强度 0–1。多只果蝇同时做同一个行为时，收益被摊薄。
   * 这是本作的核心张力：公开的偏好 + 必然的撞车。
   */
  crowding: number;
  /** 蛐蛐被激怒的阈值；全场怒气之和达到它即反击 */
  rageThreshold: number;
  /** 单轮最高得分 */
  scoreWin: number;
}

export const flyTeaseParamsSchema = z.object({
  rounds: z.number().int().min(3).max(10),
  fickleness: z.number().min(0).max(1),
  crowding: z.number().min(0).max(1),
  rageThreshold: z.number().int().min(1).max(30),
  scoreWin: z.number().int().min(1).max(10),
});

/* ------------------------------------------------------------------ */
/* 一轮揭晓                                                            */
/* ------------------------------------------------------------------ */

export interface FlyTeaseReveal {
  round: number;
  /** 座位 → 刺激牌下标（揭晓后全员公开） */
  values: Record<number, number>;
  /** 座位 → 六种行为的概率分布（来自真实脉冲解码） */
  behaviors: Record<number, Record<FlyBehavior, number>>;
  /** 座位 → 主导行为 */
  tops: Record<number, FlyBehavior>;
  /** 蛐蛐本轮偏好哪个行为（公开信号，人人可见） */
  cricketMood: FlyBehavior;
  /** 座位 → 触碰到偏好的强度（0–1） */
  hits: Record<number, number>;
  /** 座位 → 拥挤系数（1 = 独占，越小越撞车） */
  crowd: Record<number, number>;
  /** 全场怒气之和 */
  rage: number;
  /** 蛐蛐是否被激怒反击：true 则本轮全场无人得分 */
  raged: boolean;
  /** 座位 → 本轮得分 */
  gains: Record<number, number>;
  /**
   * 脉冲雨图：该轮被用到的每张牌各一段，供观战演出。
   * 结构：`{ [cardIndex]: [[t_ms, poolIndex], ...] }`。
   * 只作演出，不参与任何判定。
   */
  rain: Record<number, number[][]>;
  /** 本轮用到的池名顺序（把 poolIndex 翻译回可读名） */
  poolOrder: string[];
  /** 本局的大脑引擎标识，如实呈现降级状态 */
  engine: string;
}

/** flyTease 房间视图携带的局信息 */
export interface FlyTeaseViewInfo {
  /** 蛐蛐善变程度（本局参数） */
  fickleness: number;
  crowding: number;
  rageThreshold: number;
  scoreWin: number;
  /**
   * 本轮蛐蛐偏好。
   *
   * **由服务端算出后下发**，而不是让前端用同一个纯函数自己算。
   * 两边算法一旦漂移（哪怕只差一次取模），玩家就会照着错的偏好出牌，
   * 而且极难排查。宁可多发一个字段。
   */
  mood: FlyBehavior;
  /** 本局响应表由哪个引擎产出（subnet = 裁剪子网；brian2 = 论文原版全脑） */
  engine: string;
  /** 牌堆张数（前端做越界防御与超时兜底说明用） */
  cardCount: number;
  /** 本局所用响应表的版本与标定分位，答辩对账用 */
  atlasVersion: number;
}

/** flyTease 房间视图：在通用视图上换掉 lastReveal 的类型 */
export interface FlyTeaseRoomView extends Omit<GuessRoomView, "lastReveal"> {
  lastReveal: FlyTeaseReveal | null;
  choices: null;
  fly: FlyTeaseViewInfo;
}

/* ------------------------------------------------------------------ */
/* 纯函数：本轮的蛐蛐偏好                                               */
/* ------------------------------------------------------------------ */

/**
 * 用「轮次 + 定义 id」派生一个稳定的偏好。
 *
 * 为什么不用 Math.random：所有客户端与服务端必须算出同一个偏好，
 * 否则揭晓对不上。为什么不用 state.seed：运行时的 resolveRound 拿不到它
 * （只收到 def / round / entries）。等 matchState 接通后应改用它。
 */
export function cricketMoodFor(
  defId: string,
  round: number,
  fickleness: number,
): FlyBehavior {
  let h = 2166136261;
  const s = `${defId}#${round}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967296;
  // 善变度越高，越可能跳到与「上一轮直觉」不同的行为
  const n = FLY_BEHAVIORS.length;
  const idx = Math.floor((u * (1 + fickleness * 2)) % n);
  return FLY_BEHAVIORS[idx];
}

/** 从牌堆里取一张牌；越界返回 null（模板会兜底） */
export function cardOf(
  catalog: FlyTeaseCatalog,
  index: number,
): FlyCard | null {
  return catalog.cards[index] ?? null;
}

/** 按通道/频率/静默三元组查牌（Agent 网关给可读动作时用） */
export function findCard(
  catalog: FlyTeaseCatalog,
  channel: string,
  rate: number,
  silence: string,
): FlyCard | null {
  return (
    catalog.cards.find(
      (c) => c.channel === channel && c.rate === rate && c.silence === silence,
    ) ?? null
  );
}

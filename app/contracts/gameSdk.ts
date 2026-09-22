/**
 * ============================================================================
 * 《十日牌局》v4 Game SDK 共享契约（contracts/gameSdk.ts）
 * ----------------------------------------------------------------------------
 * 把联机房间抽象为「游戏定义 GameDefinition + 模板执行器」：
 * 官方游戏与玩家自创（UGC）游戏走同一套契约，前后端共用本文件的
 * 类型与 zod 边界校验。字段命名保持稳定，请勿随意改名。
 *
 * 本期两个模板：
 * - numberGuess  猜平均数（v3 猜平均数通用化：轮数/范围/倍率/分值可配）
 * - pollDuel     红眼病式同时投票博弈（少数派获胜）
 * ============================================================================
 */
import { z } from "zod";
import type { GuessRoomView, GuessReveal } from "./room";

/* ------------------------------------------------------------------ */
/* 基础类型                                                            */
/* ------------------------------------------------------------------ */

/** 四花色（碎片/门票语义色，与 src/data/echoes.ts 的 Suit 一致） */
export type Suit = "spade" | "heart" | "club" | "diamond";

/** 游戏模板 id */
export type GameTemplate = "numberGuess" | "pollDuel";

/* ------------------------------------------------------------------ */
/* 席位准入策略                                                        */
/* ------------------------------------------------------------------ */

/**
 * 不同游戏对「谁能坐上来」要求不同，这个约束必须在契约层表达，
 * 否则每个模板各自校验必然漏掉某一处。
 *
 * - agent-only      只收 Agent 席。适合人类跟不上节奏的玩法：
 *                   千轮猜数的 level-k 收敛、囚徒困境两百轮策略演化。
 *                   这一档是「分布式智能」最有说服力的场景——人做不到的事。
 * - human-friendly  人机皆可，空位由 echo-bot 补。节奏适合人类思考。
 * - mixed-required  必须人机混合。玩法核心就是人与 AI 的不对称：
 *                   海盗分金的谈判与背叛，人的非理性正是看点。
 */
export type SeatPolicy = "agent-only" | "human-friendly" | "mixed-required";

export const SEAT_POLICY_META: Record<
  SeatPolicy,
  { name: string; desc: string }
> = {
  "agent-only": {
    name: "机敏之局",
    desc: "只容影从与外来智能体入座。此局的节奏，非血肉之躯所能追。",
  },
  "human-friendly": {
    name: "寻常之局",
    desc: "人机同席，空位由影从补足。",
  },
  "mixed-required": {
    name: "混沌之局",
    desc: "人与智能体皆不可缺。此局要的正是两者之不同。",
  },
};

/** 某策略下该席位类型能否入座 */
export function seatKindAllowed(
  policy: SeatPolicy,
  kind: "human" | "external-agent",
): boolean {
  if (policy === "agent-only") return kind === "external-agent";
  return true;
}

/**
 * 开局前校验席位构成是否满足策略。
 * 返回 null 表示可开局，否则返回给玩家看的中文原因。
 *
 * 在「开局」而非「入座」时校验混合下限——入座是陆续发生的，
 * 若在入座时就要求已满足下限，第一个人永远进不来。
 */
export function validateSeatComposition(params: {
  policy: SeatPolicy;
  humanCount: number;
  agentCount: number;
  minHumanSeats?: number;
  minAgentSeats?: number;
}): string | null {
  const { policy, humanCount, agentCount } = params;

  if (policy === "agent-only" && humanCount > 0) {
    return "此局只容智能体入座";
  }

  if (policy === "mixed-required") {
    const minHuman = params.minHumanSeats ?? 1;
    const minAgent = params.minAgentSeats ?? 1;
    if (humanCount < minHuman) {
      return `此局需至少 ${minHuman} 名真人入座（现 ${humanCount}）`;
    }
    if (agentCount < minAgent) {
      return `此局需至少 ${minAgent} 名智能体入座（现 ${agentCount}）`;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* 边界（sdk.md §6 硬要求）                                             */
/* ------------------------------------------------------------------ */
export const SDK_LIMITS = {
  seats: { min: 2, max: 8 },
  rounds: { min: 3, max: 10 },
  targetRatio: { min: 0.1, max: 1.5 },
  choices: { min: 2, max: 4 },
  entryFee: { min: 0, max: 50 },
  reward: { min: 0, max: 200 },
  submitWindowSec: { min: 10, max: 120 },
  name: { max: 48 },
  choiceLabel: { max: 6 },
} as const;

/* ------------------------------------------------------------------ */
/* zod 校验（服务端 game.createDef / 前端向导共用）                      */
/* ------------------------------------------------------------------ */
export const suitSchema = z.enum(["spade", "heart", "club", "diamond"]);

export const entryFeeSchema = z.object({
  suit: suitSchema,
  amount: z
    .number()
    .int()
    .min(SDK_LIMITS.entryFee.min)
    .max(SDK_LIMITS.entryFee.max),
});

export const rewardsSchema = z.object({
  winner: z.number().int().min(SDK_LIMITS.reward.min).max(SDK_LIMITS.reward.max),
  runnerUp: z
    .number()
    .int()
    .min(SDK_LIMITS.reward.min)
    .max(SDK_LIMITS.reward.max),
  participation: z
    .number()
    .int()
    .min(SDK_LIMITS.reward.min)
    .max(SDK_LIMITS.reward.max),
});

export const numberGuessParamsSchema = z
  .object({
    rounds: z.number().int().min(SDK_LIMITS.rounds.min).max(SDK_LIMITS.rounds.max),
    min: z.number().min(0).max(1000),
    max: z.number().min(1).max(1000),
    targetRatio: z
      .number()
      .min(SDK_LIMITS.targetRatio.min)
      .max(SDK_LIMITS.targetRatio.max),
    scoreWin: z.number().int().min(1).max(10),
    scoreSecond: z.number().int().min(0).max(10),
  })
  .refine((p) => p.min < p.max, { message: "出数范围 min 必须小于 max" });

export const pollDuelParamsSchema = z.object({
  rounds: z.number().int().min(SDK_LIMITS.rounds.min).max(SDK_LIMITS.rounds.max),
  choices: z
    .array(z.string().trim().min(1).max(SDK_LIMITS.choiceLabel.max))
    .min(SDK_LIMITS.choices.min)
    .max(SDK_LIMITS.choices.max),
  payoff: z.literal("minority-wins"),
  scoreWin: z.number().int().min(1).max(10),
});

/** game.createDef 入参（模板判别联合） */
export const createGameDefSchema = z.discriminatedUnion("template", [
  z.object({
    template: z.literal("numberGuess"),
    name: z.string().trim().min(1).max(SDK_LIMITS.name.max),
    seats: z.number().int().min(SDK_LIMITS.seats.min).max(SDK_LIMITS.seats.max),
    params: numberGuessParamsSchema,
    entryFee: entryFeeSchema,
    rewards: rewardsSchema,
    submitWindowSec: z
      .number()
      .int()
      .min(SDK_LIMITS.submitWindowSec.min)
      .max(SDK_LIMITS.submitWindowSec.max),
  }),
  z.object({
    template: z.literal("pollDuel"),
    name: z.string().trim().min(1).max(SDK_LIMITS.name.max),
    seats: z.number().int().min(SDK_LIMITS.seats.min).max(SDK_LIMITS.seats.max),
    params: pollDuelParamsSchema,
    entryFee: entryFeeSchema,
    rewards: rewardsSchema,
    submitWindowSec: z
      .number()
      .int()
      .min(SDK_LIMITS.submitWindowSec.min)
      .max(SDK_LIMITS.submitWindowSec.max),
  }),
]);

export type CreateGameDefInput = z.infer<typeof createGameDefSchema>;

/* ------------------------------------------------------------------ */
/* GameDefinition（终稿字段）                                           */
/* ------------------------------------------------------------------ */
export interface EntryFee {
  suit: Suit;
  /** 门票碎片数（0 = 友谊局） */
  amount: number;
}

export interface Rewards {
  /** 冠军碎片（花色 = entryFee.suit） */
  winner: number;
  runnerUp: number;
  participation: number;
}

export interface NumberGuessParams {
  rounds: number;
  min: number;
  max: number;
  /** 均值倍率（官方 2/3 ≈ 0.667） */
  targetRatio: number;
  scoreWin: number;
  scoreSecond: number;
}

export interface PollDuelParams {
  rounds: number;
  /** 2–4 个选项标签（如 ['红','蓝']） */
  choices: string[];
  /** 少数派获胜（红眼病规则）：选最少人选的选项者得分 */
  payoff: "minority-wins";
  scoreWin: number;
}

interface GameDefinitionBase {
  /** 'guess-core' / 'poll-duel-core'（官方）或 'ugc_xxxxxxxx' */
  id: string;
  name: string;
  seats: number;
  isOfficial: boolean;
  creatorUserId?: number;
  createdAt?: string;
  entryFee: EntryFee;
  rewards: Rewards;
  /** 每轮行动时限（秒，10–120） */
  submitWindowSec: number;
  /**
   * 席位准入策略。旧定义与 UGC 未指定时按 'human-friendly' 处理
   * （见 resolveSeatPolicy），故本字段可选以保持向后兼容。
   */
  seatPolicy?: SeatPolicy;
  /** mixed-required 时的最少真人席数（默认 1） */
  minHumanSeats?: number;
  /** mixed-required 时的最少 Agent 席数（默认 1） */
  minAgentSeats?: number;
}

/** 取定义的席位策略，未指定视为人机皆可（向后兼容旧房间与 UGC） */
export function resolveSeatPolicy(def: {
  seatPolicy?: SeatPolicy;
}): SeatPolicy {
  return def.seatPolicy ?? "human-friendly";
}

export interface NumberGuessDefinition extends GameDefinitionBase {
  template: "numberGuess";
  params: NumberGuessParams;
}

export interface PollDuelDefinition extends GameDefinitionBase {
  template: "pollDuel";
  params: PollDuelParams;
}

export type GameDefinition = NumberGuessDefinition | PollDuelDefinition;

/* ------------------------------------------------------------------ */
/* pollDuel 揭示与视图                                                   */
/* ------------------------------------------------------------------ */

/** pollDuel 一轮揭晓：少数派（唯一最少人选项）得分；并列最少则本轮无人得分 */
export interface PollReveal {
  round: number;
  /** 座位号 → 选项下标（揭晓后全员公开） */
  values: Record<number, number>;
  /** 各选项得票数（下标对齐 choices） */
  counts: number[];
  /** 获胜选项下标；-1 = 无唯一少数派（流局） */
  minorityChoice: number;
  /** 本轮得分座位（选了少数派者） */
  winnerSeats: number[];
}

/** pollDuel 房间视图（在通用视图基础上 lastReveal 换型 + choices 必有） */
export interface PollRoomView extends Omit<GuessRoomView, "lastReveal"> {
  lastReveal: PollReveal | null;
  choices: string[];
}

/** room.state / agent.gatewayObserve 的返回联合（按 template 判别） */
export type GameRoomView = GuessRoomView | PollRoomView;

/** 房间动作在 room.ts 的 GuessAction 上扩展了 choose，这里给出门户别名 */
export type { GuessReveal, GuessRoomView };

/** game.listDefs 返回元素（官方 + 热门 UGC） */
export interface GameDefSummary extends GameDefinitionBase {
  template: GameTemplate;
  params: NumberGuessParams | PollDuelParams;
  /** 累计开局数（官方定义恒 0，仅 UGC 统计） */
  plays: number;
}

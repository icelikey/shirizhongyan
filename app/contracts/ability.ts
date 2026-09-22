/**
 * ============================================================================
 * 异能共享契约（contracts/ability.ts）
 * ----------------------------------------------------------------------------
 * 【铁律】异能只能改写「信息」与「时间」，绝不改写胜负与计分。
 * 原因是工程性的：若异能能改变结果，每上一个 UGC 游戏都要重新平衡全部异能。
 * 只影响信息与节奏的异能在任何游戏里自动成立，包括玩家明天才发明的游戏。
 *
 * 异能挂在对局管道的五个钩子上，而不是写进某个游戏：
 *   H1 onProject      投影修饰：多看 / 看歪
 *   H2 onBeforeDecide 思考修饰：加时 / 加算力（= token 预算）
 *   H3 onSubmit       动作修饰：改手 / 虚晃
 *   H4 onReveal       揭晓修饰：窥见推理链
 *   H5 onSettle       结算修饰：只动碎片，不动胜负
 *
 * 48 种异能 × N 个游戏，只需要 5 个接入点。
 * ============================================================================
 */
import type { Suit } from "./gameSdk";
import type { Tier } from "./cards";

export type AbilityHook =
  | "onProject"
  | "onBeforeDecide"
  | "onSubmit"
  | "onReveal"
  | "onSettle";

export const ABILITY_HOOK_META: Record<
  AbilityHook,
  { code: string; name: string; desc: string }
> = {
  onProject: {
    code: "H1",
    name: "投影",
    desc: "改写你看到的世界：多看一分，或看歪一分。",
  },
  onBeforeDecide: {
    code: "H2",
    name: "思虑",
    desc: "改写你思考的余裕：心力即算力。",
  },
  onSubmit: {
    code: "H3",
    name: "落手",
    desc: "改写你已落下的手，或让对手看见一只假的手。",
  },
  onReveal: {
    code: "H4",
    name: "揭晓",
    desc: "在真相显形的一瞬，多窥见一寸。",
  },
  onSettle: {
    code: "H5",
    name: "结算",
    desc: "改写碎片的流向 —— 但改不了谁赢。",
  },
};

/* ------------------------------------------------------------------ */
/* 触发条件：只读公开信息                                                */
/* ------------------------------------------------------------------ */

/**
 * 触发条件的判定上下文。
 *
 * 【关键约束】本结构只包含「公开信息」——任何座位、任何观众都能看到的量。
 * 若把私密信息（他人底牌、他人身份）放进来，trigger 本身就成了泄漏通道：
 * 玩家可以通过「异能是否可用」反推出不该知道的事实。
 *
 * 新增字段前请自问：这个量是否写在公共日志里？不是，就不能加。
 */
export interface TriggerContext {
  /** 当前轮次（1 起） */
  round: number;
  /** 总轮数（未知为 null，如淘汰制） */
  totalRounds: number | null;
  /** 自己的座位号 */
  seat: number;
  /** 自己当前的公开排名（1 = 第一名） */
  myRank: number;
  /** 存活/在场席位数 */
  aliveCount: number;
  /** 自己是否已提交本轮动作（尚未揭晓） */
  hasSubmitted: boolean;
  /** 连续判断正确的轮数（由公开 reveal 累计） */
  correctStreak: number;
  /** 连续未使用任何异能的轮数 */
  idleStreak: number;
  /** 场上是否存在公开宣告的结盟关系 */
  hasPublicAlliance: boolean;
  /** 自己持有的情报卡 id（持有关系是公开的） */
  heldIntelCardIds: string[];
  /** 是否处于开局前的声明窗口 */
  inPreMatchWindow: boolean;
}

/** 触发条件判定函数（纯函数，只读 TriggerContext） */
export type TriggerFn = (ctx: TriggerContext) => boolean;

/* ------------------------------------------------------------------ */
/* 异能定义                                                            */
/* ------------------------------------------------------------------ */

/** 舞台插槽：异能按此自动摆放按钮与特效，新增异能无需写 UI 代码 */
export type AbilitySlot =
  | "seatBadge"
  | "actionBar"
  | "revealOverlay"
  | "settleOverlay"
  | "preMatch";

export interface AbilityDef {
  id: string;
  name: string;
  /** 绑定的影从 id（对应 src/data/echoes.ts） */
  echoId: string;
  suit: Suit;
  hook: AbilityHook;
  slot: AbilitySlot;
  /** 触发条件的人类可读描述（展示给玩家与观众） */
  triggerLabel: string;
  /** 触发条件判定 */
  trigger: TriggerFn;
  /** 效果描述 */
  effect: string;
  /** 心力开销（= token 预算单位，世界观上是精神资源） */
  cost: number;
  /** 一句世界观：谁教你的 */
  lore: string;
}

/* ------------------------------------------------------------------ */
/* 充能：位阶决定次数                                                    */
/* ------------------------------------------------------------------ */

export const CHARGES_BY_TIER: Record<Tier, number> = {
  huang: 1,
  xuan: 2,
  di: 3,
  tian: 3,
};

/** 地阶起可携带副异能，天阶额外获得一条常驻被动 */
export function abilitySlotsForTier(tier: Tier): {
  charges: number;
  secondary: boolean;
  passive: boolean;
} {
  return {
    charges: CHARGES_BY_TIER[tier],
    secondary: tier === "di" || tier === "tian",
    passive: tier === "tian",
  };
}

/* ------------------------------------------------------------------ */
/* 局内运行态                                                          */
/* ------------------------------------------------------------------ */

export interface AbilityRuntimeState {
  abilityId: string;
  /** 剩余充能 */
  chargesLeft: number;
  /** 已使用的轮次记录 */
  usedRounds: number[];
}

/** 能否使用：充能未尽 且 触发条件满足 */
export function canUseAbility(
  def: AbilityDef,
  state: AbilityRuntimeState,
  ctx: TriggerContext
): boolean {
  if (state.chargesLeft <= 0) return false;
  if (state.usedRounds.includes(ctx.round)) return false;
  return def.trigger(ctx);
}

/**
 * ============================================================================
 * 八影从开局异能（contracts/abilities.data.ts）
 * ----------------------------------------------------------------------------
 * 契约时选一位影从 = 选定开局异能。这让 src/data/echoes.ts 里八个影从的
 * 人设第一次有了机制意义：选白泽得深算系，选讹兽得欺诈系。
 *
 * 全部 trigger 只读 TriggerContext（公开信息），见 contracts/ability.ts 的
 * 约束说明。异能公开可见、效果不可见 —— 对手知道你带了「覆言」，
 * 但不知道你何时用了，这个信息结构本身就是博弈。
 * ============================================================================
 */
import type { AbilityDef } from "./ability";

export const ABILITIES: AbilityDef[] = [
  /* ---------------- ♠ 玄渊 · 欺骗 ---------------- */
  {
    id: "ab-baize-xingpan",
    name: "星盘",
    echoId: "baize",
    suit: "spade",
    hook: "onReveal",
    slot: "revealOverlay",
    triggerLabel: "连续两轮判断正确后",
    trigger: ctx => ctx.correctStreak >= 2,
    effect: "揭晓时读到一名对手推理链的一句摘要。",
    cost: 2,
    lore: "白泽收起星盘时说：你的犹豫，早已写在星盘之上。",
  },
  {
    id: "ab-eshou-fuyan",
    name: "覆言",
    echoId: "eshou",
    suit: "spade",
    hook: "onSubmit",
    slot: "actionBar",
    triggerLabel: "已提交、尚未揭晓时",
    trigger: ctx => ctx.hasSubmitted,
    effect: "改一次已落下的手，公共日志不留痕迹。",
    cost: 3,
    lore: "讹兽笑着问：我说真话的时候，你信吗？",
  },

  /* ---------------- ♣ 青野 · 计算 ---------------- */
  {
    id: "ab-xuanji-huntian",
    name: "浑天",
    echoId: "xuanji",
    suit: "club",
    hook: "onBeforeDecide",
    slot: "actionBar",
    triggerLabel: "本局进入后半程",
    trigger: ctx =>
      ctx.totalRounds !== null && ctx.round > Math.floor(ctx.totalRounds / 2),
    effect: "本轮思考预算 ×3：多轮自洽采样后再落手。",
    cost: 4,
    lore: "璇玑说：每一颗算珠，都是一次心跳。",
  },
  {
    id: "ab-shouzhuo-budong",
    name: "不动",
    echoId: "shouzhuo",
    suit: "club",
    hook: "onBeforeDecide",
    slot: "actionBar",
    triggerLabel: "连续三轮未使用任何异能",
    trigger: ctx => ctx.idleStreak >= 3,
    effect: "囤积的心力一次性释放（最多叠三轮）。",
    cost: 0,
    lore: "老龟抬眼：急什么，十日还长。",
  },

  /* ---------------- ♥ 丹丘 · 心理 ---------------- */
  {
    id: "ab-qingnang-xuanhu",
    name: "悬壶",
    echoId: "qingnang",
    suit: "heart",
    hook: "onProject",
    slot: "seatBadge",
    triggerLabel: "场上存在公开的结盟关系",
    trigger: ctx => ctx.hasPublicAlliance,
    effect: "看见一名对手的意图类别（不是具体动作）。",
    cost: 2,
    lore: "青囊提起药箱：你的伤在心里，让我看看。",
  },
  {
    id: "ab-ajiu-tingxin",
    name: "听心",
    echoId: "ajiu",
    suit: "heart",
    hook: "onProject",
    slot: "seatBadge",
    triggerLabel: "自己处于最后一名",
    trigger: ctx => ctx.myRank >= ctx.aliveCount && ctx.aliveCount > 1,
    effect: "看见下一轮的提交顺序。",
    cost: 1,
    lore: "阿九摆摆手：别解释啦，你的尾巴已经露出来了。",
  },

  /* ---------------- ♦ 金壤 · 资源 ---------------- */
  {
    id: "ab-zhuyin-zhouye",
    name: "昼夜",
    echoId: "zhuyin",
    suit: "diamond",
    hook: "onSettle",
    slot: "preMatch",
    triggerLabel: "开局前声明，不可撤回",
    trigger: ctx => ctx.inPreMatchWindow,
    effect: "本局碎片收益 ×2；若败，门票翻倍扣除。",
    cost: 0,
    lore: "烛阴闭上一只眼：筹码即时间，而我掌管昼夜。",
  },
  {
    id: "ab-baixiao-fansheng",
    name: "贩声",
    echoId: "baixiao",
    suit: "diamond",
    hook: "onReveal",
    slot: "revealOverlay",
    triggerLabel: "持有任意情报卡",
    trigger: ctx => ctx.heldIntelCardIds.length > 0,
    effect: "向一名对手投放一条情报——可真，可假。",
    cost: 2,
    lore: "百晓生摇着扇：这局的消息，作价几何？",
  },
];

const abilityById = new Map(ABILITIES.map(a => [a.id, a]));
const abilityByEcho = new Map(ABILITIES.map(a => [a.echoId, a]));

export function getAbility(id: string): AbilityDef | undefined {
  return abilityById.get(id);
}

/** 影从 id → 其绑定异能（契约选人即选异能） */
export function abilityOfEcho(echoId: string): AbilityDef | undefined {
  return abilityByEcho.get(echoId);
}

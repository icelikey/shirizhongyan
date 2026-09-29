/**
 * 《终焉的世界》策略卡牌池。
 *
 * 这些卡只提供规则书声明过的“信息 / 时机 / 反制”权限；它们不是一套
 * 可以绕过服务端结算的脚本。新游戏接入时先声明支持哪些 ruleHook，
 * 再由服务端根据当前阶段生成合法策略动作。
 */
import type {
  TacticCard,
  TacticEffect,
  TacticGameScope,
  TacticLoadout,
  TacticTarget,
  TacticTiming,
} from "./cards";

type TacticCardInput = Omit<TacticCard, "kind" | "suit"> & {
  suit?: TacticCard["suit"];
};

function tactic(input: TacticCardInput): TacticCard {
  return {
    ...input,
    kind: "tactic",
    suit: input.suit ?? null,
  };
}

const INFORMATION: readonly TacticCard[] = [
  tactic({
    id: "tactic-bottom-eye",
    name: "照底",
    rarity: "rare",
    compatibleGames: ["numberGuess", "pollDuel", "pirateGold", "werewolf", "debate"],
    timing: "before-reveal",
    effect: "peek-private-commitment",
    target: "opponent",
    charges: 1,
    cooldown: 0,
    counterable: true,
    ruleHook: "projection.peek_private_commitment",
    effectText: "在底牌尚未揭晓时，查看一名目标的已提交动作类别或牌面摘要；不读取身份、完整推理链或系统结算值。",
    lore: "底牌没有说谎，先开口的是看牌的人。",
  }),
  tactic({
    id: "tactic-echo-lens",
    name: "回声镜",
    rarity: "common",
    compatibleGames: ["all"],
    timing: "after-reveal",
    effect: "restore-public-evidence",
    target: "public-event",
    charges: 2,
    cooldown: 1,
    counterable: false,
    ruleHook: "evidence.restore_public_event",
    effectText: "把一条已经公开但被跳过的事件重新推到当前证据流顶部。",
    lore: "被忽略的证据不会消失，只是在等一个愿意回头的人。",
  }),
];

const COMMITMENT: readonly TacticCard[] = [
  tactic({
    id: "tactic-bottom-exchange",
    name: "换底",
    rarity: "rare",
    compatibleGames: ["numberGuess", "pollDuel", "pirateGold", "debate"],
    timing: "before-reveal",
    effect: "swap-private-commitment",
    target: "mutual",
    charges: 1,
    cooldown: 0,
    counterable: true,
    ruleHook: "commitment.swap_unrevealed",
    effectText: "在双方都已提交且尚未揭示时，与一名同意交换的目标互换本轮底牌；双方都会收到交换事件，不能改变已结算事实。",
    lore: "你以为交换的是牌，其实交换的是对彼此的判断。",
  }),
  tactic({
    id: "tactic-false-signal",
    name: "伪信",
    rarity: "common",
    compatibleGames: ["numberGuess", "pollDuel", "pirateGold", "werewolf", "debate"],
    timing: "after-submit",
    effect: "plant-false-signal",
    target: "public-event",
    charges: 1,
    cooldown: 2,
    counterable: true,
    ruleHook: "projection.plant_false_signal",
    effectText: "为观测层生成一个带有‘伪信’标签的假动作提示；真实动作和结算不会被替换。",
    lore: "真正危险的谎言，从来不要求你相信它。",
  }),
];

const COUNTERS: readonly TacticCard[] = [
  tactic({
    id: "tactic-silent-needle",
    name: "哑针",
    rarity: "rare",
    compatibleGames: ["all"],
    timing: "on-ability",
    effect: "suppress-pending-ability",
    target: "opponent",
    charges: 1,
    cooldown: 1,
    counterable: true,
    ruleHook: "ability.cancel_pending",
    effectText: "让一项尚未结算、且标记为可反制的对方异能失效；不影响其已记录的消耗，也不改变基础动作。",
    lore: "有些声音不是被驳倒，而是在落地之前失去了回响。",
  }),
  tactic({
    id: "tactic-counterseal",
    name: "封脉",
    rarity: "rare",
    compatibleGames: ["superpowerBilliards", "beastRace", "werewolf"],
    timing: "on-ability",
    effect: "suppress-pending-ability",
    target: "opponent",
    charges: 1,
    cooldown: 2,
    counterable: true,
    ruleHook: "ability.cancel_pending_same_window",
    effectText: "只封锁同一响应窗口中尚未被内核接受的一次异能提案；物理、位置、积分和已生效状态不回滚。",
    lore: "封住的不是力量，是力量想要越过规则的那一步。",
  }),
];

const TEMPO: readonly TacticCard[] = [
  tactic({
    id: "tactic-extra-breath",
    name: "借息",
    rarity: "common",
    compatibleGames: ["all"],
    timing: "before-submit",
    effect: "extend-decision-window",
    target: "self",
    charges: 1,
    cooldown: 2,
    counterable: false,
    ruleHook: "timing.extend_decision_window",
    effectText: "把自己的思考窗口延长一次；不能延长已经超时的阶段，也不能阻塞其他席位结算。",
    lore: "终焉允许你多呼吸一次，但不会替你决定往哪边走。",
  }),
  tactic({
    id: "tactic-deadline-bell",
    name: "催命铃",
    rarity: "common",
    compatibleGames: ["numberGuess", "pollDuel", "pirateGold", "beastRace"],
    timing: "after-submit",
    effect: "extend-decision-window",
    target: "opponent",
    charges: 1,
    cooldown: 2,
    counterable: true,
    ruleHook: "timing.force_window_boundary",
    effectText: "标记一名目标的行动窗口即将关闭；只改变公开节奏提示，不直接替目标提交动作。",
    lore: "钟声不是命令，只有听见钟声的人才会暴露自己的急。",
  }),
];

export const TACTIC_CARDS: readonly TacticCard[] = [
  ...INFORMATION,
  ...COMMITMENT,
  ...COUNTERS,
  ...TEMPO,
];

const tacticById = new Map(TACTIC_CARDS.map(card => [card.id, card]));

export function getTacticCard(id: string): TacticCard | undefined {
  return tacticById.get(id);
}

export function tacticCardsForGame(game: TacticGameScope): TacticCard[] {
  return TACTIC_CARDS.filter(card => card.compatibleGames.includes("all") || card.compatibleGames.includes(game));
}

/** 对 Agent 暴露的只读牌池目录；不包含玩家所有权、剩余次数或秘密装备。 */
export function publicTacticCardCatalog(game?: TacticGameScope) {
  return (game ? tacticCardsForGame(game) : TACTIC_CARDS).map(card => ({
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    compatibleGames: [...card.compatibleGames],
    timing: card.timing,
    effect: card.effect,
    target: card.target,
    charges: card.charges,
    cooldown: card.cooldown,
    counterable: card.counterable,
    ruleHook: card.ruleHook,
    effectText: card.effectText,
  }));
}

export function isTacticGameScope(value: string): value is TacticGameScope {
  return [
    "numberGuess",
    "pollDuel",
    "pirateGold",
    "flyTease",
    "superpowerBilliards",
    "beastRace",
    "werewolf",
    "debate",
    "all",
  ].includes(value);
}

export function tacticCardsByEffect(effect: TacticEffect): TacticCard[] {
  return TACTIC_CARDS.filter(card => card.effect === effect);
}

export interface TacticLoadoutValidation {
  valid: boolean;
  errors: string[];
  cards: TacticCard[];
}

/**
 * 装备校验只做确定性结构检查；具体“此刻能不能用”仍由房间阶段、
 * RuleBook、充能账本和目标投影共同决定。
 */
export function validateTacticLoadout(loadout: TacticLoadout): TacticLoadoutValidation {
  const errors: string[] = [];
  const cards: TacticCard[] = [];

  if (loadout.maxCards < 3 || loadout.maxCards > 8) {
    errors.push("策略卡组容量必须在 3–8 张之间");
  }
  if (loadout.cardIds.length < 3) {
    errors.push("策略卡组至少装备 3 张卡");
  }
  if (loadout.cardIds.length > loadout.maxCards) {
    errors.push("装备卡数量超过当前容量");
  }

  const seen = new Set<string>();
  const effectCounts = new Map<TacticEffect, number>();
  for (const id of loadout.cardIds) {
    if (seen.has(id)) {
      errors.push(`策略卡不得重复装备：${id}`);
      continue;
    }
    seen.add(id);

    const card = getTacticCard(id);
    if (!card) {
      errors.push(`未知策略卡：${id}`);
      continue;
    }
    if (!card.compatibleGames.includes("all") && !card.compatibleGames.includes(loadout.game)) {
      errors.push(`策略卡 ${card.name} 不适用于 ${loadout.game}`);
    }
    const nextCount = (effectCounts.get(card.effect) ?? 0) + 1;
    effectCounts.set(card.effect, nextCount);
    if (nextCount > 2) {
      errors.push(`同一效果最多装备 2 张：${card.effect}`);
    }
    cards.push(card);
  }

  return { valid: errors.length === 0, errors, cards };
}

export function isTacticTiming(value: string, timing: TacticTiming): boolean {
  return value === timing;
}

export function isTacticTarget(value: string, target: TacticTarget): boolean {
  return value === target;
}

/**
 * ============================================================================
 * 规则书数据（contracts/rulebooks.data.ts）
 * ----------------------------------------------------------------------------
 * 每本规则书的条款正文必须写成「可判定的句子」——因为它同时是三方的依据：
 *   1. Agent 质询时引用的对象
 *   2. AI 裁判裁决时的判断依据
 *   3. 玩家在规则图鉴里读到的正文
 *
 * 写条款的纪律：说清「若 X 则 Y」，不写设计意图。
 * 反例：「平局时应公平处理」——无法判定，AI 裁判无从下手。
 * 正例：「若两名玩家距目标值等距，先提交者胜。」
 *
 * 条款分类决定可否质询（见 rulebook.ts 铁律二）：
 * victory/scoring 不可质询，timing/edge/conduct 可质询。
 * 刻意在每本书里留下边缘条款——那是质询机制的主战场。
 * ============================================================================
 */
import type { RuleBook } from "./rulebook";

/* ------------------------------------------------------------------ */
/* ♣ 青野 · 猜平均数                                                    */
/* ------------------------------------------------------------------ */

export const RB_GUESS: RuleBook = {
  id: "rb-guess",
  name: "青野算经",
  version: 1,
  template: "numberGuess",
  clauses: [
    {
      id: "c-guess-target",
      title: "目标值",
      text: "每轮目标值 = 全部有效提交的算术平均值 × 规则书设定的倍率（官方为 2/3）。",
      category: "victory",
    },
    {
      id: "c-guess-winner",
      title: "轮次胜者",
      text: "距目标值绝对差最小者为本轮胜者，得 scoreWin 分；次近者得 scoreSecond 分。",
      category: "victory",
    },
    {
      id: "c-guess-final",
      title: "终局名次",
      text: "全部轮次结束后按累计积分排名；积分相同者，以轮次胜出次数多者列前。",
      category: "scoring",
    },
    {
      id: "c-guess-range",
      title: "出数范围",
      text: "提交值须落在规则书设定的 [min, max] 闭区间内，可为实数。越界提交视为无效。",
      category: "victory",
    },

    /* ↓ 以下为可质询条款：质询机制的主战场 ↓ */
    {
      id: "c-guess-tie",
      title: "等距裁断",
      text: "若两名或以上玩家距目标值绝对差完全相等，先提交者列前。",
      category: "edge",
    },
    {
      id: "c-guess-timeout",
      title: "超时兜底",
      text: "提交窗结束仍未提交者，以区间中值（(min+max)/2）代为提交，且不计入「先提交」顺序。",
      category: "edge",
    },
    {
      id: "c-guess-window",
      title: "提交时限",
      text: "每轮提交窗为规则书设定的 submitWindowSec 秒，自上一轮揭晓完成起算。",
      category: "timing",
    },
    {
      id: "c-guess-retract",
      title: "反悔窗",
      text: "提交后 3 秒内可撤回重提，撤回后「先提交」顺序以最后一次提交为准。",
      category: "edge",
    },
    {
      id: "c-guess-invalid",
      title: "无效提交的均值处理",
      text: "无效提交不计入平均值的分母，但该座位本轮不得分。",
      category: "edge",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ♣ 青野 · 红眼病（少数派获胜）                                         */
/* ------------------------------------------------------------------ */

export const RB_POLL: RuleBook = {
  id: "rb-poll",
  name: "众寡之辩",
  version: 1,
  template: "pollDuel",
  clauses: [
    {
      id: "c-poll-minority",
      title: "少数派获胜",
      text: "本轮得票最少且唯一的选项为少数派，选中该选项者得 scoreWin 分。",
      category: "victory",
    },
    {
      id: "c-poll-final",
      title: "终局名次",
      text: "全部轮次结束后按累计积分排名。",
      category: "scoring",
    },

    /* ↓ 可质询 ↓ */
    {
      id: "c-poll-alltie",
      title: "并列最少",
      text: "若两个或以上选项并列得票最少，本轮无人得分（流局）。",
      category: "edge",
    },
    {
      id: "c-poll-empty",
      title: "空选项",
      text: "无人选择的选项不参与「最少」比较，视为不存在。",
      category: "edge",
    },
    {
      id: "c-poll-timeout",
      title: "超时兜底",
      text: "提交窗结束仍未选择者，视为选择第一个选项。",
      category: "edge",
    },
    {
      id: "c-poll-window",
      title: "提交时限",
      text: "每轮提交窗为规则书设定的 submitWindowSec 秒。",
      category: "timing",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ♠ 玄渊 · 月影狼人杀                                                  */
/* ------------------------------------------------------------------ */

export const RB_WEREWOLF: RuleBook = {
  id: "rb-werewolf",
  name: "玄渊夜谳",
  version: 1,
  template: "werewolf",
  clauses: [
    {
      id: "c-wolf-victory",
      title: "胜负条件",
      text: "狼人阵营在存活好人数不大于存活狼人数时获胜；好人阵营在全部狼人被放逐或毒杀时获胜。",
      category: "victory",
    },
    {
      id: "c-wolf-night",
      title: "夜间顺序",
      text: "夜晚依次为：狼人共同选择击杀目标 → 预言家查验一人阵营 → 女巫决定是否解救或毒杀。",
      category: "victory",
    },
    {
      id: "c-wolf-witch",
      title: "女巫用药",
      text: "解药与毒药各一瓶，全局各限一次；同一夜不得同时使用两瓶。",
      category: "victory",
    },

    /* ↓ 可质询 ↓ */
    {
      id: "c-wolf-vote-tie",
      title: "平票处理",
      text: "放逐投票平票时，平票者依次发言一轮后重投；再次平票则本轮无人被放逐。",
      category: "edge",
    },
    {
      id: "c-wolf-abstain",
      title: "弃权",
      text: "弃权不计入任何候选人票数，且不影响平票判定。",
      category: "edge",
    },
    {
      id: "c-wolf-selfsave",
      title: "女巫自救",
      text: "女巫可在首夜使用解药自救；第二夜起不得对自己使用解药。",
      category: "edge",
    },
    {
      id: "c-wolf-lastwords",
      title: "遗言权",
      text: "被放逐者有遗言；夜间被击杀者无遗言。",
      category: "timing",
    },
    {
      id: "c-wolf-speech-order",
      title: "发言顺序",
      text: "白天自上一夜死者的下一位存活座位起顺时针发言，每人一次。",
      category: "timing",
    },
    {
      id: "c-wolf-collusion",
      title: "串通认定",
      text: "玩家不得在对局外通道交换身份信息；经裁判团认定串通者，本局判负。",
      category: "conduct",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* ♦ 金壤 · 海盗分金                                                    */
/* ------------------------------------------------------------------ */

export const RB_PIRATE: RuleBook = {
  id: "rb-pirate",
  name: "金壤分潮",
  version: 1,
  template: "pirateGold",
  clauses: [
    {
      id: "c-pirate-propose",
      title: "提案权",
      text: "由当前存活座位中序号最小者提出分配方案，方案须分配全部金币且每份为非负整数。",
      category: "victory",
    },
    {
      id: "c-pirate-vote",
      title: "表决",
      text: "全部存活者对方案表决，赞成票数不少于半数（含提案人自己）则方案通过。",
      category: "victory",
    },
    {
      id: "c-pirate-fail",
      title: "方案否决",
      text: "方案未通过则提案人出局且不得分，提案权移交下一位存活者。",
      category: "victory",
    },

    /* ↓ 可质询 ↓ */
    {
      id: "c-pirate-halftie",
      title: "半数的含义",
      text: "存活人数为偶数时，赞成票等于存活人数一半即视为通过。",
      category: "edge",
    },
    {
      id: "c-pirate-last",
      title: "最后一人",
      text: "仅剩一名存活者时，其方案自动通过，独得全部金币。",
      category: "edge",
    },
    {
      id: "c-pirate-timeout",
      title: "表决超时",
      text: "表决窗结束仍未表决者，视为反对。",
      category: "edge",
    },
    {
      id: "c-pirate-promise",
      title: "承诺效力",
      text: "提案阶段的口头承诺不具强制效力，违诺不受规则制裁。",
      category: "conduct",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 注册表                                                              */
/* ------------------------------------------------------------------ */

export const RULEBOOKS: RuleBook[] = [
  RB_GUESS,
  RB_POLL,
  RB_WEREWOLF,
  RB_PIRATE,
];

const bookById = new Map(RULEBOOKS.map(b => [b.id, b]));
const bookByTemplate = new Map(RULEBOOKS.map(b => [b.template, b]));

export function getRuleBook(id: string): RuleBook | undefined {
  return bookById.get(id);
}

/** 模板 → 其官方规则书（房间开局时据此确定 rulebookId） */
export function ruleBookForTemplate(template: string): RuleBook | undefined {
  return bookByTemplate.get(template);
}

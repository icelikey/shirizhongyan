/**
 * 《终焉》世界宪章（元规则数据）。
 *
 * 这里描述世界如何理解失败、局部胜利和轮回，不把这些原则写进某个
 * 小游戏的 reducer。具体 GamePackage 只实现自己的玩法；世界层根据
 * 这份版本化宪章接收可审计的结果和证据。
 */

export interface WorldRecurrenceTruth {
  id: string;
  title: string;
  requires: "failureCount" | "deathCount";
  threshold: number;
  memoryCardId: string;
  clue: string;
}

export const WORLD_META_RULES = {
  id: "endgame-world-constitution",
  version: "0.1.0",
  principle: "local_optimum_is_not_long_term_optimum",
  rules: [
    {
      id: "failure-is-evidence",
      text: "失败产生可追溯证据，不自动等于惩罚清空；失败证据可以在后续轮回中改变判断。",
    },
    {
      id: "wins-do-not-confirm-truth",
      text: "局部胜利可以改变生命和楼层，但不能单独确认世界真相。",
    },
    {
      id: "recurrence-carries-choice",
      text: "死亡回到底层时，只按规则携带被选择的记忆；死亡本身会留下新的轮回证据。",
    },
    {
      id: "history-is-continued",
      text: "已结算事件不可被新文案抹除；后续内容必须引用前序事件或公开锚点。",
    },
  ],
  authority: "world-rulebook",
  appliesTo: ["world-cycle", "game-package", "world-emergence"],
} as const;

/** 这是世界宪章中的长期路径门槛，不是任何单款游戏的胜负参数。 */
export const LONG_TERM_GATE = {
  minFailures: 3,
  minDeaths: 1,
  minTruths: 3,
  minMapFragments: 2,
} as const;

/**
 * 失败和轮回如何显现为世界线索，由世界宪章数据声明；游戏 reducer
 * 只负责提交结果，不负责解释这些文本。
 */
export const WORLD_RECURRENCE_TRUTHS: readonly WorldRecurrenceTruth[] = [
  {
    id: "truth-local-optimum",
    title: "局部最优的陷阱",
    requires: "failureCount",
    threshold: 1,
    memoryCardId: "memory-failed-proposal",
    clue: "第一次失败证明的是这条路不够长，不是你没有赢过。",
  },
  {
    id: "truth-cost-of-repeat",
    title: "重复的代价",
    requires: "failureCount",
    threshold: 3,
    memoryCardId: "memory-unheard-voice",
    clue: "连续复用局部最优，会让未被听见的证据在下一轮变得更重。",
  },
  {
    id: "truth-returning-world",
    title: "回来的不是原人",
    requires: "deathCount",
    threshold: 1,
    memoryCardId: "memory-loop-mark",
    clue: "轮回保留的是可验证的痕迹，不是上一轮的全部自我。",
  },
  {
    id: "truth-route-beyond-win",
    title: "胜利之外的路",
    requires: "deathCount",
    threshold: 2,
    memoryCardId: "memory-map-under-skin",
    clue: "登上更高一层不等于接近出口，真正的路线藏在失败留下的地图里。",
  },
  {
    id: "truth-door-inside",
    title: "门从里面锁上",
    requires: "failureCount",
    threshold: 6,
    memoryCardId: "memory-blank-note",
    clue: "终焉门的答案不会从胜者名单里自动出现，必须由多次反照补全。",
  },
] as const;

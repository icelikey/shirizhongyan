/**
 * ============================================================================
 * 规则书共享契约（contracts/rulebook.ts）
 * ----------------------------------------------------------------------------
 * 分布式裁判机制的地基。在此之前 rulebookId / clauseId 都只是裸字符串，
 * 没有条款正文，因此无从质询——本文件让「规则」成为可被引用的实体。
 *
 * 【核心机制】世界的规则由 AI 的博弈真实地演化：
 *   Agent 引条款质询 → 裁判团（3/5/7 席）投票 → 判例沉淀 → 规则书版本 +1
 *
 * 【铁律一·判例不溯及既往】
 * 判例永不改判已结算的胜负。原因是工程性的：match_logs 的回放依赖
 * 「seed + rulebookId + 事件流」可复现，若判例能追溯改判，历史回放即失效。
 * 判例只影响本局后续与未来使用同一规则书的对局。
 *
 * 【铁律二·核心条款不可质询】
 * 决定胜负判定的条款 appealable: false。否则 Agent 可以通过质询直接改写
 * 胜负，质询就从「钻研规则」退化为「攻击裁判」。
 * 可质询的是边缘地带：平局如何裁、超时如何处理、弃权是否计入。
 *
 * 【铁律三·裁判不得为本局参与者】
 * 见 judgeQuorum 的 excludeSeats 约束。否则可自裁自胜。
 * ============================================================================
 */

/* ------------------------------------------------------------------ */
/* 条款                                                                */
/* ------------------------------------------------------------------ */

/**
 * 条款分类。决定该条款是否可被质询——这不是标签，是硬约束：
 * - victory  胜负判定（不可质询，铁律二）
 * - scoring  计分规则（不可质询）
 * - timing   时序与时限（可质询）
 * - edge     边缘情形：平局、弃权、超时兜底（可质询，质询的主战场）
 * - conduct  行为规范：发言合规、串通判定（可质询，需 AI 裁判做语义判断）
 */
export type ClauseCategory =
  | "victory"
  | "scoring"
  | "timing"
  | "edge"
  | "conduct";

/** 分类 → 是否开放质询。单一事实来源，勿在别处重复判断。 */
export const CLAUSE_APPEALABLE: Record<ClauseCategory, boolean> = {
  victory: false,
  scoring: false,
  timing: true,
  edge: true,
  conduct: true,
};

export interface Clause {
  /** 条款 id，形如 'c-guess-tie'（规则书内唯一） */
  id: string;
  /** 条款标题（UI 列表展示） */
  title: string;
  /**
   * 条款正文。这是 Agent 质询时引用的对象，也是 AI 裁判裁决的依据，
   * 因此必须写成可判定的句子，不能写成模糊的设计意图。
   */
  text: string;
  category: ClauseCategory;
}

/** 条款是否可被质询（唯一判定入口） */
export function isAppealable(clause: Clause): boolean {
  return CLAUSE_APPEALABLE[clause.category];
}

/* ------------------------------------------------------------------ */
/* 规则书                                                              */
/* ------------------------------------------------------------------ */

export interface RuleBook {
  /** 规则书 id，形如 'rb-guess'（全局唯一，落 match_logs.rulebookId） */
  id: string;
  name: string;
  /**
   * 版本号。每条被采纳的判例令其 +1。
   * 回放时必须按当时的版本解释规则，故 match_logs 应记录版本。
   */
  version: number;
  /** 关联的游戏模板（一个模板可有多本规则书：官方版 / 判例演化版） */
  template: string;
  clauses: Clause[];
}

/** 取条款（找不到返回 undefined，调用方须处理） */
export function findClause(
  book: RuleBook,
  clauseId: string,
): Clause | undefined {
  return book.clauses.find(c => c.id === clauseId);
}

/** 该规则书中所有可质询条款（前端质询面板的选项来源） */
export function appealableClauses(book: RuleBook): Clause[] {
  return book.clauses.filter(isAppealable);
}

/* ------------------------------------------------------------------ */
/* 裁判团                                                              */
/* ------------------------------------------------------------------ */

/**
 * 裁判类型（对应三种裁判形态）：
 * - algorithm 算法裁判 J0：规则确定，纯函数判定，无需投票
 * - ai       AI 裁判 J1：需语义判断（海龟汤、发言合规）
 * - agent    Agent 裁判 J2：玩家 Agent 临时充当，引入博弈
 */
export type JudgeKind = "algorithm" | "ai" | "agent";

export const JUDGE_KIND_META: Record<
  JudgeKind,
  { code: string; name: string; desc: string }
> = {
  algorithm: {
    code: "J0",
    name: "算律",
    desc: "规则写定之处，由算法裁断，不容置疑也不必投票。",
  },
  ai: {
    code: "J1",
    name: "明镜",
    desc: "规则含混之处，由智能体依条款正文裁断。",
  },
  agent: {
    code: "J2",
    name: "众议",
    desc: "由他人的影从临时充任裁判——他们也有立场。",
  },
};

/** 法定人数只能是奇数 3/5/7（偶数无法产生多数） */
export const QUORUM_SIZES = [3, 5, 7] as const;
export type QuorumSize = (typeof QUORUM_SIZES)[number];

export function isValidQuorum(n: number): n is QuorumSize {
  return (QUORUM_SIZES as readonly number[]).includes(n);
}

/** 一名裁判 */
export interface Judge {
  /** 裁判席位号（0 起，与对局座位号无关） */
  index: number;
  kind: JudgeKind;
  /** 展示名（AI 裁判为影从名，Agent 裁判为其 Key 名） */
  name: string;
  /** Agent 裁判对应的影从 id（算法裁判为 null） */
  echoId: string | null;
}

/** 裁判团 */
export interface JudgePanel {
  size: QuorumSize;
  judges: Judge[];
  /**
   * 被排除的对局座位号（铁律三：本局参与者不得任裁判）。
   * 组建裁判团时必须传入本局全部座位，由 buildPanel 保证。
   */
  excludeSeats: number[];
}

/* ------------------------------------------------------------------ */
/* 裁决                                                                */
/* ------------------------------------------------------------------ */

/** 单票 */
export interface JudgeVote {
  judgeIndex: number;
  /** true = 支持采纳质询 */
  upheld: boolean;
  /** 裁决理由（AI/Agent 裁判产出，算法裁判为条款引用） */
  reason: string;
}

/**
 * 计票：过半即采纳。
 *
 * 因法定人数恒为奇数，不存在平票，故无需平局规则——
 * 这正是限定 3/5/7 的工程理由，而不只是仪式感。
 */
export function tallyVotes(votes: readonly JudgeVote[]): {
  upheld: boolean;
  upholdCount: number;
  total: number;
} {
  const upholdCount = votes.filter(v => v.upheld).length;
  const total = votes.length;
  return { upheld: upholdCount * 2 > total, upholdCount, total };
}

/** 一次完整裁决（落 rulings 表 + 生成 RulingEvent） */
export interface Verdict {
  rulebookId: string;
  /** 裁决时的规则书版本（回放需要） */
  rulebookVersion: number;
  clauseId: string;
  /** 质询主张原文 */
  assertion: string;
  /** 发起质询的座位 */
  appellantSeat: number;
  votes: JudgeVote[];
  upheld: boolean;
  /** 裁决摘要（判例卡正文） */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* 质询的合法性前置校验                                                  */
/* ------------------------------------------------------------------ */

/** 质询被拒的原因（前端需给出可读提示，故枚举而非布尔） */
export type AppealRejection =
  | "clause-not-found"
  | "clause-not-appealable"
  | "assertion-too-short"
  | "already-ruled-this-match"
  | "quota-exhausted";

export const APPEAL_REJECTION_LABEL: Record<AppealRejection, string> = {
  "clause-not-found": "该条款不存在于本局规则书",
  "clause-not-appealable": "胜负与计分条款不可质询",
  "assertion-too-short": "主张需至少 10 字，须言之有物",
  "already-ruled-this-match": "本局该条款已有裁决，不可重复质询",
  "quota-exhausted": "本局质询次数已用尽",
};

/** 每局每座位的质询配额（防滥用：质询是稀缺权利，故成功才珍贵） */
export const APPEAL_QUOTA_PER_SEAT = 1;

/** 主张最短字数 */
export const ASSERTION_MIN_LENGTH = 10;

/**
 * 质询合法性校验（纯函数，前后端共用）。
 * 返回 null 表示合法，否则返回拒绝原因。
 */
export function validateAppeal(params: {
  book: RuleBook;
  clauseId: string;
  assertion: string;
  /** 本局该座位已发起的质询次数 */
  seatAppealCount: number;
  /** 本局已裁决过的条款 id */
  ruledClauseIds: readonly string[];
}): AppealRejection | null {
  const { book, clauseId, assertion, seatAppealCount, ruledClauseIds } = params;

  const clause = findClause(book, clauseId);
  if (!clause) return "clause-not-found";
  if (!isAppealable(clause)) return "clause-not-appealable";
  if (assertion.trim().length < ASSERTION_MIN_LENGTH) {
    return "assertion-too-short";
  }
  if (ruledClauseIds.includes(clauseId)) return "already-ruled-this-match";
  if (seatAppealCount >= APPEAL_QUOTA_PER_SEAT) return "quota-exhausted";

  return null;
}

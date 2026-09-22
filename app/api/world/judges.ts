/**
 * ============================================================================
 * 裁判团运行逻辑（api/world/judges.ts）
 * ----------------------------------------------------------------------------
 * 分布式裁判机制的执行端。三种裁判形态：
 *   J0 算律（algorithm）规则写定处，纯函数裁断，不投票
 *   J1 明镜（ai）      规则含混处，依条款正文裁断
 *   J2 众议（agent）   他人影从临时充任，他们也有立场
 *
 * 【为什么法定人数恒为奇数】
 * 3/5/7 保证不存在平票，因此无需平局规则。这是工程约束，不是仪式感。
 *
 * 【为什么裁判必须排除本局参与者】
 * 否则可自裁自胜。buildPanel 强制校验，不给绕过的余地。
 *
 * 【确定性】
 * 裁判团组建用对局 seed 派生的 RNG，因此回放时能重建同一个裁判团。
 * 若用 Math.random()，回放将不可复现——这是 match_logs 的硬要求。
 * ============================================================================
 */
import {
  isValidQuorum,
  tallyVotes,
  validateAppeal,
  findClause,
  type Judge,
  type JudgeKind,
  type JudgePanel,
  type JudgeVote,
  type QuorumSize,
  type RuleBook,
  type Verdict,
  type AppealRejection,
} from "@contracts/rulebook";

/* ------------------------------------------------------------------ */
/* 确定性 RNG（与 src/engine/rng.ts 同算法，服务端独立一份避免跨界引用）  */
/* ------------------------------------------------------------------ */

/** 字符串 → 32 位种子 */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32：小而确定，回放可复现 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* 候选裁判池                                                          */
/* ------------------------------------------------------------------ */

/**
 * 可充任 J1/J2 裁判的影从（八影从中取六位）。
 * 刻意排除讹兽（悍跳欺诈）——让一个以欺骗为人设的影从当裁判，
 * 机制上说不通，玩家也不会信服。守拙（保守持重）优先。
 */
export const JUDGE_CANDIDATES: readonly {
  echoId: string;
  name: string;
  kind: JudgeKind;
}[] = [
  { echoId: "shouzhuo", name: "守拙", kind: "ai" },
  { echoId: "baize", name: "白泽", kind: "ai" },
  { echoId: "xuanji", name: "璇玑", kind: "ai" },
  { echoId: "qingnang", name: "青囊", kind: "agent" },
  { echoId: "baixiao", name: "百晓生", kind: "agent" },
  { echoId: "zhuyin", name: "烛阴", kind: "agent" },
];

/* ------------------------------------------------------------------ */
/* 组建裁判团                                                          */
/* ------------------------------------------------------------------ */

export class QuorumError extends Error {}

/**
 * 组建裁判团。
 *
 * @param size        法定人数，必须是 3/5/7
 * @param seed        对局种子（保证回放可重建同一裁判团）
 * @param clauseId    被质询条款（并入 RNG 种子，使同局不同条款得到不同裁判团）
 * @param excludeSeats 本局参与者座位号——铁律三，必须传入
 */
export function buildPanel(params: {
  size: number;
  seed: string;
  clauseId: string;
  excludeSeats: readonly number[];
}): JudgePanel {
  const { size, seed, clauseId, excludeSeats } = params;

  if (!isValidQuorum(size)) {
    throw new QuorumError(`法定人数必须是 3/5/7，收到 ${size}`);
  }
  if (size > JUDGE_CANDIDATES.length + 1) {
    // +1 是因为总有一席算法裁判
    throw new QuorumError(
      `候选裁判不足：需 ${size} 席，池中仅 ${JUDGE_CANDIDATES.length} 位影从`,
    );
  }

  const rng = mulberry32(hashSeed(`${seed}:${clauseId}`));

  // 首席恒为算法裁判 J0：它只读条款正文，是裁判团里唯一无立场的一席。
  const judges: Judge[] = [
    { index: 0, kind: "algorithm", name: "算律", echoId: null },
  ];

  // 其余席位从影从池中确定性抽取（Fisher-Yates，用同一 RNG）
  const pool = [...JUDGE_CANDIDATES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  for (let i = 1; i < size; i++) {
    const cand = pool[i - 1];
    judges.push({
      index: i,
      kind: cand.kind,
      name: cand.name,
      echoId: cand.echoId,
    });
  }

  return { size: size as QuorumSize, judges, excludeSeats: [...excludeSeats] };
}

/* ------------------------------------------------------------------ */
/* 投票                                                                */
/* ------------------------------------------------------------------ */

/**
 * 算法裁判 J0 的投票：只依条款分类机械判定。
 *
 * 它不理解主张的内容——这是它的价值所在：无立场、可预测、可复现。
 * 规则含混（edge/conduct）时它倾向采纳（让规则有机会演化），
 * 时序条款（timing）它倾向驳回（时序改动影响所有历史对局的可比性）。
 */
export function algorithmVote(book: RuleBook, clauseId: string): JudgeVote {
  const clause = findClause(book, clauseId);
  if (!clause) {
    return {
      judgeIndex: 0,
      upheld: false,
      reason: "条款不存在于本规则书，无从裁断。",
    };
  }

  if (clause.category === "timing") {
    return {
      judgeIndex: 0,
      upheld: false,
      reason: `《${clause.title}》属时序条款，改动将使历史对局不可比。依原文裁断：驳回。`,
    };
  }

  return {
    judgeIndex: 0,
    upheld: true,
    reason: `《${clause.title}》原文未穷尽此情形，容有裁量余地。依原文裁断：采纳。`,
  };
}

/**
 * 启发式裁判投票（J1/J2 的本地兜底实现）。
 *
 * 【说明】真正的 J1/J2 应调用 LLM 依条款正文与主张做语义判断。
 * 本函数是无 LLM 时的确定性兜底，保证机制在离线环境下也能演示——
 * 黑客松现场网络不可靠，这条兜底是必要的。
 *
 * 判定倾向按人设分化，让裁判团的构成本身产生博弈意义：
 * - ai    类裁判重条款文本，主张越具体（越长、有条款引用）越可能采纳
 * - agent 类裁判有立场，倾向与质询方对立（他们也在争胜）
 */
export function heuristicVote(params: {
  judge: Judge;
  book: RuleBook;
  clauseId: string;
  assertion: string;
  seed: string;
}): JudgeVote {
  const { judge, book, clauseId, assertion, seed } = params;
  const clause = findClause(book, clauseId);

  if (!clause) {
    return {
      judgeIndex: judge.index,
      upheld: false,
      reason: "未见此条款。",
    };
  }

  const rng = mulberry32(hashSeed(`${seed}:${clauseId}:${judge.index}`));

  // 主张的「言之有物」程度：字数 + 是否引用了条款标题
  const substantive =
    Math.min(assertion.trim().length / 60, 1) * 0.5 +
    (assertion.includes(clause.title) ? 0.25 : 0);

  // agent 类裁判自带对立倾向（他们也在争胜），ai 类中立
  const bias = judge.kind === "agent" ? -0.15 : 0.1;

  const upheld = rng() + substantive + bias > 0.6;

  const reason = upheld
    ? `《${clause.title}》就此情形确有含混，主张成立。`
    : `《${clause.title}》原文已足以涵盖此情形，不必另立判例。`;

  return { judgeIndex: judge.index, upheld, reason };
}

/* ------------------------------------------------------------------ */
/* 完整裁决流程                                                        */
/* ------------------------------------------------------------------ */

export class AppealRejectedError extends Error {
  /** 显式字段：tsconfig 启用了 erasableSyntaxOnly，不能用参数属性简写 */
  readonly rejection: AppealRejection;

  constructor(rejection: AppealRejection) {
    super(rejection);
    this.rejection = rejection;
  }
}

/**
 * 执行一次完整裁决：校验 → 组团 → 投票 → 计票 → 产出 Verdict。
 *
 * 不落库、不产事件——那是调用方（worldRouter）的职责。
 * 本函数保持纯粹，因此可被单测完整覆盖。
 */
export function adjudicate(params: {
  book: RuleBook;
  clauseId: string;
  assertion: string;
  appellantSeat: number;
  /** 本局全部座位号（铁律三：全部排除在裁判之外） */
  matchSeats: readonly number[];
  seed: string;
  quorumSize?: number;
  /** 本局该座位已质询次数 */
  seatAppealCount?: number;
  /** 本局已裁决条款 */
  ruledClauseIds?: readonly string[];
}): { verdict: Verdict; panel: JudgePanel } {
  const {
    book,
    clauseId,
    assertion,
    appellantSeat,
    matchSeats,
    seed,
    quorumSize = 3,
    seatAppealCount = 0,
    ruledClauseIds = [],
  } = params;

  const rejection = validateAppeal({
    book,
    clauseId,
    assertion,
    seatAppealCount,
    ruledClauseIds,
  });
  if (rejection) throw new AppealRejectedError(rejection);

  const panel = buildPanel({
    size: quorumSize,
    seed,
    clauseId,
    excludeSeats: matchSeats,
  });

  const votes: JudgeVote[] = panel.judges.map(judge =>
    judge.kind === "algorithm"
      ? algorithmVote(book, clauseId)
      : heuristicVote({ judge, book, clauseId, assertion, seed }),
  );

  const { upheld, upholdCount, total } = tallyVotes(votes);
  const clause = findClause(book, clauseId);

  const summary = upheld
    ? `${upholdCount}/${total} 席采纳：《${clause?.title ?? clauseId}》就此情形确有含混，判例成立。`
    : `${upholdCount}/${total} 席采纳，未过半：《${clause?.title ?? clauseId}》原文已足，主张驳回。`;

  return {
    verdict: {
      rulebookId: book.id,
      rulebookVersion: book.version,
      clauseId,
      assertion: assertion.trim(),
      appellantSeat,
      votes,
      upheld,
      summary,
    },
    panel,
  };
}

/** Verdict → RulingEvent 的 judgeVotes 字段（契约要求 boolean[]） */
export function verdictToJudgeVotes(verdict: Verdict): boolean[] {
  return verdict.votes.map(v => v.upheld);
}

/* ------------------------------------------------------------------ */
/* Jev 驱动的裁决（异步版）                                             */
/* ------------------------------------------------------------------ */

/**
 * 与 adjudicate 同构，但 J1/J2 席位改由 Jev 模型裁断。
 *
 * 为什么不直接改 adjudicate：同步版是纯函数，可被完整单测覆盖且
 * 在无网络时永远可用。异步版叠在其上，Jev 不可用时逐席降级回启发式，
 * 因此本函数的返回结构与同步版完全一致，调用方无需分支处理。
 *
 * 算法裁判 J0 恒用本地判定——它的价值正是无立场、可预测、可复现，
 * 交给模型反而破坏了这一点。
 */
export async function adjudicateWithJev(params: {
  book: RuleBook;
  clauseId: string;
  assertion: string;
  appellantSeat: number;
  matchSeats: readonly number[];
  seed: string;
  quorumSize?: number;
  seatAppealCount?: number;
  ruledClauseIds?: readonly string[];
}): Promise<{
  verdict: Verdict;
  panel: JudgePanel;
  /** 可观测指标：哪几席真由 Jev 裁断、各自耗时（演示时展示） */
  jevMeta: {
    judgeIndex: number;
    byJev: boolean;
    elapsedMs: number | null;
    support: number | null;
    model: string | null;
  }[];
}> {
  const {
    book,
    clauseId,
    assertion,
    appellantSeat,
    matchSeats,
    seed,
    quorumSize = 3,
    seatAppealCount = 0,
    ruledClauseIds = [],
  } = params;

  const rejection = validateAppeal({
    book,
    clauseId,
    assertion,
    seatAppealCount,
    ruledClauseIds,
  });
  if (rejection) throw new AppealRejectedError(rejection);

  const panel = buildPanel({
    size: quorumSize,
    seed,
    clauseId,
    excludeSeats: matchSeats,
  });

  // 动态导入避免 judges.ts ↔ jevJudge.ts 循环依赖
  const { jevVote } = await import("./jevJudge");

  // 各席并行裁断——裁判之间互不影响，串行只是徒增等待
  const results = await Promise.all(
    panel.judges.map(async judge => {
      if (judge.kind === "algorithm") {
        return {
          vote: algorithmVote(book, clauseId),
          byJev: false,
          elapsedMs: null,
          support: null,
          model: null,
        };
      }
      return jevVote({ judge, book, clauseId, assertion, seed });
    }),
  );

  const votes = results.map(r => r.vote);
  const { upheld, upholdCount, total } = tallyVotes(votes);
  const clause = findClause(book, clauseId);

  const summary = upheld
    ? `${upholdCount}/${total} 席采纳：《${clause?.title ?? clauseId}》就此情形确有含混，判例成立。`
    : `${upholdCount}/${total} 席采纳，未过半：《${clause?.title ?? clauseId}》原文已足，主张驳回。`;

  return {
    verdict: {
      rulebookId: book.id,
      rulebookVersion: book.version,
      clauseId,
      assertion: assertion.trim(),
      appellantSeat,
      votes,
      upheld,
      summary,
    },
    panel,
    jevMeta: results.map((r, i) => ({
      judgeIndex: panel.judges[i].index,
      byJev: r.byJev,
      elapsedMs: r.elapsedMs,
      support: r.support,
      model: r.model,
    })),
  };
}

/**
 * 裁判团机制单测（api/world/judges.test.ts）
 *
 * 纯逻辑，不需数据库。断言四条铁律：
 *   1. 法定人数恒奇数，故不存在平票
 *   2. 核心条款（victory/scoring）不可质询
 *   3. 裁判不得为本局参与者
 *   4. 同 seed 同条款 → 同一裁判团（回放可复现）
 */
import { describe, it, expect } from "vitest";
import {
  RB_GUESS,
  RB_WEREWOLF,
  getRuleBook,
  ruleBookForTemplate,
  RULEBOOKS,
} from "@contracts/rulebooks.data";
import {
  appealableClauses,
  findClause,
  isAppealable,
  isValidQuorum,
  tallyVotes,
  validateAppeal,
  CLAUSE_APPEALABLE,
  QUORUM_SIZES,
  type JudgeVote,
} from "@contracts/rulebook";
import {
  adjudicate,
  algorithmVote,
  buildPanel,
  heuristicVote,
  verdictToJudgeVotes,
  AppealRejectedError,
  QuorumError,
  JUDGE_CANDIDATES,
} from "./judges";

const SEATS = [0, 1, 2, 3, 4, 5];
const SEED = "seed-test-0001";

/* ------------------------------------------------------------------ */
describe("规则书数据完整性", () => {
  it("每本规则书的条款 id 唯一", () => {
    for (const book of RULEBOOKS) {
      const ids = book.clauses.map(c => c.id);
      expect(new Set(ids).size, `${book.id} 条款 id 重复`).toBe(ids.length);
    }
  });

  it("每本规则书都有至少一条可质询条款", () => {
    for (const book of RULEBOOKS) {
      expect(appealableClauses(book).length, `${book.id} 无可质询条款`).toBeGreaterThan(0);
    }
  });

  it("每本规则书都有胜负条款", () => {
    for (const book of RULEBOOKS) {
      const hasVictory = book.clauses.some(c => c.category === "victory");
      expect(hasVictory, `${book.id} 缺胜负条款`).toBe(true);
    }
  });

  it("条款正文足够具体（不少于 12 字）", () => {
    for (const book of RULEBOOKS) {
      for (const c of book.clauses) {
        expect(c.text.length, `${book.id}/${c.id} 正文过短`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("按 id 与按模板都能取到规则书", () => {
    expect(getRuleBook("rb-guess")).toBe(RB_GUESS);
    expect(ruleBookForTemplate("numberGuess")).toBe(RB_GUESS);
    expect(getRuleBook("rb-nonexistent")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("铁律二 · 核心条款不可质询", () => {
  it("victory 与 scoring 分类恒不可质询", () => {
    expect(CLAUSE_APPEALABLE.victory).toBe(false);
    expect(CLAUSE_APPEALABLE.scoring).toBe(false);
  });

  it("胜负条款质询被拒", () => {
    const victory = RB_GUESS.clauses.find(c => c.category === "victory")!;
    const rejection = validateAppeal({
      book: RB_GUESS,
      clauseId: victory.id,
      assertion: "我认为这条胜负判定对我不利，应当改判。",
      seatAppealCount: 0,
      ruledClauseIds: [],
    });
    expect(rejection).toBe("clause-not-appealable");
  });

  it("边缘条款质询通过校验", () => {
    const edge = RB_GUESS.clauses.find(c => c.category === "edge")!;
    expect(isAppealable(edge)).toBe(true);
    const rejection = validateAppeal({
      book: RB_GUESS,
      clauseId: edge.id,
      assertion: "等距时以先提交者胜，但反悔窗内重提应视为新的提交顺序。",
      seatAppealCount: 0,
      ruledClauseIds: [],
    });
    expect(rejection).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe("质询合法性校验", () => {
  const edgeId = RB_GUESS.clauses.find(c => c.category === "edge")!.id;
  const base = {
    book: RB_GUESS,
    clauseId: edgeId,
    assertion: "此情形条款未穷尽，应当另立判例以补其阙。",
    seatAppealCount: 0,
    ruledClauseIds: [] as string[],
  };

  it("不存在的条款被拒", () => {
    expect(validateAppeal({ ...base, clauseId: "c-nope" })).toBe("clause-not-found");
  });

  it("主张过短被拒", () => {
    expect(validateAppeal({ ...base, assertion: "不服" })).toBe("assertion-too-short");
  });

  it("本局已裁决过的条款不可重复质询", () => {
    expect(validateAppeal({ ...base, ruledClauseIds: [edgeId] })).toBe(
      "already-ruled-this-match",
    );
  });

  it("配额耗尽被拒", () => {
    expect(validateAppeal({ ...base, seatAppealCount: 1 })).toBe("quota-exhausted");
  });
});

/* ------------------------------------------------------------------ */
describe("铁律一 · 法定人数恒奇数，不存在平票", () => {
  it("只接受 3/5/7", () => {
    expect(QUORUM_SIZES).toEqual([3, 5, 7]);
    for (const n of [3, 5, 7]) expect(isValidQuorum(n)).toBe(true);
    for (const n of [0, 1, 2, 4, 6, 8]) expect(isValidQuorum(n)).toBe(false);
  });

  it("偶数人数组团抛错", () => {
    expect(() =>
      buildPanel({ size: 4, seed: SEED, clauseId: "c-x", excludeSeats: SEATS }),
    ).toThrow(QuorumError);
  });

  it("任意奇数票数都能产生明确多数", () => {
    for (const size of [3, 5, 7]) {
      for (let up = 0; up <= size; up++) {
        const votes: JudgeVote[] = Array.from({ length: size }, (_, i) => ({
          judgeIndex: i,
          upheld: i < up,
          reason: "",
        }));
        const { upheld, upholdCount, total } = tallyVotes(votes);
        expect(total).toBe(size);
        expect(upholdCount).toBe(up);
        // 过半才采纳，且因奇数不存在「恰好一半」
        expect(upheld).toBe(up > size / 2);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe("铁律三 · 裁判不得为本局参与者", () => {
  it("裁判团记录了被排除的座位", () => {
    const panel = buildPanel({
      size: 3,
      seed: SEED,
      clauseId: "c-guess-tie",
      excludeSeats: SEATS,
    });
    expect(panel.excludeSeats).toEqual(SEATS);
  });

  it("裁判由影从/算法充任，不引用对局座位号", () => {
    const panel = buildPanel({
      size: 7,
      seed: SEED,
      clauseId: "c-guess-tie",
      excludeSeats: SEATS,
    });
    // 裁判席位号是裁判团内部编号 0..size-1，与对局座位无关
    expect(panel.judges.map(j => j.index)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // 非算法裁判必有影从身份
    for (const j of panel.judges.slice(1)) {
      expect(j.echoId).toBeTruthy();
    }
  });
});

/* ------------------------------------------------------------------ */
describe("铁律四 · 回放可复现", () => {
  it("同 seed 同条款 → 同一裁判团", () => {
    const a = buildPanel({ size: 5, seed: SEED, clauseId: "c-guess-tie", excludeSeats: SEATS });
    const b = buildPanel({ size: 5, seed: SEED, clauseId: "c-guess-tie", excludeSeats: SEATS });
    expect(a.judges).toEqual(b.judges);
  });

  it("不同条款 → 不同裁判团构成", () => {
    const a = buildPanel({ size: 5, seed: SEED, clauseId: "c-guess-tie", excludeSeats: SEATS });
    const b = buildPanel({ size: 5, seed: SEED, clauseId: "c-guess-timeout", excludeSeats: SEATS });
    // 首席恒为算法裁判，其余应有差异
    expect(a.judges.slice(1)).not.toEqual(b.judges.slice(1));
  });

  it("同一次裁决重复执行结果一致", () => {
    const args = {
      book: RB_GUESS,
      clauseId: "c-guess-tie",
      assertion: "等距裁断以先提交者胜，但未言明反悔窗内重提如何计序。",
      appellantSeat: 2,
      matchSeats: SEATS,
      seed: SEED,
    };
    const r1 = adjudicate(args);
    const r2 = adjudicate(args);
    expect(r1.verdict).toEqual(r2.verdict);
  });
});

/* ------------------------------------------------------------------ */
describe("裁判团组建", () => {
  it("首席恒为算法裁判 J0", () => {
    for (const size of [3, 5, 7]) {
      const panel = buildPanel({ size, seed: SEED, clauseId: "c-x", excludeSeats: SEATS });
      expect(panel.judges[0].kind).toBe("algorithm");
      expect(panel.judges[0].echoId).toBeNull();
    }
  });

  it("席位数与法定人数一致", () => {
    for (const size of [3, 5, 7] as const) {
      const panel = buildPanel({ size, seed: SEED, clauseId: "c-x", excludeSeats: SEATS });
      expect(panel.judges).toHaveLength(size);
      expect(panel.size).toBe(size);
    }
  });

  it("裁判不重复", () => {
    const panel = buildPanel({ size: 7, seed: SEED, clauseId: "c-x", excludeSeats: SEATS });
    const names = panel.judges.map(j => j.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("候选池排除了讹兽（欺诈人设不宜任裁判）", () => {
    expect(JUDGE_CANDIDATES.some(c => c.echoId === "eshou")).toBe(false);
  });

  it("候选池同时含 ai 与 agent 两类", () => {
    expect(JUDGE_CANDIDATES.some(c => c.kind === "ai")).toBe(true);
    expect(JUDGE_CANDIDATES.some(c => c.kind === "agent")).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("算法裁判 J0", () => {
  it("时序条款倾向驳回", () => {
    const timing = RB_GUESS.clauses.find(c => c.category === "timing")!;
    const vote = algorithmVote(RB_GUESS, timing.id);
    expect(vote.upheld).toBe(false);
    expect(vote.reason).toContain(timing.title);
  });

  it("边缘条款倾向采纳", () => {
    const edge = RB_GUESS.clauses.find(c => c.category === "edge")!;
    expect(algorithmVote(RB_GUESS, edge.id).upheld).toBe(true);
  });

  it("不存在的条款驳回", () => {
    expect(algorithmVote(RB_GUESS, "c-nope").upheld).toBe(false);
  });

  it("恒占 0 号席", () => {
    expect(algorithmVote(RB_GUESS, "c-guess-tie").judgeIndex).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("启发式裁判 J1/J2", () => {
  const panel = buildPanel({
    size: 5,
    seed: SEED,
    clauseId: "c-guess-tie",
    excludeSeats: SEATS,
  });

  it("投票携带席位号与理由", () => {
    for (const judge of panel.judges.slice(1)) {
      const vote = heuristicVote({
        judge,
        book: RB_GUESS,
        clauseId: "c-guess-tie",
        assertion: "等距裁断未言明反悔窗内重提如何计序，应当补充。",
        seed: SEED,
      });
      expect(vote.judgeIndex).toBe(judge.index);
      expect(vote.reason.length).toBeGreaterThan(0);
    }
  });

  it("言之有物的主张更易被采纳", () => {
    const judge = panel.judges[1];
    const clause = findClause(RB_GUESS, "c-guess-tie")!;
    let thinUpheld = 0;
    let richUpheld = 0;

    // 跨多个 seed 统计倾向，避免单次随机误判
    for (let i = 0; i < 40; i++) {
      const seed = `s-${i}`;
      if (
        heuristicVote({ judge, book: RB_GUESS, clauseId: "c-guess-tie", assertion: "不服判。", seed })
          .upheld
      ) thinUpheld++;
      if (
        heuristicVote({
          judge,
          book: RB_GUESS,
          clauseId: "c-guess-tie",
          assertion: `《${clause.title}》原文以先提交者胜，然反悔窗内重提是否重置提交顺序，原文未言，实务中两解皆通，故请另立判例明之。`,
          seed,
        }).upheld
      ) richUpheld++;
    }
    expect(richUpheld).toBeGreaterThan(thinUpheld);
  });

  it("条款不存在时驳回", () => {
    const vote = heuristicVote({
      judge: panel.judges[1],
      book: RB_GUESS,
      clauseId: "c-nope",
      assertion: "这条应当改，理由充分且已详述。",
      seed: SEED,
    });
    expect(vote.upheld).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe("完整裁决流程", () => {
  const goodAppeal = {
    book: RB_GUESS,
    clauseId: "c-guess-tie",
    assertion: "等距裁断以先提交者胜，然反悔窗内重提是否重置顺序，原文未言明。",
    appellantSeat: 2,
    matchSeats: SEATS,
    seed: SEED,
  };

  it("产出完整 Verdict", () => {
    const { verdict, panel } = adjudicate(goodAppeal);
    expect(verdict.rulebookId).toBe("rb-guess");
    expect(verdict.rulebookVersion).toBe(RB_GUESS.version);
    expect(verdict.clauseId).toBe("c-guess-tie");
    expect(verdict.appellantSeat).toBe(2);
    expect(verdict.votes).toHaveLength(3);
    expect(verdict.summary).toContain("/3 席");
    expect(panel.size).toBe(3);
  });

  it("裁决结论与计票一致", () => {
    const { verdict } = adjudicate(goodAppeal);
    const upholdCount = verdict.votes.filter(v => v.upheld).length;
    expect(verdict.upheld).toBe(upholdCount * 2 > verdict.votes.length);
  });

  it("支持 5 席与 7 席", () => {
    for (const quorumSize of [5, 7] as const) {
      const { verdict } = adjudicate({ ...goodAppeal, quorumSize });
      expect(verdict.votes).toHaveLength(quorumSize);
      expect(verdict.summary).toContain(`/${quorumSize} 席`);
    }
  });

  it("非法质询抛 AppealRejectedError 并携带原因", () => {
    const victory = RB_GUESS.clauses.find(c => c.category === "victory")!;
    try {
      adjudicate({ ...goodAppeal, clauseId: victory.id });
      expect.unreachable("应当抛错");
    } catch (e) {
      expect(e).toBeInstanceOf(AppealRejectedError);
      expect((e as AppealRejectedError).rejection).toBe("clause-not-appealable");
    }
  });

  it("verdictToJudgeVotes 与契约的 boolean[] 对齐", () => {
    const { verdict } = adjudicate({ ...goodAppeal, quorumSize: 5 });
    const votes = verdictToJudgeVotes(verdict);
    expect(votes).toHaveLength(5);
    expect(votes.every(v => typeof v === "boolean")).toBe(true);
    expect(votes).toEqual(verdict.votes.map(v => v.upheld));
  });

  it("狼人杀的行为条款也可质询（conduct 类）", () => {
    const conduct = RB_WEREWOLF.clauses.find(c => c.category === "conduct")!;
    const { verdict } = adjudicate({
      book: RB_WEREWOLF,
      clauseId: conduct.id,
      assertion: "串通认定缺乏证据标准，应当明确何种行为构成串通。",
      appellantSeat: 0,
      matchSeats: SEATS,
      seed: SEED,
    });
    expect(verdict.clauseId).toBe(conduct.id);
    expect(verdict.votes).toHaveLength(3);
  });
});

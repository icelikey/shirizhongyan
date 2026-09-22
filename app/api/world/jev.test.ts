/**
 * Jev 集成单测（api/world/jev.test.ts）
 *
 * 【设计】不打真实 API——CI 与队友本地都可能无 Key，测试必须离线可跑。
 * 因此这里验证的是「无 Key 时的降级路径」与「取值助手的类型收窄」，
 * 真实 API 的连通性由 scripts/jev-smoke.ts 单独验证（需 Key，手动跑）。
 *
 * 降级路径是必须被测试覆盖的：黑客松现场网络不可靠，
 * 若降级本身有 bug，整个裁判机制会在最关键的时刻崩掉。
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RB_GUESS } from "@contracts/rulebooks.data";
import { buildPanel } from "./judges";
import { adjudicateWithJev } from "./judges";
import {
  asChoice,
  asNoul,
  asScore,
  jevEnabled,
  JevUnavailableError,
  askJev,
  type JevAnswer,
} from "./jev";
import { jevVote, analyzeSpeech, SPEECH_STYLE_LABEL } from "./jevJudge";

const SEATS = [0, 1, 2, 3, 4, 5];
const SEED = "seed-jev-test";
const GOOD_ASSERTION =
  "《等距裁断》以先提交者胜，然反悔窗内撤回重提时孰为先提交者，原文未言明。";

/** 每个用例都从「无 Key」开始，显式设置才视为有 Key */
let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = savedKey;
});

/* ------------------------------------------------------------------ */
describe("可用性探测", () => {
  it("无 Key 时 jevEnabled 为 false", () => {
    expect(jevEnabled()).toBe(false);
  });

  it("有 Key 时为 true", () => {
    process.env.TYPESAFE_API_KEY = "apikey_fake_for_test";
    expect(jevEnabled()).toBe(true);
  });

  it("空白 Key 视为未配置", () => {
    process.env.TYPESAFE_API_KEY = "   ";
    expect(jevEnabled()).toBe(false);
  });

  it("无 Key 调用 askJev 抛 JevUnavailableError", async () => {
    await expect(
      askJev({
        state: "x",
        questions: { q: { type: "noul", instructions: "y" } },
      }),
    ).rejects.toThrow(JevUnavailableError);
  });
});

/* ------------------------------------------------------------------ */
describe("取值助手的类型收窄", () => {
  const noul: JevAnswer = { type: "noul", noul: 0.75 };
  const choice: JevAnswer = {
    type: "choice",
    choice: "uphold",
    confidence: 0.8,
    probabilities: { uphold: 0.8, reject: 0.2 },
  };
  const score: JevAnswer = {
    type: "score",
    score: 1.9,
    confidence: 0.95,
    legend: { "0": "低", "1": "中", "2": "高" },
    probabilities: { "0": 0, "1": 0.1, "2": 0.9 },
  };

  it("按类型取值", () => {
    expect(asNoul(noul)).toBe(0.75);
    expect(asChoice(choice)).toEqual({ choice: "uphold", confidence: 0.8 });
    expect(asScore(score)).toEqual({ score: 1.9, confidence: 0.95 });
  });

  it("类型不匹配返回 null（不抛错，调用方据此降级）", () => {
    expect(asNoul(choice)).toBeNull();
    expect(asChoice(noul)).toBeNull();
    expect(asScore(noul)).toBeNull();
  });

  it("undefined 返回 null", () => {
    expect(asNoul(undefined)).toBeNull();
    expect(asChoice(undefined)).toBeNull();
    expect(asScore(undefined)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe("降级路径 · 无 Key 时裁判机制仍完整", () => {
  const panel = buildPanel({
    size: 3,
    seed: SEED,
    clauseId: "c-guess-tie",
    excludeSeats: SEATS,
  });

  it("jevVote 降级为启发式且标记 byJev=false", async () => {
    const aiJudge = panel.judges.find(j => j.kind !== "algorithm")!;
    const res = await jevVote({
      judge: aiJudge,
      book: RB_GUESS,
      clauseId: "c-guess-tie",
      assertion: GOOD_ASSERTION,
      seed: SEED,
    });

    expect(res.byJev).toBe(false);
    expect(res.elapsedMs).toBeNull();
    expect(res.support).toBeNull();
    expect(res.model).toBeNull();
    // 关键：仍产出了一张有效选票
    expect(res.vote.judgeIndex).toBe(aiJudge.index);
    expect(typeof res.vote.upheld).toBe("boolean");
    expect(res.vote.reason.length).toBeGreaterThan(0);
  });

  it("条款不存在时降级且驳回", async () => {
    const aiJudge = panel.judges.find(j => j.kind !== "algorithm")!;
    const res = await jevVote({
      judge: aiJudge,
      book: RB_GUESS,
      clauseId: "c-nope",
      assertion: GOOD_ASSERTION,
      seed: SEED,
    });
    expect(res.byJev).toBe(false);
    expect(res.vote.upheld).toBe(false);
  });

  it("adjudicateWithJev 无 Key 时凑满法定人数", async () => {
    for (const quorumSize of [3, 5, 7] as const) {
      const { verdict, jevMeta } = await adjudicateWithJev({
        book: RB_GUESS,
        clauseId: "c-guess-tie",
        assertion: GOOD_ASSERTION,
        appellantSeat: 2,
        matchSeats: SEATS,
        seed: SEED,
        quorumSize,
      });
      expect(verdict.votes).toHaveLength(quorumSize);
      expect(jevMeta).toHaveLength(quorumSize);
      expect(jevMeta.every(m => m.byJev === false)).toBe(true);
    }
  });

  it("异步版与同步版的裁决结构一致", async () => {
    const { verdict, panel: p } = await adjudicateWithJev({
      book: RB_GUESS,
      clauseId: "c-guess-tie",
      assertion: GOOD_ASSERTION,
      appellantSeat: 2,
      matchSeats: SEATS,
      seed: SEED,
    });
    expect(verdict.rulebookId).toBe("rb-guess");
    expect(verdict.clauseId).toBe("c-guess-tie");
    expect(verdict.appellantSeat).toBe(2);
    expect(verdict.summary).toContain("/3 席");
    expect(p.size).toBe(3);
  });

  it("算法裁判 J0 恒为本地判定，不经 Jev", async () => {
    process.env.TYPESAFE_API_KEY = "apikey_fake_for_test";
    const { jevMeta } = await adjudicateWithJev({
      book: RB_GUESS,
      clauseId: "c-guess-tie",
      assertion: GOOD_ASSERTION,
      appellantSeat: 2,
      matchSeats: SEATS,
      seed: SEED,
    });
    // 0 号席恒为算法裁判，必然 byJev=false
    const j0 = jevMeta.find(m => m.judgeIndex === 0)!;
    expect(j0.byJev).toBe(false);
  });

  it("非法质询在 Jev 调用前就被拒（不浪费 API 调用）", async () => {
    const victory = RB_GUESS.clauses.find(c => c.category === "victory")!;
    await expect(
      adjudicateWithJev({
        book: RB_GUESS,
        clauseId: victory.id,
        assertion: GOOD_ASSERTION,
        appellantSeat: 0,
        matchSeats: SEATS,
        seed: SEED,
      }),
    ).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ */
describe("发言分析降级", () => {
  it("无 Key 时返回 null（前端据此隐藏面板，不显示假数值）", async () => {
    const res = await analyzeSpeech({
      history: ["我是平民"],
      speech: "我是预言家，查验2号是狼",
      publicContext: "第二天白天，无人死亡",
    });
    expect(res).toBeNull();
  });

  it("四种发言风格都有中文标签", () => {
    expect(SPEECH_STYLE_LABEL.hantiao).toBe("悍跳");
    expect(SPEECH_STYLE_LABEL.chongfeng).toBe("冲锋");
    expect(SPEECH_STYLE_LABEL.huashui).toBe("划水");
    expect(SPEECH_STYLE_LABEL.daogou).toBe("倒钩");
    expect(SPEECH_STYLE_LABEL.unknown).toBe("未明");
  });
});

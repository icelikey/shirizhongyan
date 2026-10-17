import { afterEach, describe, expect, it, vi } from "vitest";
import { RB_GUESS } from "@contracts/rulebooks.data";
import { buildPanel } from "./judges";
import { jevVote } from "./jevJudge";

const judge = buildPanel({
  size: 3,
  seed: "jev-judge-test",
  clauseId: "c-guess-tie",
  excludeSeats: [0, 1, 2, 3, 4, 5],
}).judges.find(item => item.kind !== "algorithm")!;

const params = {
  judge,
  book: RB_GUESS,
  clauseId: "c-guess-tie",
  assertion: "反悔窗内撤回重提时，条款没有说明谁先提交。",
  seed: "jev-judge-test",
};

const answer = {
  supported: { type: "noul", noul: 0.9 },
  strength: {
    type: "score",
    score: 2,
    confidence: 0.9,
    legend: { "0": "低", "1": "中", "2": "高" },
    probabilities: { "0": 0, "1": 0, "2": 1 },
  },
  verdict: {
    type: "choice",
    choice: "uphold",
    confidence: 0.9,
    probabilities: { uphold: 1, reject: 0, partial: 0 },
  },
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TYPESAFE_API_KEY;
});

describe("jevVote safety boundary", () => {
  it("keeps a valid model vote separate from fallback", async () => {
    process.env.TYPESAFE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      model: "jev-test",
      answers: answer,
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await jevVote(params);

    expect(result.source).toBe("jev");
    expect(result.byJev).toBe(true);
    expect(result.vote.judgeIndex).toBe(judge.index);
    expect(result.vote.upheld).toBe(true);
  });

  it.each([
    ["out of range support", { ...answer, supported: { type: "noul", noul: 2 } }],
    ["unknown verdict", { ...answer, verdict: { ...answer.verdict, choice: "changeWinner" } }],
    ["out of range strength", { ...answer, strength: { ...answer.strength, score: 99 } }],
  ])("falls back on untrusted model output: %s", async (_label, answers) => {
    process.env.TYPESAFE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      model: "jev-test",
      answers,
      usage: { input_tokens: 1, output_tokens: 1 },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await jevVote(params);

    expect(result.source).toBe("fallback");
    expect(result.byJev).toBe(false);
    expect(result.elapsedMs).toBeNull();
    expect(result.model).toBeNull();
    expect(typeof result.vote.upheld).toBe("boolean");
  });
});

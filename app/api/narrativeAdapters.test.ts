import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchEvent } from "../contracts/matchLog";
import type { NarrativePlan, TacticalDigest, WorldEventRef } from "../contracts/aiNativeWorld";
import { createConfiguredNarrativeAdapter, createJevTacticalDigestAdapter } from "./narrativeAdapters";
import * as jev from "./world/jev";

const hash = "a".repeat(64);
const ref = (eventSeq: number, eventType: string): WorldEventRef => ({
  worldId: "tdg-world",
  cycle: 7,
  matchId: "42",
  eventSeq,
  eventType,
  stateHash: hash,
  rulebookVersion: "v1.0.0",
  visibility: "public",
});

const events: MatchEvent[] = [
  {
    seq: 0,
    round: 0,
    t: "matchStart",
    rulebookId: "rb-test",
    seed: "seed-test",
    seats: [{ index: 0, name: "甲", kind: "external-agent" }],
  },
  { seq: 1, round: 1, t: "action", seat: 0, kind: "pass", value: null },
];

afterEach(() => {
  delete process.env.TYPESAFE_API_KEY;
  delete process.env.TDG_NARRATIVE_API_URL;
  delete process.env.TDG_NARRATIVE_API_KEY;
  vi.restoreAllMocks();
});

describe("configured narrative adapters", () => {
  it("turns a real Jev-shaped classification into evidence-bound digest signals", async () => {
    vi.spyOn(jev, "askJev").mockResolvedValue({
      model: "jev-test",
      usage: { input_tokens: 1, output_tokens: 1 },
      elapsedMs: 4,
      answers: {
        tactical_style: {
          type: "choice",
          choice: "patience",
          confidence: 0.9,
          probabilities: { patience: 0.9 },
        },
        tactical_confidence: {
          type: "score",
          score: 4,
          confidence: 0.8,
          legend: {},
          probabilities: { "4": 0.8 },
        },
      },
    });

    const digest = await createJevTacticalDigestAdapter().summarize({
      events,
      eventRefs: [ref(0, "matchStart"), ref(1, "action")],
      world: ref(0, "matchStart"),
      digestId: "digest:42:1",
      idempotencyKey: "idem:42:1",
    });

    expect(digest.strategyLabels).toContain("jev:patience");
    expect(digest.inferences.some(item => item.text.includes("patience"))).toBe(true);
    expect(digest.inferences.every(item => item.evidenceSeqs.includes(1))).toBe(true);
  });

  it("builds a canonical report around model prose while the server owns references", async () => {
    process.env.TDG_NARRATIVE_API_URL = "https://narrative.test/v1/chat/completions";
    process.env.TDG_NARRATIVE_API_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            title: "灰灯下的停手",
            body: "甲把选择收回掌心，牌桌因此短暂失声。",
            claims: [{ text: "甲选择停手", kind: "fact", evidenceSeqs: [1] }],
          }),
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const digest: TacticalDigest = {
      contractVersion: "1.0.0",
      digestId: "digest:42:1",
      idempotencyKey: "idem:42:1",
      world: ref(0, "matchStart"),
      eventRefs: [ref(0, "matchStart"), ref(1, "action")],
      evidenceSeqs: [0, 1],
      facts: [{ text: "甲选择停手", evidenceSeqs: [1] }],
      inferences: [],
      publicFacts: ["甲选择停手"],
      turningPointSeqs: [],
      strategyLabels: [],
      uncertainty: [],
    };
    const plan: NarrativePlan = {
      contractVersion: "1.0.0",
      planId: "plan:42:1",
      idempotencyKey: digest.idempotencyKey,
      world: digest.world,
      sourceDigestId: digest.digestId,
      evidenceSeqs: [0, 1],
      sections: [{
        sectionId: "section:1",
        title: "开局",
        eventRefs: digest.eventRefs,
        evidenceSeqs: [0, 1],
        visibility: "public",
      }],
      projectionVersion: "v1.0.0",
    };

    const report = await createConfiguredNarrativeAdapter()!.generate({ digest, plan });
    expect(report.title).toBe("灰灯下的停手");
    expect(report.eventSeq).toBe(1);
    expect(report.claims[0]?.evidenceSeqs).toEqual([1]);
    expect(report.claims[0]?.evidence[0]?.eventSeq).toBe(1);
  });
});

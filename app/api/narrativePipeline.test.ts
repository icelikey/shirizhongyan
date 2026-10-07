import { describe, expect, it, vi } from "vitest";
import {
  narrativePlanSchema,
  tacticalDigestSchema,
  type TacticalDigest,
} from "../contracts/aiNativeWorld";
import {
  runNarrativePipeline,
  type NarrativePipelineInput,
} from "./narrativePipeline";

const hash = "a".repeat(64);
const ref = (eventSeq: number, visibility: "public" | "seat" = "public") => ({
  worldId: "w",
  cycle: 1,
  matchId: "m",
  eventSeq,
  eventType: eventSeq === 0 ? "matchStart" : "action",
  stateHash: hash,
  rulebookVersion: "v1.0.0",
  visibility,
});

const fallbackDigest = (eventRefs = [ref(0), ref(1)]): TacticalDigest => ({
  contractVersion: "1.0.0",
  digestId: "digest",
  idempotencyKey: "idem-12345678",
  world: ref(0),
  eventRefs,
  evidenceSeqs: eventRefs.map(event => event.eventSeq),
  facts: [{ text: "甲选择停手", evidenceSeqs: [1] }],
  inferences: [],
  publicFacts: ["甲选择停手"],
  turningPointSeqs: [],
  strategyLabels: [],
  uncertainty: [],
});

const base = (): NarrativePipelineInput => ({
  events: [
    {
      seq: 0,
      round: 0,
      t: "matchStart",
      rulebookId: "rules",
      seed: "seed",
      seats: [{ index: 0, name: "甲", kind: "human" }],
    },
    { seq: 1, round: 1, t: "action", seat: 0, kind: "pass", value: null },
  ],
  eventRefs: [ref(0), ref(1)],
  world: ref(0),
  viewer: "spectator",
  mode: "agent-v-agent",
  digestId: "digest",
  plan: {
    contractVersion: "1.0.0",
    planId: "plan",
    idempotencyKey: "idem-12345678",
    world: ref(0),
    sourceDigestId: "digest",
    evidenceSeqs: [0],
    projectionVersion: "v1.0.0",
    sections: [
      {
        sectionId: "s",
        title: "开局",
        eventRefs: [ref(0)],
        evidenceSeqs: [0],
        visibility: "public",
      },
    ],
  },
  jev: {
    summarize: vi.fn(async () => fallbackDigest()),
  },
  narrative: {
    generate: vi.fn(async ({ digest, plan }) => ({
      contractVersion: "1.0.0" as const,
      reportId: "report",
      idempotencyKey: plan.idempotencyKey,
      world: digest.world,
      planId: plan.planId,
      title: "战报",
      body: "甲在开局选择停手。[E1]【事实】",
      claims: [
        {
          text: "甲选择停手",
          kind: "fact" as const,
          evidence: [ref(1)],
          evidenceSeqs: [1],
        },
      ],
      eventRefs: [ref(0), ref(1)],
      stateHash: hash,
      eventSeq: 0,
      rulebookVersion: "v1.0.0",
      projectionVersion: "v1.0.0",
      visibility: "public" as const,
    })),
  },
});

describe("narrative pipeline", () => {
  it("filters secret events before JEV and accepts evidence-bound reports", async () => {
    const input = base();
    input.viewer = 1;
    input.events = [
      ...input.events,
      {
        seq: 2,
        round: 1,
        t: "secretAssign",
        secret: true,
        seat: 0,
        value: "hidden",
      },
    ];
    input.eventRefs = [...input.eventRefs, ref(2, "seat")];
    const result = await runNarrativePipeline(input);

    expect(result.usedFallback).toBe(false);
    expect(result.report?.body).toContain("停手");
    expect(input.jev?.summarize).toHaveBeenCalledWith(
      expect.objectContaining({
        events: expect.not.arrayContaining([
          expect.objectContaining({ t: "secretAssign" }),
        ]),
        eventRefs: expect.not.arrayContaining([
          expect.objectContaining({ eventSeq: 2 }),
        ]),
      })
    );
  });

  it("without JEV or LLM builds readable, schema-valid digest and plan from MatchEvent", async () => {
    const input = base();
    input.plan = undefined;
    input.jev = undefined;
    input.narrative = undefined;
    const result = await runNarrativePipeline(input);

    expect(result.usedFallback).toBe(true);
    expect(result.digest).not.toBeNull();
    expect(result.plan).not.toBeNull();
    expect(result.report).toBeNull();
    expect(tacticalDigestSchema.safeParse(result.digest).success).toBe(true);
    expect(narrativePlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.digest?.evidenceSeqs).toEqual([0, 1]);
    expect(
      result.digest?.facts.some(
        fact => fact.text.includes("停手") && fact.evidenceSeqs.includes(1)
      )
    ).toBe(true);
    expect(
      result.plan?.sections.flatMap(section => section.evidenceSeqs)
    ).toContain(1);
    expect(result.text).toContain("《终焉战报》");
    expect(result.text).toContain("停手");
  });

  it("falls back when JEV cites an event outside the authorized evidence range", async () => {
    const input = base();
    input.jev = {
      summarize: async () => ({
        ...fallbackDigest([ref(0), ref(1), ref(99)]),
        evidenceSeqs: [0, 1, 99],
      }),
    };
    const result = await runNarrativePipeline(input);

    expect(result.usedFallback).toBe(true);
    expect(result.digest?.eventRefs.map(event => event.eventSeq)).toEqual([
      0, 1,
    ]);
    expect(result.audit.errors.join(" ")).toContain("未授权事件 E99");
  });

  it("falls back when a supplied plan cites an unauthorized event", async () => {
    const input = base();
    input.plan = {
      ...input.plan!,
      evidenceSeqs: [99],
      sections: [
        {
          ...input.plan!.sections[0],
          eventRefs: [ref(99)],
          evidenceSeqs: [99],
        },
      ],
    };
    input.jev = undefined;
    input.narrative = undefined;
    const result = await runNarrativePipeline(input);

    expect(result.usedFallback).toBe(true);
    expect(result.plan?.sourceDigestId).toBe("digest");
    expect(result.audit.errors.join(" ")).toContain(
      "叙事计划引用了未授权事件 E99"
    );
  });

  it("keeps the validated digest and plan when the narrative report is out of range", async () => {
    const input = base();
    input.narrative = {
      generate: async ({ digest, plan }) => ({
        contractVersion: "1.0.0",
        reportId: "bad-report",
        idempotencyKey: plan.idempotencyKey,
        world: digest.world,
        planId: plan.planId,
        title: "坏报告",
        body: "x",
        claims: [
          { text: "x", kind: "fact", evidence: [ref(99)], evidenceSeqs: [99] },
        ],
        eventRefs: [ref(0)],
        stateHash: hash,
        eventSeq: 0,
        rulebookVersion: "v1.0.0",
        projectionVersion: "v1.0.0",
        visibility: "public",
      }),
    };
    const result = await runNarrativePipeline(input);

    expect(result.usedFallback).toBe(true);
    expect(result.digest?.digestId).toBe("digest");
    expect(result.plan?.planId).toBe("plan");
    expect(result.report).toBeNull();
    expect(result.audit.errors.join(" ")).toContain(
      "叙事报告证据引用了未授权事件 E99"
    );
    expect(result.text).toContain("【事实】");
  });

  it("does not leak seat-private events through the deterministic fallback", async () => {
    const input = base();
    input.viewer = 1;
    input.plan = undefined;
    input.jev = undefined;
    input.narrative = undefined;
    input.events = [
      ...input.events,
      {
        seq: 2,
        round: 1,
        t: "secretAssign",
        secret: true,
        seat: 0,
        value: "hidden",
      },
    ];
    input.eventRefs = [...input.eventRefs, ref(2, "seat")];
    const result = await runNarrativePipeline(input);

    expect(result.digest?.eventRefs.some(event => event.eventSeq === 2)).toBe(
      false
    );
    expect(result.text).not.toContain("hidden");
  });
});

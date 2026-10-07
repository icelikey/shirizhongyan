import { z } from "zod";

export const AI_NATIVE_WORLD_CONTRACT_VERSION = "1.0.0" as const;

export const projectionVisibilitySchema = z.enum(["public", "seat", "judge", "owner"]);
export type ProjectionVisibility = z.infer<typeof projectionVisibilitySchema>;

const id = z.string().trim().min(1).max(160);
const version = z.string().trim().regex(/^v?\d+\.\d+\.\d+$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/i);
const seq = z.number().int().nonnegative();
const idempotencyKey = z.string().trim().min(8).max(200);

export const worldEventRefSchema = z.object({
  worldId: id,
  cycle: z.number().int().nonnegative(),
  matchId: id.nullable(),
  eventSeq: seq,
  eventType: z.string().trim().min(1).max(96),
  stateHash: hash,
  rulebookVersion: version,
  visibility: projectionVisibilitySchema,
});
export type WorldEventRef = z.infer<typeof worldEventRefSchema>;

const sameScope = (a: WorldEventRef, b: WorldEventRef) =>
  a.worldId === b.worldId && a.matchId === b.matchId;

const refsFor = (
  anchor: WorldEventRef,
  refs: readonly WorldEventRef[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
) => {
  refs.forEach((ref, index) => {
    if (!sameScope(anchor, ref)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index],
        message: "事件引用必须属于同一世界和对局",
      });
    }
  });
};

const seqsFor = (
  refs: readonly WorldEventRef[],
  seqs: readonly number[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
) => {
  const allowed = new Set(refs.map(ref => ref.eventSeq));
  seqs.forEach((eventSeq, index) => {
    if (!allowed.has(eventSeq)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, index],
        message: "证据序号必须来自事件引用",
      });
    }
  });
};

const evidenceSentenceSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  evidenceSeqs: z.array(seq).min(1),
});
export type EvidenceSentence = z.infer<typeof evidenceSentenceSchema>;

export const textWorldSightingSchema = z
  .object({
    contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
    sightingId: id,
    idempotencyKey,
    world: worldEventRefSchema,
    subject: id,
    text: z.string().trim().min(1).max(4000),
    evidence: z.array(worldEventRefSchema).min(1),
    confidence: z.number().min(0).max(1),
    visibility: projectionVisibilitySchema,
  })
  .superRefine((value, ctx) => refsFor(value.world, value.evidence, ["evidence"], ctx));
export type TextWorldSighting = z.infer<typeof textWorldSightingSchema>;

export const tacticalDigestSchema = z
  .object({
    contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
    digestId: id,
    idempotencyKey,
    world: worldEventRefSchema,
    eventRefs: z.array(worldEventRefSchema).min(1),
    evidenceSeqs: z.array(seq).min(1),
    facts: z.array(evidenceSentenceSchema).max(128),
    inferences: z.array(evidenceSentenceSchema).max(64),
    publicFacts: z.array(z.string().trim().min(1)).max(128),
    turningPointSeqs: z.array(seq),
    strategyLabels: z.array(z.string().trim().min(1).max(96)).max(32),
    uncertainty: z.array(z.string().trim().min(1)).max(64),
  })
  .superRefine((value, ctx) => {
    refsFor(value.world, value.eventRefs, ["eventRefs"], ctx);
    seqsFor(value.eventRefs, value.evidenceSeqs, ["evidenceSeqs"], ctx);
    seqsFor(value.eventRefs, value.turningPointSeqs, ["turningPointSeqs"], ctx);
    value.facts.forEach((fact, index) =>
      seqsFor(value.eventRefs, fact.evidenceSeqs, ["facts", index, "evidenceSeqs"], ctx),
    );
    value.inferences.forEach((inference, index) =>
      seqsFor(value.eventRefs, inference.evidenceSeqs, ["inferences", index, "evidenceSeqs"], ctx),
    );
  });
export type TacticalDigest = z.infer<typeof tacticalDigestSchema>;

const sectionSchema = z.object({
  sectionId: id,
  title: z.string().trim().min(1).max(200),
  eventRefs: z.array(worldEventRefSchema).min(1),
  evidenceSeqs: z.array(seq).min(1),
  visibility: projectionVisibilitySchema,
});

export const narrativePlanSchema = z
  .object({
    contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
    planId: id,
    idempotencyKey,
    world: worldEventRefSchema,
    sourceDigestId: id,
    evidenceSeqs: z.array(seq).min(1),
    sections: z.array(sectionSchema).min(1),
    projectionVersion: version,
  })
  .superRefine((value, ctx) => {
    const sectionRefs = value.sections.flatMap(section => section.eventRefs);
    refsFor(value.world, sectionRefs, ["sections"], ctx);
    seqsFor(sectionRefs, value.evidenceSeqs, ["evidenceSeqs"], ctx);
    value.sections.forEach((section, index) =>
      seqsFor(section.eventRefs, section.evidenceSeqs, ["sections", index, "evidenceSeqs"], ctx),
    );
  });
export type NarrativePlan = z.infer<typeof narrativePlanSchema>;

const claimSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  kind: z.enum(["fact", "inference"]),
  evidence: z.array(worldEventRefSchema).min(1),
  evidenceSeqs: z.array(seq).min(1),
});

export const narrativeReportSchema = z
  .object({
    contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
    reportId: id,
    idempotencyKey,
    world: worldEventRefSchema,
    planId: id,
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(10000),
    claims: z.array(claimSchema).min(1),
    eventRefs: z.array(worldEventRefSchema).min(1),
    stateHash: hash,
    eventSeq: seq,
    rulebookVersion: version,
    projectionVersion: version,
    visibility: projectionVisibilitySchema,
  })
  .superRefine((value, ctx) => {
    refsFor(value.world, value.eventRefs, ["eventRefs"], ctx);
    value.claims.forEach((claim, index) => {
      refsFor(value.world, claim.evidence, ["claims", index, "evidence"], ctx);
      seqsFor(claim.evidence, claim.evidenceSeqs, ["claims", index, "evidenceSeqs"], ctx);
    });
    const anchor = value.eventRefs.find(ref => ref.eventSeq === value.eventSeq);
    if (!anchor) {
      ctx.addIssue({ code: "custom", path: ["eventSeq"], message: "报告锚点事件必须被引用" });
      return;
    }
    if (anchor.stateHash !== value.stateHash) {
      ctx.addIssue({ code: "custom", path: ["stateHash"], message: "stateHash 必须匹配锚点事件" });
    }
    if (anchor.visibility !== value.visibility) {
      ctx.addIssue({ code: "custom", path: ["visibility"], message: "visibility 必须匹配锚点事件" });
    }
  });
export type NarrativeReport = z.infer<typeof narrativeReportSchema>;

export const projectionCursorSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  worldId: id,
  matchId: id.nullable(),
  projection: z.enum(["text", "graphic"]),
  eventSeq: seq,
  stateHash: hash,
  rulebookVersion: version,
  projectionVersion: version,
});
export type ProjectionCursor = z.infer<typeof projectionCursorSchema>;

export const contentProposalSchema = z
  .object({
    contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
    proposalId: id,
    idempotencyKey,
    worldId: id,
    matchId: id.nullable(),
    proposerId: id,
    version,
    proposalType: z.enum(["rule", "scenario", "card", "lore", "mission"]),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    sourceEvents: z.array(worldEventRefSchema).min(1),
    permissions: z.object({
      visibility: projectionVisibilitySchema,
      allowedRoles: z.array(z.string().trim().min(1).max(64)).min(1),
      approvalRequired: z.boolean(),
    }),
    stateHash: hash,
    eventSeq: seq,
    status: z.enum(["draft", "sandbox", "approved", "rejected"]),
  })
  .superRefine((value, ctx) =>
    value.sourceEvents.forEach((event, index) => {
      if (event.worldId !== value.worldId || event.matchId !== value.matchId) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceEvents", index],
          message: "来源事件必须属于同一世界和对局",
        });
      }
    }),
  );
export type ContentProposal = z.infer<typeof contentProposalSchema>;

export function assertSameProjectionWorld(
  cursor: ProjectionCursor,
  worldId: string,
  matchId?: string | null,
): void {
  if (cursor.worldId !== worldId || (matchId !== undefined && cursor.matchId !== matchId)) {
    throw new Error("Projection cursor belongs to another world or match");
  }
}

export function hasMonotonicEventSeq(
  reports: readonly Pick<NarrativeReport, "eventSeq">[],
): boolean {
  return reports.every((report, index) => index === 0 || report.eventSeq > reports[index - 1].eventSeq);
}

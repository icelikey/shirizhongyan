import { z } from "zod";

export const AI_NATIVE_WORLD_CONTRACT_VERSION = "1.0.0" as const;

export const projectionVisibilitySchema = z.enum(["public", "seat", "judge", "owner"]);
export type ProjectionVisibility = z.infer<typeof projectionVisibilitySchema>;

const versionSchema = z.string().trim().regex(/^v?\d+\.\d+\.\d+$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const eventSeqSchema = z.number().int().nonnegative();

export const worldEventRefSchema = z.object({
  worldId: z.string().trim().min(1).max(160),
  cycle: z.number().int().nonnegative(),
  matchId: z.string().trim().min(1).max(160).nullable(),
  eventSeq: eventSeqSchema,
  eventType: z.string().trim().min(1).max(96),
  stateHash: hashSchema,
  rulebookVersion: versionSchema,
  visibility: projectionVisibilitySchema,
});
export type WorldEventRef = z.infer<typeof worldEventRefSchema>;

export const textWorldSightingSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  sightingId: z.string().trim().min(1).max(160),
  world: worldEventRefSchema,
  subject: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(4000),
  evidence: z.array(worldEventRefSchema).min(1),
  confidence: z.number().min(0).max(1),
  visibility: projectionVisibilitySchema,
});
export type TextWorldSighting = z.infer<typeof textWorldSightingSchema>;

export const tacticalDigestSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  digestId: z.string().trim().min(1).max(160),
  world: worldEventRefSchema,
  eventRefs: z.array(worldEventRefSchema).min(1),
  publicFacts: z.array(z.string().trim().min(1)).max(128),
  turningPointSeqs: z.array(eventSeqSchema),
  strategyLabels: z.array(z.string().trim().min(1).max(96)).max(32),
  uncertainty: z.array(z.string().trim().min(1)).max(64),
});
export type TacticalDigest = z.infer<typeof tacticalDigestSchema>;

export const narrativePlanSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  planId: z.string().trim().min(1).max(160),
  world: worldEventRefSchema,
  sourceDigestId: z.string().trim().min(1).max(160),
  sections: z.array(z.object({
    sectionId: z.string().trim().min(1).max(96),
    title: z.string().trim().min(1).max(200),
    eventRefs: z.array(worldEventRefSchema).min(1),
    visibility: projectionVisibilitySchema,
  })).min(1),
  projectionVersion: versionSchema,
});
export type NarrativePlan = z.infer<typeof narrativePlanSchema>;

const narrativeClaimSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  kind: z.enum(["fact", "inference"]),
  evidence: z.array(worldEventRefSchema).min(1),
});

export const narrativeReportSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  reportId: z.string().trim().min(1).max(160),
  world: worldEventRefSchema,
  planId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  claims: z.array(narrativeClaimSchema).min(1),
  eventRefs: z.array(worldEventRefSchema).min(1),
  stateHash: hashSchema,
  eventSeq: eventSeqSchema,
  rulebookVersion: versionSchema,
  projectionVersion: versionSchema,
  visibility: projectionVisibilitySchema,
}).superRefine((report, ctx) => {
  if (report.claims.some(claim => claim.kind === "fact" && claim.evidence.length === 0)) {
    ctx.addIssue({ code: "custom", path: ["claims"], message: "事实性叙事声明必须引用至少一个事件" });
  }
});
export type NarrativeReport = z.infer<typeof narrativeReportSchema>;

export const projectionCursorSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  worldId: z.string().trim().min(1).max(160),
  projection: z.enum(["text", "graphic"]),
  eventSeq: eventSeqSchema,
  stateHash: hashSchema,
  rulebookVersion: versionSchema,
  projectionVersion: versionSchema,
});
export type ProjectionCursor = z.infer<typeof projectionCursorSchema>;

export const contentProposalSchema = z.object({
  contractVersion: z.literal(AI_NATIVE_WORLD_CONTRACT_VERSION),
  proposalId: z.string().trim().min(1).max(160),
  worldId: z.string().trim().min(1).max(160),
  proposerId: z.string().trim().min(1).max(160),
  version: versionSchema,
  proposalType: z.enum(["rule", "scenario", "card", "lore", "mission"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  sourceEvents: z.array(worldEventRefSchema).min(1),
  permissions: z.object({
    visibility: projectionVisibilitySchema,
    allowedRoles: z.array(z.string().trim().min(1).max(64)).min(1),
    approvalRequired: z.boolean(),
  }),
  stateHash: hashSchema,
  eventSeq: eventSeqSchema,
  status: z.enum(["draft", "sandbox", "approved", "rejected"]),
});
export type ContentProposal = z.infer<typeof contentProposalSchema>;

export function assertSameProjectionWorld(cursor: ProjectionCursor, worldId: string): void {
  if (cursor.worldId !== worldId) throw new Error(`Projection cursor belongs to world ${cursor.worldId}`);
}

export function hasMonotonicEventSeq(reports: readonly Pick<NarrativeReport, "eventSeq">[]): boolean {
  return reports.every((report, index) => index === 0 || report.eventSeq > reports[index - 1].eventSeq);
}

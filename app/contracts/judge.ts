import { z } from "zod";

/**
 * 终焉分布式裁判契约。
 *
 * 这是“规则辩论”与未来语义裁判共用的边界类型：裁判 Agent 只能提交
 * 绑定规则版本和证据哈希的结构化票，不能直接写入对局状态。
 */

export const judgeQuorumSchema = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(7),
]);

export type JudgeQuorum = z.infer<typeof judgeQuorumSchema>;

export const judgeKindSchema = z.enum([
  "system-jev",
  "local-heuristic",
  "external-agent",
]);

export type JudgeKind = z.infer<typeof judgeKindSchema>;

export const ruleScopeSchema = z.enum(["world", "game", "match"]);
export type RuleScope = z.infer<typeof ruleScopeSchema>;

export const ruleActivationSchema = z.enum([
  "next-round",
  "next-match",
  "next-cycle",
]);
export type RuleActivation = z.infer<typeof ruleActivationSchema>;

export const rulePackageRefSchema = z.object({
  rulebookId: z.string().min(1).max(96),
  version: z.number().int().positive(),
  scope: ruleScopeSchema,
  activation: ruleActivationSchema,
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  parentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).nullable(),
});

export type RulePackageRef = z.infer<typeof rulePackageRefSchema>;

export const judgeAssignmentSchema = z.object({
  assignmentId: z.string().min(1).max(96),
  matchId: z.string().min(1).max(96),
  judgeId: z.string().min(1).max(96),
  judgeKind: judgeKindSchema,
  quorum: judgeQuorumSchema,
  rule: rulePackageRefSchema,
  clauseId: z.string().min(1).max(96),
  evidenceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  issuedAt: z.string().datetime(),
  deadline: z.string().datetime(),
});

export type JudgeAssignment = z.infer<typeof judgeAssignmentSchema>;

export const rulingDecisionSchema = z.enum(["accept", "reject", "partial"]);
export type RulingDecision = z.infer<typeof rulingDecisionSchema>;

export const judgeBallotSchema = z.object({
  assignmentId: z.string().min(1).max(96),
  decision: rulingDecisionSchema,
  confidence: z.number().min(0).max(1),
  clauseId: z.string().min(1).max(96),
  reason: z.string().trim().min(1).max(1200),
  evidenceSeq: z.array(z.number().int().nonnegative()).max(32),
  bundleHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  idempotencyKey: z.string().min(8).max(160),
});

export type JudgeBallot = z.infer<typeof judgeBallotSchema>;

export const rulingAggregationSchema = z.object({
  matchId: z.string().min(1).max(96),
  clauseId: z.string().min(1).max(96),
  rule: rulePackageRefSchema,
  quorum: judgeQuorumSchema,
  validVotes: z.number().int().nonnegative(),
  invalidVotes: z.number().int().nonnegative(),
  decision: rulingDecisionSchema.nullable(),
  appliesFrom: z.enum(["next-round", "next-match", "next-cycle"]).nullable(),
  ballotIds: z.array(z.string().min(1).max(96)),
  eventSeq: z.number().int().nonnegative(),
});

export type RulingAggregation = z.infer<typeof rulingAggregationSchema>;

export function isValidJudgeQuorum(value: number): value is JudgeQuorum {
  return value === 3 || value === 5 || value === 7;
}

/** 多数票必须达到法定有效人数；未达到时不能产生规则生效结果。 */
export function hasValidQuorum(
  aggregation: Pick<RulingAggregation, "quorum" | "validVotes">,
): boolean {
  return aggregation.validVotes >= aggregation.quorum;
}

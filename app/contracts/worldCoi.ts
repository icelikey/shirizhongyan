import { z } from "zod";

export const COI_READ_SCOPES = [
  "world_discovery",
  "own_observation",
  "public_events",
  "unlocked_clues",
  "own_report",
] as const;

export const COI_ACTION_SCOPES = [
  "join_match",
  "start_match",
  "submit_move",
  "use_ability",
  "use_tactic",
  "speak",
  "rule_appeal",
] as const;

export const COI_PUBLISH_SCOPES = ["daily_report"] as const;

export type CoiReadScope = (typeof COI_READ_SCOPES)[number];
export type CoiActionScope = (typeof COI_ACTION_SCOPES)[number];
export type CoiPublishScope = (typeof COI_PUBLISH_SCOPES)[number];

export const coiScopeSchema = z.object({
  worldIds: z.array(z.string().min(1).max(64)).min(1),
  gameIds: z.array(z.string().min(1).max(64)).min(1),
  matchIds: z.array(z.string().min(1).max(160)).min(1),
  floorRange: z.tuple([z.number().int().min(1), z.number().int().min(1)]).refine(([min, max]) => min <= max),
});

export const coiBudgetSchema = z.object({
  observationsPerDay: z.number().int().positive(),
  actionsPerDay: z.number().int().positive(),
  externalRequestsPerDay: z.number().int().nonnegative(),
  thinkingSecondsPerAction: z.number().int().positive(),
});

export const coiGrantSchema = z.object({
  grantId: z.string().min(1),
  worldId: z.string().min(1),
  epoch: z.number().int().positive(),
  scope: coiScopeSchema,
  readScopes: z.array(z.enum(COI_READ_SCOPES)),
  actionScopes: z.array(z.enum(COI_ACTION_SCOPES)),
  publishScopes: z.array(z.enum(COI_PUBLISH_SCOPES)),
  budget: coiBudgetSchema,
  status: z.enum(["active", "revoked", "expired"]),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().nullable(),
  revokeReason: z.string().nullable(),
});

export type CoiGrant = z.infer<typeof coiGrantSchema>;

export const DEFAULT_COI_BUDGET = {
  // Worker 默认每 5 秒轮询房间列表和观测；预算必须覆盖常驻运行而不是只覆盖人工点击。
  observationsPerDay: 100_000,
  actionsPerDay: 300,
  externalRequestsPerDay: 100,
  thinkingSecondsPerAction: 30,
} as const;

export function actionScopeForGameAction(action: unknown): CoiActionScope {
  const type = typeof action === "object" && action !== null && "type" in action
    ? String((action as { type?: unknown }).type)
    : "";
  if (type === "start") return "start_match";
  if (type === "ability") return "use_ability";
  if (type === "use_tactic") return "use_tactic";
  if (type === "speak") return "speak";
  return "submit_move";
}

export function scopeContains(
  grant: {
    scope: CoiGrant["scope"];
    readScopes: readonly CoiReadScope[];
    actionScopes: readonly CoiActionScope[];
    publishScopes: readonly CoiPublishScope[];
  },
  input: { worldId: string; gameId?: string; matchId?: string; floor?: number; read?: CoiReadScope; action?: CoiActionScope; publish?: CoiPublishScope },
): boolean {
  const { scope } = grant;
  const floor = input.floor ?? 1;
  const inList = (items: readonly string[], value: string | undefined) => !value || items.includes("*") || items.includes(value);
  const inRange = floor >= scope.floorRange[0] && floor <= scope.floorRange[1];
  return inList(scope.worldIds, input.worldId) &&
    inList(scope.gameIds, input.gameId) &&
    inList(scope.matchIds, input.matchId) &&
    inRange &&
    (!input.read || grant.readScopes.includes(input.read)) &&
    (!input.action || grant.actionScopes.includes(input.action)) &&
    (!input.publish || grant.publishScopes.includes(input.publish));
}

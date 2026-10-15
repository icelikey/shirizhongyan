/**
 * TDG-WP v0.1 公共世界协议契约。
 *
 * 这里定义跨 HTTP、CLI、未来 MCP/A2A 适配器共享的边界对象。
 * 游戏专属动作仍由 Game SDK 在进入房间 actor 前校验；本文件只定义
 * 身份、作用域、命令、观测、收据与可投递事件的公共外壳。
 */
import { z } from "zod";

export const WORLD_PROTOCOL_VERSION = "0.1" as const;

export const protocolVersionSchema = z.literal(WORLD_PROTOCOL_VERSION);

export const agentIdentitySchema = z.object({
  agentId: z.number().int().positive(),
  name: z.string().trim().min(1).max(64),
});

export const agentDescriptorSchema = agentIdentitySchema.extend({
  status: z.enum(["active", "revoked"]),
});

export const roleBindingSchema = z.object({
  bindingId: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(64),
  scopeId: z.string().trim().min(1).max(160),
  seatIndex: z.number().int().min(0).max(15).nullable().optional(),
});

/**
 * 命令 envelope 的 action 保持 unknown：命令外壳负责协议和幂等，
 * Game SDK 负责按 template 验证具体动作，避免公共协议复制游戏规则。
 */
export const worldCommandSchema = z.object({
  protocolVersion: protocolVersionSchema.optional(),
  commandId: z.string().trim().min(1).max(128).optional(),
  contextRef: z.string().trim().min(1).max(160).optional(),
  bindingId: z.string().trim().min(1).max(160).optional(),
  action: z.unknown(),
});

export const commandStatusSchema = z.enum([
  "pending",
  "committed",
  "rejected",
]);

export const commandReceiptSchema = z.object({
  protocolVersion: protocolVersionSchema,
  receipt: z.object({
    commandId: z.string().trim().min(1).max(128),
    scopeId: z.string().trim().min(1).max(160),
    status: commandStatusSchema,
    result: z.unknown().optional(),
  }),
  contextRef: z.string().trim().min(1).max(160),
  observation: z.unknown(),
});

export const protocolErrorSchema = z.object({
  protocolVersion: protocolVersionSchema,
  error: z.object({
    code: z.string().trim().min(1).max(64),
    message: z.string().trim().min(1).max(600),
  }),
});

export const worldEventSchema = z.object({
  eventId: z.string().trim().min(1).max(192),
  protocolVersion: protocolVersionSchema,
  eventType: z.string().trim().min(1).max(96),
  scopeId: z.string().trim().min(1).max(160),
  aggregateId: z.string().trim().min(1).max(160).nullable(),
  commandId: z.string().trim().min(1).max(128).nullable(),
  sequence: z.number().int().min(0).nullable(),
  occurredAt: z.string().datetime({ offset: true }),
  payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  payload: z.unknown(),
});

export const observationEnvelopeSchema = z.object({
  protocolVersion: protocolVersionSchema,
  binding: roleBindingSchema,
  contextRef: z.string().trim().min(1).max(160),
  observation: z.unknown(),
});

export const gamePackageOriginSchema = z.enum(["core-agent", "player"]);
export const gamePackageStatusSchema = z.enum([
  "draft",
  "published",
  "deprecated",
]);

/**
 * Package 是可发现、可版本化的内容边界；definition/TemplateModule 仍是
 * 服务端内部执行细节。玩家包与核心 Agent 包共享此目录形状，但发布权限不同。
 */
export const gamePackageManifestSchema = z.object({
  packageId: z.string().trim().min(1).max(64),
  defId: z.string().trim().min(1).max(64),
  version: z.string().trim().regex(/^v[0-9]+\\.[0-9]+\\.[0-9]+$/),
  template: z.string().trim().min(1).max(64),
  origin: gamePackageOriginSchema,
  status: gamePackageStatusSchema,
  worldRuleVersion: z.string().trim().min(1).max(32),
  supportedActionTypes: z.array(z.string().trim().min(1).max(32)).max(32),
  projectionVersion: z.string().trim().min(1).max(32),
});

export type AgentIdentity = z.infer<typeof agentIdentitySchema>;
export type AgentDescriptor = z.infer<typeof agentDescriptorSchema>;
export type RoleBinding = z.infer<typeof roleBindingSchema>;
export type WorldCommand = z.infer<typeof worldCommandSchema>;
export type CommandReceipt = z.infer<typeof commandReceiptSchema>;
export type ProtocolError = z.infer<typeof protocolErrorSchema>;
export type WorldEvent = z.infer<typeof worldEventSchema>;
export type ObservationEnvelope = z.infer<typeof observationEnvelopeSchema>;
export type GamePackageManifest = z.infer<typeof gamePackageManifestSchema>;

export interface GamePackageRegistryPort {
  listPublished(): readonly GamePackageManifest[];
  resolve(packageId: string, version?: string): GamePackageManifest | null;
}

/**
 * 认证世界节点协议只承载公开的节点能力与可审计引用。
 *
 * 所有对象均为 strict，避免把私有身份、API key、房间内部状态或任意
 * 未定义的扩展字段借由协议边界带入公共世界层。内容包版本按 packageId
 * 建立显式映射，贡献内容只携带摘要，不携带原始房间或玩家数据。
 */
const nodeIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const worldIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/);
const packageIdSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/);
const publicVersionSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
const packageVersionSchema = z
  .string()
  .trim()
  .regex(/^v?[0-9]+\.[0-9]+\.[0-9]+$/);
const publicKeySchema = z.string().trim().min(1).max(4096);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const auditModeSchema = z.enum(["full", "sampled", "hash-only"]);

const contentPackageIdsSchema = z
  .array(packageIdSchema)
  .max(128)
  .refine(
    ids => new Set(ids).size === ids.length,
    "contentPackageIds must be unique"
  );

const contentPackageVersionsSchema = z.record(
  packageIdSchema,
  packageVersionSchema
);
const supportedGamePackageIdsSchema = z
  .array(packageIdSchema)
  .max(128)
  .refine(
    ids => new Set(ids).size === ids.length,
    "supportedGamePackageIds must be unique"
  );
const capabilitiesSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(64)
  .refine(
    values => new Set(values).size === values.length,
    "capabilities must be unique"
  );

const publicNodeFields = {
  protocolVersion: protocolVersionSchema,
  nodeId: nodeIdSchema,
  worldId: worldIdSchema,
  baseEpoch: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  ruleVersion: publicVersionSchema,
  contentPackageIds: contentPackageIdsSchema,
  contentPackageVersions: contentPackageVersionsSchema,
  supportedGamePackageIds: supportedGamePackageIdsSchema,
  publicKey: publicKeySchema,
  capabilities: capabilitiesSchema,
  auditMode: auditModeSchema,
} satisfies z.ZodRawShape;

const validateContentPackageVersions = (
  value: {
    contentPackageIds: readonly string[];
    contentPackageVersions: Readonly<Record<string, string>>;
  },
  ctx: z.RefinementCtx
) => {
  const ids = [...value.contentPackageIds].sort();
  const versionIds = Object.keys(value.contentPackageVersions).sort();

  if (
    ids.length !== versionIds.length ||
    ids.some((id, index) => id !== versionIds[index])
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["contentPackageVersions"],
      message:
        "contentPackageVersions must contain exactly one version for every contentPackageId",
    });
  }
};

const contributionEntrySchema = z
  .object({
    contributionId: z.string().trim().min(1).max(128),
    contentPackageId: packageIdSchema,
    contentPackageVersion: packageVersionSchema,
    digest: digestSchema,
  })
  .strict();

const compatibilityEntrySchema = z
  .object({
    gamePackageId: packageIdSchema,
    compatible: z.boolean(),
    reason: z.string().trim().min(1).max(160).nullable(),
  })
  .strict();

export const WorldNodeManifest = z
  .object(publicNodeFields)
  .strict()
  .superRefine(validateContentPackageVersions);

export const ContributionBatch = z
  .object({
    ...publicNodeFields,
    batchId: z.string().trim().min(1).max(128),
    contributions: z.array(contributionEntrySchema).min(1).max(256),
  })
  .strict()
  .superRefine(validateContentPackageVersions);

export const CompatibilityMatrix = z
  .object({
    ...publicNodeFields,
    entries: z.array(compatibilityEntrySchema).min(1).max(128),
  })
  .strict()
  .superRefine(validateContentPackageVersions);

export type WorldNodeManifest = z.infer<typeof WorldNodeManifest>;
export type ContributionBatch = z.infer<typeof ContributionBatch>;
export type CompatibilityMatrix = z.infer<typeof CompatibilityMatrix>;

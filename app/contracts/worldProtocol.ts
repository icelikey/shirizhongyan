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

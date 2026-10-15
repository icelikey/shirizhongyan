import { createHash } from "node:crypto";
import {
  CompatibilityMatrix as compatibilityMatrixSchema,
  ContributionBatch as contributionBatchSchema,
  WORLD_PROTOCOL_VERSION,
  WorldNodeManifest as worldNodeManifestSchema,
  type CompatibilityMatrix as CompatibilityMatrixValue,
  type ContributionBatch as ContributionBatchValue,
  type WorldNodeManifest as WorldNodeManifestValue,
} from "../contracts/worldProtocol";
import {
  worldContributionSchema,
  type WorldContribution,
  type WorldDirection,
} from "../contracts/worldEmergence";
import type { GameTemplate } from "../contracts/gameSdk";

export type RuntimeIssue = {
  code: string;
  path: Array<string | number>;
  message: string;
};

export class WorldNodeRuntimeValidationError extends Error {
  readonly issues: readonly RuntimeIssue[];

  constructor(message: string, issues: readonly RuntimeIssue[]) {
    super(message);
    this.name = "WorldNodeRuntimeValidationError";
    this.issues = issues;
  }
}

export type CreateWorldNodeManifestInput = Omit<
  WorldNodeManifestValue,
  "protocolVersion"
> & {
  protocolVersion?: WorldNodeManifestValue["protocolVersion"];
};

export type CompatibilityCheck = {
  compatible: boolean;
  required: string;
  supported: string;
  reason: string | null;
};

export type ContentPackageCompatibility = {
  packageId: string;
  requiredVersion: string;
  supportedVersions: string[];
  compatible: boolean;
  reason: string | null;
};

export type GamePackageCompatibility = {
  gamePackageId: string;
  compatible: boolean;
  reason: string | null;
};

export type WorldNodeCompatibilityResult = {
  compatible: boolean;
  protocolVersion: CompatibilityCheck;
  ruleVersion: CompatibilityCheck;
  contentPackages: ContentPackageCompatibility[];
  gamePackages: GamePackageCompatibility[];
  issues: RuntimeIssue[];
  reasons: string[];
  matrix: CompatibilityMatrixValue | null;
};

export type SupportedPackageVersions = Readonly<
  Record<string, string | readonly string[]>
>;

export type PublicContributionSummary = {
  eventId: string;
  contributionKey?: string;
  worldId: string;
  epoch: number;
  /** 只能是已脱敏、可公开引用的参与者标识。 */
  participantRef: string;
  participantKind: WorldContribution["participantKind"];
  gameId: string;
  direction: WorldDirection;
  weight?: number;
  evidenceRefs?: string[];
  clueId?: string | null;
  committedAt: string;
  /** 公开的 Game SDK 模板标签，可选且只进入摘要哈希。 */
  gameTemplate?: GameTemplate;
};

export type ContributionSummaryInput = {
  contributionId: string;
  contentPackageId: string;
  contentPackageVersion: string;
  summary: PublicContributionSummary;
};

export type BuildContributionBatchInput = {
  manifest: WorldNodeManifestValue;
  batchId: string;
  contributions: readonly ContributionSummaryInput[];
};

const contributionWrapperKeys = new Set([
  "contributionId",
  "contentPackageId",
  "contentPackageVersion",
  "summary",
]);

const publicSummaryKeys = new Set([
  "eventId",
  "contributionKey",
  "worldId",
  "epoch",
  "participantRef",
  "participantKind",
  "gameId",
  "direction",
  "weight",
  "evidenceRefs",
  "clueId",
  "committedAt",
  "gameTemplate",
]);

const forbiddenFieldNames = new Set([
  "apikey",
  "privateidentity",
  "privatekey",
  "identity",
  "userid",
  "agentkeyid",
  "email",
  "phone",
  "realname",
  "credential",
  "password",
  "accesstoken",
  "refreshtoken",
  "hiddenroomstate",
  "privateroomstate",
  "hiddenstate",
  "privatestate",
  "privatechat",
  "directmessage",
  "privatemessage",
  "dm",
  "rawevent",
  "rawevents",
  "eventdetail",
  "eventdetails",
  "rawpayload",
  "payload",
  "eventlog",
  "rawlog",
]);

function normalizeFieldName(value: string): string {
  return value.replace(/[\s_-]/g, "").toLowerCase();
}

function forbiddenFieldReason(key: string): string | null {
  const normalized = normalizeFieldName(key);
  if (forbiddenFieldNames.has(normalized)) return key;
  if (normalized.includes("apikey")) return key;
  if (normalized.includes("privateidentity")) return key;
  if (normalized.includes("hiddenroomstate")) return key;
  if (normalized.includes("privatechat")) return key;
  if (normalized.includes("rawevent")) return key;
  if (normalized.includes("eventdetail")) return key;
  return null;
}

function assertPublicFields(
  value: unknown,
  path: Array<string | number>,
  allowedKeys: ReadonlySet<string>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPublicFields(item, [...path, index], allowedKeys));
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    const forbidden = forbiddenFieldReason(key);
    if (forbidden) {
      throw new WorldNodeRuntimeValidationError(
        `公开贡献摘要包含禁止字段: ${forbidden}`,
        [{ code: "forbidden-public-field", path: [...path, key], message: `禁止字段: ${forbidden}` }],
      );
    }
    if (!allowedKeys.has(key)) {
      throw new WorldNodeRuntimeValidationError(
        `公开贡献摘要包含未声明字段: ${key}`,
        [{ code: "unknown-public-field", path: [...path, key], message: `未声明字段: ${key}` }],
      );
    }
    const childAllowedKeys = allowedKeys === contributionWrapperKeys && key === "summary"
      ? publicSummaryKeys
      : allowedKeys;
    assertPublicFields(child, [...path, key], childAllowedKeys);
  }
}

function zodIssues(error: { issues: readonly { code: string; path: PropertyKey[]; message: string }[] }): RuntimeIssue[] {
  return error.issues.map(issue => ({
    code: issue.code,
    path: issue.path.map(part => (typeof part === "symbol" ? part.toString() : part)),
    message: issue.message,
  }));
}

function throwOnZodFailure(
  operation: string,
  result: { success: true; data: unknown } | { success: false; error: { issues: readonly { code: string; path: PropertyKey[]; message: string }[] } },
): asserts result is { success: true; data: unknown } {
  if (!result.success) {
    throw new WorldNodeRuntimeValidationError(`${operation}校验失败`, zodIssues(result.error));
  }
}

function stableJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("只支持有限 JSON 数字");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("摘要只能包含 JSON 可序列化值");
}

function digestFor(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

function semanticIssue(code: string, path: Array<string | number>, message: string): RuntimeIssue {
  return { code, path, message };
}

function packageVersionsFor(
  packageId: string,
  supportedPackageVersions: SupportedPackageVersions,
): string[] {
  const value = supportedPackageVersions[packageId];
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : [...value];
}

function firstReason(issues: readonly RuntimeIssue[]): string | null {
  return issues[0]?.message ?? null;
}

export function createWorldNodeManifest(
  input: CreateWorldNodeManifestInput,
): WorldNodeManifestValue {
  const candidate = {
    protocolVersion: input.protocolVersion ?? WORLD_PROTOCOL_VERSION,
    nodeId: input.nodeId,
    worldId: input.worldId,
    baseEpoch: input.baseEpoch,
    ruleVersion: input.ruleVersion,
    contentPackageIds: [...input.contentPackageIds],
    contentPackageVersions: { ...input.contentPackageVersions },
    supportedGamePackageIds: [...input.supportedGamePackageIds],
    publicKey: input.publicKey,
    capabilities: [...input.capabilities],
    auditMode: input.auditMode,
  };
  const result = worldNodeManifestSchema.safeParse(candidate);
  throwOnZodFailure("WorldNodeManifest", result);
  return result.data as WorldNodeManifestValue;
}

export function validateWorldNodeCompatibility(
  manifest: WorldNodeManifestValue,
  supportedProtocolVersion: string,
  supportedRuleVersion: string,
  supportedPackageVersions: SupportedPackageVersions,
): WorldNodeCompatibilityResult {
  const parsedManifest = worldNodeManifestSchema.safeParse(manifest);
  if (!parsedManifest.success) {
    const issues = zodIssues(parsedManifest.error);
    return {
      compatible: false,
      protocolVersion: {
        compatible: false,
        required: "valid WorldNodeManifest",
        supported: supportedProtocolVersion,
        reason: "节点清单无效，无法进行兼容性判断",
      },
      ruleVersion: {
        compatible: false,
        required: "valid WorldNodeManifest",
        supported: supportedRuleVersion,
        reason: "节点清单无效，无法进行兼容性判断",
      },
      contentPackages: [],
      gamePackages: [],
      issues,
      reasons: issues.map(issue => issue.message),
      matrix: null,
    };
  }

  const checkedManifest = parsedManifest.data;
  const issues: RuntimeIssue[] = [];
  const protocolCompatible = checkedManifest.protocolVersion === supportedProtocolVersion;
  const ruleCompatible = checkedManifest.ruleVersion === supportedRuleVersion;

  const protocolReason = protocolCompatible
    ? null
    : `协议版本不兼容: 节点要求 ${checkedManifest.protocolVersion}，本地支持 ${supportedProtocolVersion}`;
  if (!protocolCompatible) {
    issues.push(semanticIssue("protocol-version-mismatch", ["protocolVersion"], protocolReason!));
  }

  const ruleReason = ruleCompatible
    ? null
    : `规则版本不兼容: 节点要求 ${checkedManifest.ruleVersion}，本地支持 ${supportedRuleVersion}`;
  if (!ruleCompatible) {
    issues.push(semanticIssue("rule-version-mismatch", ["ruleVersion"], ruleReason!));
  }

  const contentPackages = checkedManifest.contentPackageIds.map(packageId => {
    const requiredVersion = checkedManifest.contentPackageVersions[packageId];
    const supportedVersions = packageVersionsFor(packageId, supportedPackageVersions);
    const compatible = supportedVersions.includes(requiredVersion);
    const reason = compatible
      ? null
      : supportedVersions.length === 0
        ? `内容包不兼容: 未支持 ${packageId}@${requiredVersion}`
        : `内容包版本不兼容: ${packageId} 要求 ${requiredVersion}，本地支持 ${supportedVersions.join(", ")}`;
    if (!compatible) {
      issues.push(semanticIssue(
        supportedVersions.length === 0 ? "content-package-missing" : "content-package-version-mismatch",
        ["contentPackageVersions", packageId],
        reason!,
      ));
    }
    return { packageId, requiredVersion, supportedVersions, compatible, reason };
  });

  const globalCompatible = protocolCompatible && ruleCompatible && contentPackages.every(item => item.compatible);
  const gamePackages = checkedManifest.supportedGamePackageIds.map(gamePackageId => {
    const reason = globalCompatible
      ? null
      : firstReason(issues) ?? "节点运行时不兼容";
    return { gamePackageId, compatible: globalCompatible, reason };
  });

  let matrix: CompatibilityMatrixValue | null = null;
  if (gamePackages.length > 0) {
    const matrixResult = compatibilityMatrixSchema.safeParse({
      ...checkedManifest,
      entries: gamePackages,
    });
    if (matrixResult.success) {
      matrix = matrixResult.data;
    } else {
      const matrixIssues = zodIssues(matrixResult.error);
      issues.push(...matrixIssues);
    }
  }

  return {
    compatible: globalCompatible && issues.length === 0,
    protocolVersion: {
      compatible: protocolCompatible,
      required: checkedManifest.protocolVersion,
      supported: supportedProtocolVersion,
      reason: protocolReason,
    },
    ruleVersion: {
      compatible: ruleCompatible,
      required: checkedManifest.ruleVersion,
      supported: supportedRuleVersion,
      reason: ruleReason,
    },
    contentPackages,
    gamePackages,
    issues,
    reasons: issues.map(issue => issue.message),
    matrix,
  };
}

function normalizedSummary(summary: PublicContributionSummary, contributionId: string): WorldContribution {
  const candidate = {
    eventId: summary.eventId,
    contributionKey: summary.contributionKey ?? contributionId,
    worldId: summary.worldId,
    epoch: summary.epoch,
    participantRef: summary.participantRef,
    participantKind: summary.participantKind,
    gameId: summary.gameId,
    direction: summary.direction,
    weight: summary.weight,
    evidenceRefs: summary.evidenceRefs,
    clueId: summary.clueId,
    committedAt: summary.committedAt,
  };
  const result = worldContributionSchema.safeParse(candidate);
  throwOnZodFailure("公开贡献摘要", result);
  return result.data as WorldContribution;
}

export function buildContributionBatch(
  input: BuildContributionBatchInput,
): ContributionBatchValue {
  const manifestResult = worldNodeManifestSchema.safeParse(input.manifest);
  throwOnZodFailure("WorldNodeManifest", manifestResult);

  const seenContributionIds = new Set<string>();
  const prepared = input.contributions.map((entry, index) => {
    assertPublicFields(entry, ["contributions", index], contributionWrapperKeys);
    if (seenContributionIds.has(entry.contributionId)) {
      throw new WorldNodeRuntimeValidationError(
        `贡献 ID 重复: ${entry.contributionId}`,
        [semanticIssue("duplicate-contribution-id", ["contributions", index, "contributionId"], `贡献 ID 重复: ${entry.contributionId}`)],
      );
    }
    seenContributionIds.add(entry.contributionId);

    assertPublicFields(entry.summary, ["contributions", index, "summary"], publicSummaryKeys);
    const summary = normalizedSummary(entry.summary, entry.contributionId);
    const expectedVersion = manifestResult.data.contentPackageVersions[entry.contentPackageId];
    if (expectedVersion === undefined) {
      throw new WorldNodeRuntimeValidationError(
        `内容包未在节点清单中声明: ${entry.contentPackageId}`,
        [semanticIssue("content-package-not-declared", ["contributions", index, "contentPackageId"], `内容包未在节点清单中声明: ${entry.contentPackageId}`)],
      );
    }
    if (expectedVersion !== entry.contentPackageVersion) {
      throw new WorldNodeRuntimeValidationError(
        `贡献内容包版本不匹配: ${entry.contentPackageId}`,
        [semanticIssue("content-package-version-mismatch", ["contributions", index, "contentPackageVersion"], `贡献要求 ${entry.contentPackageVersion}，节点声明 ${expectedVersion}`)],
      );
    }
    if (summary.worldId !== manifestResult.data.worldId) {
      throw new WorldNodeRuntimeValidationError(
        `贡献世界标识不匹配: ${summary.worldId}`,
        [semanticIssue("world-id-mismatch", ["contributions", index, "summary", "worldId"], `贡献属于 ${summary.worldId}，节点属于 ${manifestResult.data.worldId}`)],
      );
    }

    const digestInput = {
      contributionId: entry.contributionId,
      contentPackageId: entry.contentPackageId,
      contentPackageVersion: entry.contentPackageVersion,
      summary: {
        ...summary,
        ...(entry.summary.gameTemplate === undefined ? {} : { gameTemplate: entry.summary.gameTemplate }),
      },
    };
    return {
      contributionId: entry.contributionId,
      contentPackageId: entry.contentPackageId,
      contentPackageVersion: entry.contentPackageVersion,
      digest: digestFor(digestInput),
    };
  });

  const candidate = {
    ...manifestResult.data,
    batchId: input.batchId,
    contributions: prepared.sort((left, right) => left.contributionId.localeCompare(right.contributionId)),
  };
  const result = contributionBatchSchema.safeParse(candidate);
  throwOnZodFailure("ContributionBatch", result);
  return result.data as ContributionBatchValue;
}

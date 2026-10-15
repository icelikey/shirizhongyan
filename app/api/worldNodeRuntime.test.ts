import { describe, expect, it } from "vitest";
import { WORLD_PROTOCOL_VERSION } from "../contracts/worldProtocol";
import {
  buildContributionBatch,
  createWorldNodeManifest,
  validateWorldNodeCompatibility,
  type PublicContributionSummary,
} from "./worldNodeRuntime";

const manifestInput = {
  nodeId: "node-alpha",
  worldId: "world-tdg",
  baseEpoch: 42,
  ruleVersion: "v1.2.0",
  contentPackageIds: ["lore-core", "rules-public"],
  contentPackageVersions: {
    "lore-core": "v1.0.0",
    "rules-public": "v2.1.0",
  },
  supportedGamePackageIds: ["guess-core", "superpower-billiards"],
  publicKey: "ed25519:public-node-alpha-key",
  capabilities: ["publish-contribution", "verify-node"],
  auditMode: "full" as const,
};

const manifest = createWorldNodeManifest(manifestInput);

const summary = (overrides: Partial<PublicContributionSummary> = {}): PublicContributionSummary => ({
  eventId: "match-001:world:0",
  contributionKey: "match-001:world:0",
  worldId: "world-tdg",
  epoch: 42,
  participantRef: "agent:public-1",
  participantKind: "agent",
  gameId: "guess-core",
  direction: "memory",
  weight: 2,
  evidenceRefs: ["match-001"],
  clueId: null,
  committedAt: "2026-10-16T00:00:00.000Z",
  ...overrides,
});

const batchInput = {
  manifest,
  batchId: "batch-001",
  contributions: [
    {
      contributionId: "contribution-001",
      contentPackageId: "lore-core",
      contentPackageVersion: "v1.0.0",
      summary: summary(),
    },
  ],
};

describe("World Node pure runtime slice", () => {
  it("构造并校验包含完整公开字段的节点清单", () => {
    expect(manifest).toMatchObject({
      protocolVersion: WORLD_PROTOCOL_VERSION,
      nodeId: "node-alpha",
      worldId: "world-tdg",
      baseEpoch: 42,
      ruleVersion: "v1.2.0",
      contentPackageIds: ["lore-core", "rules-public"],
      contentPackageVersions: { "lore-core": "v1.0.0", "rules-public": "v2.1.0" },
      supportedGamePackageIds: ["guess-core", "superpower-billiards"],
      publicKey: "ed25519:public-node-alpha-key",
      capabilities: ["publish-contribution", "verify-node"],
      auditMode: "full",
    });
  });

  it("返回协议、规则、内容包和游戏包的结构化兼容结果", () => {
    const result = validateWorldNodeCompatibility(
      manifest,
      WORLD_PROTOCOL_VERSION,
      "v1.2.0",
      { "lore-core": "v1.0.0", "rules-public": ["v2.0.0", "v2.1.0"] },
    );

    expect(result.compatible).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.contentPackages.every(item => item.compatible)).toBe(true);
    expect(result.gamePackages).toEqual([
      { gamePackageId: "guess-core", compatible: true, reason: null },
      { gamePackageId: "superpower-billiards", compatible: true, reason: null },
    ]);
    expect(result.matrix?.entries).toHaveLength(2);
  });

  it("保留协议、规则和内容包版本不兼容原因", () => {
    const result = validateWorldNodeCompatibility(
      manifest,
      "0.2",
      "v9.9.9",
      { "lore-core": "v9.0.0" },
    );

    expect(result.compatible).toBe(false);
    expect(result.protocolVersion.reason).toContain("协议版本不兼容");
    expect(result.ruleVersion.reason).toContain("规则版本不兼容");
    expect(result.contentPackages).toEqual([
      {
        packageId: "lore-core",
        requiredVersion: "v1.0.0",
        supportedVersions: ["v9.0.0"],
        compatible: false,
        reason: "内容包版本不兼容: lore-core 要求 v1.0.0，本地支持 v9.0.0",
      },
      {
        packageId: "rules-public",
        requiredVersion: "v2.1.0",
        supportedVersions: [],
        compatible: false,
        reason: "内容包不兼容: 未支持 rules-public@v2.1.0",
      },
    ]);
    expect(result.reasons.join(" | ")).toContain("lore-core");
    expect(result.reasons.join(" | ")).toContain("rules-public");
    expect(result.matrix?.entries.every(entry => entry.compatible === false)).toBe(true);
  });

  it.each([
    "apiKey",
    "privateIdentity",
    "hiddenRoomState",
    "privateChat",
    "rawEventDetails",
  ])("拒绝公开摘要中的私有或原始事件字段: %s", forbiddenField => {
    const unsafeSummary = { ...summary(), [forbiddenField]: "must-not-cross-boundary" } as never;
    expect(() => buildContributionBatch({
      ...batchInput,
      contributions: [{ ...batchInput.contributions[0], summary: unsafeSummary }],
    })).toThrow(forbiddenField);
  });

  it("校验公开摘要并构造内容摘要哈希批次", () => {
    const batch = buildContributionBatch(batchInput);

    expect(batch).toMatchObject({
      ...manifest,
      batchId: "batch-001",
    });
    expect(batch.contributions).toHaveLength(1);
    expect(batch.contributions[0].digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(JSON.stringify(batch))).toEqual(batch);
  });

  it("拒绝重复贡献 ID和超过契约上限的批次", () => {
    const duplicate = {
      ...batchInput,
      contributions: [
        batchInput.contributions[0],
        { ...batchInput.contributions[0], summary: summary({ eventId: "match-002:world:0" }) },
      ],
    };
    expect(() => buildContributionBatch(duplicate)).toThrow("贡献 ID 重复");

    const tooMany = Array.from({ length: 257 }, (_, index) => ({
      contributionId: `contribution-${index}`,
      contentPackageId: "lore-core",
      contentPackageVersion: "v1.0.0",
      summary: summary({
        eventId: `match-${index}:world:0`,
        contributionKey: `match-${index}:world:0`,
      }),
    }));
    expect(() => buildContributionBatch({ ...batchInput, contributions: tooMany })).toThrow("ContributionBatch校验失败");
  });

  it("对相同输入产生完全相同的批次和摘要哈希", () => {
    const first = buildContributionBatch(batchInput);
    const second = buildContributionBatch(JSON.parse(JSON.stringify(batchInput)));
    expect(second).toEqual(first);
  });
});

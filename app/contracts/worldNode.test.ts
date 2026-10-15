import { describe, expect, it } from "vitest";
import {
  ContributionBatch,
  CompatibilityMatrix,
  WORLD_PROTOCOL_VERSION,
  WorldNodeManifest,
} from "./worldProtocol";

const publicNodeFields = {
  protocolVersion: WORLD_PROTOCOL_VERSION,
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

const validManifest = { ...publicNodeFields };
const validContributionBatch = {
  ...publicNodeFields,
  batchId: "batch-001",
  contributions: [
    {
      contributionId: "contribution-001",
      contentPackageId: "lore-core",
      contentPackageVersion: "v1.0.0",
      digest: "a".repeat(64),
    },
  ],
};
const validCompatibilityMatrix = {
  ...publicNodeFields,
  entries: [
    { gamePackageId: "guess-core", compatible: true, reason: null },
    {
      gamePackageId: "superpower-billiards",
      compatible: false,
      reason: "rule version differs",
    },
  ],
};

const contracts = [
  ["WorldNodeManifest", WorldNodeManifest, validManifest],
  ["ContributionBatch", ContributionBatch, validContributionBatch],
  ["CompatibilityMatrix", CompatibilityMatrix, validCompatibilityMatrix],
] as const;

describe("authenticated world node contracts", () => {
  it.each(contracts)("accepts a valid %s", (_name, contract, value) => {
    expect(contract.safeParse(value).success).toBe(true);
  });

  it.each(contracts)(
    "rejects a missing required field in %s",
    (_name, contract, value) => {
      const withoutWorldId = { ...value } as Record<string, unknown>;
      delete withoutWorldId.worldId;

      expect(contract.safeParse(withoutWorldId).success).toBe(false);
    }
  );

  it.each(contracts)(
    "rejects an incompatible protocol version in %s",
    (_name, contract, value) => {
      expect(
        contract.safeParse({ ...value, protocolVersion: "9.9" }).success
      ).toBe(false);
    }
  );

  it.each(contracts)(
    "rejects an out-of-bounds nodeId in %s",
    (_name, contract, value) => {
      expect(
        contract.safeParse({ ...value, nodeId: "n".repeat(129) }).success
      ).toBe(false);
    }
  );

  it.each(contracts)(
    "rejects private identity, API keys, and hidden room state in %s",
    (_name, contract, value) => {
      for (const forbiddenField of [
        "privateIdentity",
        "apiKey",
        "privateKey",
        "hiddenRoomState",
      ]) {
        expect(
          contract.safeParse({
            ...value,
            [forbiddenField]: "must-not-cross-boundary",
          }).success
        ).toBe(false);
      }
    }
  );

  it("rejects content package version maps that do not match their public ids", () => {
    expect(
      WorldNodeManifest.safeParse({
        ...validManifest,
        contentPackageVersions: { "lore-core": "v1.0.0" },
      }).success
    ).toBe(false);
  });

  it("rejects an out-of-bounds contribution batch", () => {
    expect(
      ContributionBatch.safeParse({
        ...validContributionBatch,
        contributions: Array.from({ length: 257 }, (_, index) => ({
          contributionId: `contribution-${index}`,
          contentPackageId: "lore-core",
          contentPackageVersion: "v1.0.0",
          digest: "a".repeat(64),
        })),
      }).success
    ).toBe(false);
  });

  it("rejects an out-of-bounds compatibility matrix", () => {
    expect(
      CompatibilityMatrix.safeParse({
        ...validCompatibilityMatrix,
        entries: Array.from({ length: 129 }, () => ({
          gamePackageId: "guess-core",
          compatible: true,
          reason: null,
        })),
      }).success
    ).toBe(false);
  });
});

/**
 * 终焉世界服务器层的涌现契约。
 *
 * 世界不是由一个“世界 Agent”单方面写作，而是由同一服务器内已经结算的
 * 玩家/Agent 选择，在一个可复算的世界纪元中聚合出方向。原始秘密动作不出
 * 房间；只有完成对局后的公开贡献和经过脱敏的证据摘要可以进入世界层。
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const WORLD_EMERGENCE_VERSION = "1.0" as const;

export const WORLD_DIRECTIONS = [
  "law",        // 规则、秩序和可验证事实
  "voice",      // 发言、叙事和社会共识
  "trust",      // 协作、承诺和互惠
  "rupture",    // 背叛、异常和小概率转折
  "memory",     // 记忆、线索和轮回连续性
] as const;

export type WorldDirection = (typeof WORLD_DIRECTIONS)[number];

export const worldDirectionSchema = z.enum(WORLD_DIRECTIONS);

/**
 * 一个贡献最多影响一个世界方向。
 * contributionKey 由服务端生成，用来防止同一玩家通过重复提交刷高权重。
 */
export const worldContributionSchema = z.object({
  eventId: z.string().min(1).max(192),
  contributionKey: z.string().min(1).max(192),
  worldId: z.string().min(1).max(64),
  epoch: z.number().int().positive(),
  participantRef: z.string().min(1).max(128),
  participantKind: z.enum(["human", "agent", "team"]),
  gameId: z.string().min(1).max(64),
  direction: worldDirectionSchema,
  /** 由游戏规则给出的固定权重，不能由 Agent 临时提高。 */
  weight: z.number().int().min(1).max(3).default(1),
  /** 公开事实引用，不得放秘密身份、API Key 或完整对话。 */
  evidenceRefs: z.array(z.string().min(1).max(192)).max(12).default([]),
  clueId: z.string().min(1).max(96).nullable().default(null),
  committedAt: z.string().datetime({ offset: true }),
});

export type WorldContribution = z.infer<typeof worldContributionSchema>;

export interface DirectionTally {
  direction: WorldDirection;
  score: number;
  contributions: number;
  participants: number;
  share: number;
}

export interface EmergentTruthShard {
  clueId: string;
  supportingEvents: string[];
  supportingGames: string[];
  independentParticipants: number;
  confidence: number;
  status: "rumor" | "confirmed";
}

export interface WorldEpochSnapshot {
  version: typeof WORLD_EMERGENCE_VERSION;
  worldId: string;
  epoch: number;
  direction: WorldDirection | null;
  directionTallies: DirectionTally[];
  contributionsAccepted: number;
  uniqueParticipants: number;
  truthShards: EmergentTruthShard[];
  /** 供下一纪元继承的公开世界状态；不包含玩家私密动作。 */
  publicAnchors: string[];
}

export interface WorldSnapshot {
  version: typeof WORLD_EMERGENCE_VERSION;
  worldId: string;
  ruleVersion: string;
  epoch: number;
  direction: WorldDirection | null;
  publicAnchors: string[];
  truthShards: EmergentTruthShard[];
  checksum: string;
}

export const worldSnapshotSchema = z.object({
  version: z.literal(WORLD_EMERGENCE_VERSION),
  worldId: z.string().min(1).max(64),
  ruleVersion: z.string().min(1).max(64),
  epoch: z.number().int().positive(),
  direction: worldDirectionSchema.nullable(),
  publicAnchors: z.array(z.string().min(1).max(192)).max(256),
  truthShards: z.array(z.object({
    clueId: z.string().min(1).max(96),
    supportingEvents: z.array(z.string().min(1).max(192)).max(256),
    supportingGames: z.array(z.string().min(1).max(64)).max(64),
    independentParticipants: z.number().int().min(0),
    confidence: z.number().min(0).max(1),
    status: z.enum(["rumor", "confirmed"]),
  })).max(256),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export interface WorldMergeProposal {
  mergeId: string;
  protocolVersion: typeof WORLD_EMERGENCE_VERSION;
  leftWorldId: string;
  rightWorldId: string;
  targetEpoch: number;
  sharedAnchors: string[];
  sharedTruthShards: string[];
  conflicts: string[];
  status: "proposed" | "compatible" | "blocked";
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function checksumFor(snapshot: Omit<WorldSnapshot, "checksum">): string {
  return createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

export function makeWorldSnapshot(input: {
  worldId: string;
  ruleVersion: string;
  epoch: number;
  direction: WorldDirection | null;
  publicAnchors: string[];
  truthShards: EmergentTruthShard[];
}): WorldSnapshot {
  const base: Omit<WorldSnapshot, "checksum"> = {
    version: WORLD_EMERGENCE_VERSION,
    worldId: input.worldId,
    ruleVersion: input.ruleVersion,
    epoch: Math.max(1, Math.floor(input.epoch)),
    direction: input.direction,
    publicAnchors: unique(input.publicAnchors).sort(),
    truthShards: [...input.truthShards].sort((a, b) => a.clueId.localeCompare(b.clueId)),
  };
  return { ...base, checksum: checksumFor(base) };
}

/**
 * 聚合一个世界纪元。
 *
 * 规则：
 * - eventId、contributionKey、participantRef 三层去重；
 * - 每位参与者在同一游戏中的贡献只保留第一条；
 * - 少于 3 名独立参与者时不改写世界方向；
 * - 真相碎片至少需要 3 个不同参与者、2 个不同游戏的公开证据；
 * - 平票时保持上一纪元方向，避免世界因随机排序抖动。
 */
export function aggregateWorldEpoch(
  contributions: readonly WorldContribution[],
  previous?: Pick<WorldEpochSnapshot, "direction" | "publicAnchors" | "truthShards">,
): WorldEpochSnapshot {
  const seenEvents = new Set<string>();
  const seenContributionKeys = new Set<string>();
  const seenParticipantGames = new Set<string>();
  const accepted: WorldContribution[] = [];

  for (const raw of contributions) {
    const parsed = worldContributionSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const participantGame = `${item.participantRef}:${item.gameId}`;
    if (
      seenEvents.has(item.eventId) ||
      seenContributionKeys.has(item.contributionKey) ||
      seenParticipantGames.has(participantGame)
    ) continue;
    seenEvents.add(item.eventId);
    seenContributionKeys.add(item.contributionKey);
    seenParticipantGames.add(participantGame);
    accepted.push(item);
  }

  const worldId = accepted[0]?.worldId ?? "tdg-world";
  const epoch = accepted[0]?.epoch ?? 1;
  const participants = new Set(accepted.map((item) => item.participantRef));
  const byDirection = new Map<WorldDirection, { score: number; contributions: number; participants: Set<string> }>();
  for (const direction of WORLD_DIRECTIONS) {
    byDirection.set(direction, { score: 0, contributions: 0, participants: new Set() });
  }
  for (const item of accepted) {
    const tally = byDirection.get(item.direction)!;
    tally.score += item.weight;
    tally.contributions += 1;
    tally.participants.add(item.participantRef);
  }

  const totalScore = [...byDirection.values()].reduce((sum, tally) => sum + tally.score, 0);
  const directionTallies: DirectionTally[] = WORLD_DIRECTIONS.map((direction) => {
    const tally = byDirection.get(direction)!;
    return {
      direction,
      score: tally.score,
      contributions: tally.contributions,
      participants: tally.participants.size,
      share: totalScore === 0 ? 0 : tally.score / totalScore,
    };
  });
  const ordered = [...directionTallies].sort((a, b) =>
    b.score - a.score || b.participants - a.participants || a.direction.localeCompare(b.direction),
  );
  const top = ordered[0];
  const second = ordered[1];
  const hasQuorum = participants.size >= 3;
  const isTie = top.score > 0 && second.score === top.score && second.participants === top.participants;
  const direction = hasQuorum && !isTie && top.score > 0 ? top.direction : previous?.direction ?? null;

  const clueGroups = new Map<string, { events: Set<string>; games: Set<string>; participants: Set<string> }>();
  for (const item of accepted) {
    if (!item.clueId || item.evidenceRefs.length === 0) continue;
    const group = clueGroups.get(item.clueId) ?? { events: new Set(), games: new Set(), participants: new Set() };
    group.events.add(item.eventId);
    group.games.add(item.gameId);
    group.participants.add(item.participantRef);
    clueGroups.set(item.clueId, group);
  }
  const truthShards: EmergentTruthShard[] = [...clueGroups.entries()].map(([clueId, group]) => {
    const independentParticipants = group.participants.size;
    const confidence = clamp01(
      0.25 * Math.min(1, group.events.size / 4) +
      0.35 * Math.min(1, group.games.size / 2) +
      0.4 * Math.min(1, independentParticipants / 3),
    );
    return {
      clueId,
      supportingEvents: [...group.events].sort(),
      supportingGames: [...group.games].sort(),
      independentParticipants,
      confidence,
      status: independentParticipants >= 3 && group.games.size >= 2 ? "confirmed" : "rumor",
    };
  });

  return {
    version: WORLD_EMERGENCE_VERSION,
    worldId,
    epoch,
    direction,
    directionTallies,
    contributionsAccepted: accepted.length,
    uniqueParticipants: participants.size,
    truthShards: [...(previous?.truthShards ?? []), ...truthShards]
      .reduce<EmergentTruthShard[]>((all, shard) => {
        const existing = all.find((item) => item.clueId === shard.clueId);
        if (!existing) return [...all, shard];
        return all.map((item) => item.clueId === shard.clueId ? {
          ...item,
          supportingEvents: unique([...item.supportingEvents, ...shard.supportingEvents]).sort(),
          supportingGames: unique([...item.supportingGames, ...shard.supportingGames]).sort(),
          independentParticipants: Math.max(item.independentParticipants, shard.independentParticipants),
          confidence: Math.max(item.confidence, shard.confidence),
          status: item.status === "confirmed" || shard.status === "confirmed" ? "confirmed" : "rumor",
        } : item);
      }, [])
      .sort((a, b) => a.clueId.localeCompare(b.clueId)),
    publicAnchors: unique([...(previous?.publicAnchors ?? []), ...(direction ? [`direction:${direction}`] : [])]).sort(),
  };
}

export function proposeWorldMerge(left: WorldSnapshot, right: WorldSnapshot): WorldMergeProposal {
  const sharedAnchors = left.publicAnchors.filter((anchor) => right.publicAnchors.includes(anchor)).sort();
  const sharedTruthShards = left.truthShards
    .filter((leftShard) => right.truthShards.some((rightShard) => rightShard.clueId === leftShard.clueId))
    .map((shard) => shard.clueId)
    .sort();
  const conflicts: string[] = [];
  if (left.version !== right.version) conflicts.push("emergence-version-mismatch");
  if (left.ruleVersion !== right.ruleVersion) conflicts.push("rule-version-mismatch");
  if (left.direction && right.direction && left.direction !== right.direction) {
    conflicts.push("direction-conflict");
  }
  const compatible = conflicts.length === 0 && sharedAnchors.length > 0;
  return {
    mergeId: `merge-${createHash("sha256").update(`${left.checksum}:${right.checksum}`).digest("hex").slice(0, 16)}`,
    protocolVersion: WORLD_EMERGENCE_VERSION,
    leftWorldId: left.worldId,
    rightWorldId: right.worldId,
    targetEpoch: Math.max(left.epoch, right.epoch) + 1,
    sharedAnchors,
    sharedTruthShards,
    conflicts,
    status: compatible ? "compatible" : conflicts.length ? "blocked" : "proposed",
  };
}

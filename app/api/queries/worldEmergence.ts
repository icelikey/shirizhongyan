import { desc, eq, and } from "drizzle-orm";
import { worldContributions, worldEpochs } from "@db/schema";
import {
  aggregateWorldEpoch,
  makeWorldSnapshot,
  type WorldContribution,
  type WorldDirection,
  type WorldEpochSnapshot,
} from "@contracts/worldEmergence";
import type { GameDefinition } from "@contracts/gameSdk";
import type { SeatState } from "../games/sdk/runtime";
import { getDb } from "./connection";

const RULE_VERSION = "tdg-wp-0.1";
const DEFAULT_WORLD_ID = "tdg-world";

type JsonColumn = unknown;

function parseJson<T>(value: JsonColumn): T | null {
  if (typeof value !== "string") return (value as T) ?? null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function duplicateKey(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062;
}

function worldId(): string {
  return process.env.TDG_WORLD_ID?.trim() || DEFAULT_WORLD_ID;
}

function currentEpoch(): number {
  const configured = Number(process.env.TDG_WORLD_EPOCH);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return Math.floor(Date.now() / 86_400_000) + 1;
}

/**
 * 游戏语义到世界方向的固定映射。
 * Agent 可以影响对局动作，但不能临时修改这张映射或贡献权重。
 */
function directionFor(def: GameDefinition, rank: number): WorldDirection {
  if (def.template === "numberGuess") return "law";
  if (def.template === "pollDuel") return "voice";
  if (def.template === "pirateGold") return rank === 0 ? "trust" : "rupture";
  return "memory";
}

function contributionFor(params: {
  def: GameDefinition;
  matchLogId: number;
  seat: SeatState;
  rank: number;
}): WorldContribution {
  const participantRef = params.seat.kind === "external-agent"
    ? `agent:${params.seat.agentKeyId ?? params.seat.index}`
    : `human:${params.seat.userId ?? params.seat.index}`;
  const participantKind = params.seat.kind === "external-agent" ? "agent" : "human";
  const eventId = `match-${params.matchLogId}:world:${params.seat.index}`;
  return {
    eventId,
    contributionKey: eventId,
    worldId: worldId(),
    epoch: currentEpoch(),
    participantRef,
    participantKind,
    gameId: params.def.id,
    direction: directionFor(params.def, params.rank),
    weight: params.rank === 0 ? 2 : 1,
    evidenceRefs: [`match-${params.matchLogId}`],
    clueId: null,
    committedAt: new Date().toISOString(),
  };
}

async function persistEpoch(world: string, epoch: number) {
  const rows = await getDb()
    .select()
    .from(worldContributions)
    .where(and(eq(worldContributions.worldId, world), eq(worldContributions.epoch, epoch)));
  const contributions = rows
    .map((row): WorldContribution | null => {
      const evidenceRefs = parseJson<string[]>(row.evidenceRefs);
      if (!evidenceRefs) return null;
      return {
        eventId: row.eventId,
        contributionKey: row.contributionKey,
        worldId: row.worldId,
        epoch: row.epoch,
        participantRef: row.participantRef,
        participantKind: row.participantKind as WorldContribution["participantKind"],
        gameId: row.gameId,
        direction: row.direction as WorldDirection,
        weight: row.weight,
        evidenceRefs,
        clueId: row.clueId,
        committedAt: new Date(row.committedAt).toISOString(),
      };
    })
    .filter((item): item is WorldContribution => item !== null);

  const previousRow = await getDb()
    .select()
    .from(worldEpochs)
    .where(eq(worldEpochs.worldId, world))
    .orderBy(desc(worldEpochs.epoch))
    .limit(1);
  const previous = previousRow[0]
    ? parseJson<WorldEpochSnapshot>(previousRow[0].snapshotJson)
    : null;
  const aggregate = aggregateWorldEpoch(contributions, previous ?? undefined);
  const publicSnapshot = makeWorldSnapshot({
    worldId: world,
    ruleVersion: RULE_VERSION,
    epoch,
    direction: aggregate.direction,
    publicAnchors: aggregate.publicAnchors,
    truthShards: aggregate.truthShards,
  });
  const snapshotJson = { ...aggregate, checksum: publicSnapshot.checksum };

  if (previousRow[0]?.epoch === epoch) {
    await getDb()
      .update(worldEpochs)
      .set({
        ruleVersion: RULE_VERSION,
        direction: aggregate.direction,
        snapshotJson: snapshotJson as never,
        checksum: publicSnapshot.checksum,
      })
      .where(eq(worldEpochs.id, previousRow[0].id));
  } else {
    await getDb().insert(worldEpochs).values({
      worldId: world,
      epoch,
      ruleVersion: RULE_VERSION,
      direction: aggregate.direction,
      snapshotJson: snapshotJson as never,
      checksum: publicSnapshot.checksum,
    });
  }
  return { aggregate, publicSnapshot };
}

/** 对局终局后调用：写公开贡献，再重算当前世界纪元。 */
export async function recordMatchWorldContributions(params: {
  def: GameDefinition;
  matchLogId: number;
  seats: (SeatState | null)[];
  rankings: number[];
}) {
  const world = worldId();
  const epoch = currentEpoch();
  for (const seat of params.seats) {
    if (!seat || seat.kind === "echo-bot") continue;
    const rank = params.rankings.indexOf(seat.index);
    const contribution = contributionFor({
      def: params.def,
      matchLogId: params.matchLogId,
      seat,
      rank: rank < 0 ? params.rankings.length : rank,
    });
    try {
      await getDb().insert(worldContributions).values({
        contributionKey: contribution.contributionKey,
        eventId: contribution.eventId,
        worldId: contribution.worldId,
        epoch: contribution.epoch,
        participantRef: contribution.participantRef,
        participantKind: contribution.participantKind,
        gameId: contribution.gameId,
        direction: contribution.direction,
        weight: contribution.weight,
        evidenceRefs: contribution.evidenceRefs as never,
        clueId: contribution.clueId,
        committedAt: new Date(contribution.committedAt),
      });
    } catch (error) {
      if (!duplicateKey(error)) throw error;
    }
  }
  return persistEpoch(world, epoch);
}

export async function getPublicWorldState(requestedWorldId?: string) {
  const world = requestedWorldId?.trim() || worldId();
  const rows = await getDb()
    .select()
    .from(worldEpochs)
    .where(eq(worldEpochs.worldId, world))
    .orderBy(desc(worldEpochs.epoch))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      worldId: world,
      ruleVersion: RULE_VERSION,
      epoch: 0,
      direction: null,
      directionTallies: [],
      contributionsAccepted: 0,
      uniqueParticipants: 0,
      truthShards: [],
      publicAnchors: [],
      checksum: null,
      status: "awaiting-first-settled-match",
    };
  }
  const snapshot = parseJson<WorldEpochSnapshot & { checksum?: string }>(row.snapshotJson);
  if (!snapshot) throw new Error("世界纪元快照损坏");
  return {
    ...snapshot,
    ruleVersion: row.ruleVersion,
    checksum: row.checksum,
    status: "live-aggregated-world",
  };
}

/** 将数据库中的公开纪元重新规范化为可跨服务器交换的快照。 */
export async function getPublicWorldSnapshot(requestedWorldId?: string) {
  const world = requestedWorldId?.trim() || worldId();
  const rows = await getDb()
    .select()
    .from(worldEpochs)
    .where(eq(worldEpochs.worldId, world))
    .orderBy(desc(worldEpochs.epoch))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const snapshot = parseJson<WorldEpochSnapshot>(row.snapshotJson);
  if (!snapshot) throw new Error("世界纪元快照损坏");
  return makeWorldSnapshot({
    worldId: world,
    ruleVersion: row.ruleVersion,
    epoch: row.epoch,
    direction: snapshot.direction,
    publicAnchors: snapshot.publicAnchors,
    truthShards: snapshot.truthShards,
  });
}

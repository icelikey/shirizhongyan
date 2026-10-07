import { desc, eq, and, lt } from "drizzle-orm";
import { worldContributions, worldEpochs } from "@db/schema";
import {
  aggregateWorldEpoch,
  makeWorldSnapshot,
  type WorldContribution,
  type WorldDirection,
  type WorldEpochSnapshot,
} from "@contracts/worldEmergence";
import type { GameDefinition } from "@contracts/gameSdk";
import { mapperIdForTemplate } from "@contracts/worldContributionMapper";
import type { MatchSettledWorldEvent, WorldSeatProjection } from "@contracts/worldOutbox";
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
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    const candidate = current as { code?: string; errno?: number; message?: string; cause?: unknown };
    if (
      candidate.code === "ER_DUP_ENTRY" ||
      candidate.errno === 1062 ||
      candidate.message?.includes("Duplicate entry") ||
      candidate.message?.includes("ER_DUP_ENTRY")
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export function getWorldId(): string {
  return process.env.TDG_WORLD_ID?.trim() || DEFAULT_WORLD_ID;
}

export function getWorldEpoch(): number {
  const configured = Number(process.env.TDG_WORLD_EPOCH);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return Math.floor(Date.now() / 86_400_000) + 1;
}

/**
 * 游戏语义到世界方向的固定映射。
 * Agent 可以影响对局动作，但不能临时修改这张映射或贡献权重。
 */
function directionFor(def: GameDefinition, mapperId: string, rank: number): WorldDirection {
  switch (mapperId) {
    case "number-guess/v1": return "law";
    case "poll-duel/v1": return "voice";
    case "pirate-gold/v1": return rank === 0 ? "trust" : "rupture";
    case "fly-tease/v1":
    case "superpower-billiards/v1": return "memory";
    case "beast-race/v1": return rank === 0 ? "trust" : "law";
    case "werewolf/v1": return "voice";
    case "spire/v1": return "memory";
    default:
      // 未声明的旧/UGC 定义按模板 v1 兼容映射，不能让未知字符串决定方向。
      if (def.template === "numberGuess") return "law";
      if (def.template === "pollDuel") return "voice";
      if (def.template === "pirateGold") return rank === 0 ? "trust" : "rupture";
      return "memory";
  }
}

function contributionFor(params: {
  def: GameDefinition;
  matchLogId: number;
  seat: Pick<SeatState, "index" | "kind" | "userId" | "agentKeyId"> | WorldSeatProjection;
  rank: number;
  mapperId: string;
  worldId: string;
  epoch: number;
  committedAt: string;
}): WorldContribution {
  const participantRef = params.seat.kind === "external-agent"
    ? `agent:${params.seat.agentKeyId ?? params.seat.index}`
    : `human:${params.seat.userId ?? params.seat.index}`;
  const participantKind = params.seat.kind === "external-agent" ? "agent" : "human";
  const eventId = `match-${params.matchLogId}:world:${params.seat.index}`;
  return {
    eventId,
    contributionKey: eventId,
    worldId: params.worldId,
    epoch: params.epoch,
    participantRef,
    participantKind,
    gameId: params.def.id,
    direction: directionFor(params.def, params.mapperId, params.rank),
    weight: params.rank === 0 ? 2 : 1,
    evidenceRefs: [`match-${params.matchLogId}`],
    clueId: null,
    committedAt: params.committedAt,
  };
}

/**
 * 将一局已结算的公开座位投影映射为世界贡献。
 * 这是 GamePackage 与世界层之间唯一的语义边界，Worker 只执行这里的版本。
 */
export function mapMatchWorldContributions(params: {
  def: GameDefinition;
  matchLogId: number;
  seats: (Pick<SeatState, "index" | "kind" | "userId" | "agentKeyId"> | WorldSeatProjection | null)[];
  rankings: number[];
  mapperId?: string;
  worldId?: string;
  epoch?: number;
  committedAt?: string;
}): WorldContribution[] {
  const mapperId = params.mapperId ?? params.def.worldContributionMapperId ?? mapperIdForTemplate(params.def.template);
  const world = params.worldId ?? getWorldId();
  const epoch = params.epoch ?? getWorldEpoch();
  const committedAt = params.committedAt ?? new Date().toISOString();
  const playableSeats = params.seats.filter(
    (seat): seat is WorldSeatProjection => seat !== null && seat.kind !== "echo-bot",
  );
  return playableSeats
    .map((seat) => {
      const rank = params.rankings.indexOf(seat.index);
      return contributionFor({
        def: params.def,
        matchLogId: params.matchLogId,
        seat,
        rank: rank < 0 ? params.rankings.length : rank,
        mapperId,
        worldId: world,
        epoch,
        committedAt,
      });
    });
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

  const [currentRows, previousRows] = await Promise.all([
    getDb()
      .select()
      .from(worldEpochs)
      .where(and(eq(worldEpochs.worldId, world), eq(worldEpochs.epoch, epoch)))
      .limit(1),
    getDb()
      .select()
      .from(worldEpochs)
      .where(and(eq(worldEpochs.worldId, world), lt(worldEpochs.epoch, epoch)))
      .orderBy(desc(worldEpochs.epoch))
      .limit(1),
  ]);
  const currentRow = currentRows[0];
  const previous = previousRows[0]
    ? parseJson<WorldEpochSnapshot>(previousRows[0].snapshotJson)
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

  if (currentRow) {
    await getDb()
      .update(worldEpochs)
      .set({
        ruleVersion: RULE_VERSION,
        direction: aggregate.direction,
        snapshotJson: snapshotJson as never,
        checksum: publicSnapshot.checksum,
      })
      .where(eq(worldEpochs.id, currentRow.id));
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
  const world = getWorldId();
  const epoch = getWorldEpoch();
  const contributions = mapMatchWorldContributions(params);
  for (const contribution of contributions) {
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

/** Worker 的幂等投影：重复执行只会命中唯一键，然后重算同一纪元。 */
export async function projectSettledMatchWorldEvent(
  event: MatchSettledWorldEvent,
  def: GameDefinition,
) {
  const contributions = mapMatchWorldContributions({
    def,
    matchLogId: event.matchLogId,
    seats: event.seats,
    rankings: event.rankings,
    mapperId: event.mapperId,
    worldId: event.worldId,
    epoch: event.epoch,
    committedAt: event.settledAt,
  });
  for (const contribution of contributions) {
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
  return persistEpoch(event.worldId, event.epoch);
}

export async function getPublicWorldState(requestedWorldId?: string) {
  const world = requestedWorldId?.trim() || getWorldId();
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
  const world = requestedWorldId?.trim() || getWorldId();
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

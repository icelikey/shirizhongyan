/**
 * 对局事件流落库（api/queries/matchLogs.ts）
 *
 * match_logs 是回放 / 观战 / 彩蛋判定 / 情报卡统计的唯一来源。
 * 在此之前该表只有 Drizzle 定义而无任何查询层，事件流无处可落。
 *
 * 【出库纪律】按座位取事件流时必须经 projectEvents 投影，剥掉密态事件。
 * 本文件的 findEnvelopeForViewer 是唯一的出库通道——不要绕过它直接读
 * payloadJson，否则就是信息泄漏。
 */
import { desc, eq } from "drizzle-orm";
import { matchLogs } from "@db/schema";
import {
  projectEvents,
  MATCH_LOG_VERSION,
  SPECTATOR,
  type MatchEvent,
  type MatchLogEnvelope,
} from "@contracts/matchLog";
import { getDb } from "./connection";

/** 落一局完整事件流，返回自增 id（判例需引用它） */
export async function insertMatchLog(params: {
  roomCode: string;
  rulebookId: string;
  seed: string;
  events: MatchEvent[];
  startedAt: number;
  endedAt: number | null;
  winnerSeat: number | null;
}): Promise<number> {
  const envelope: MatchLogEnvelope = {
    version: MATCH_LOG_VERSION,
    rulebookId: params.rulebookId,
    seed: params.seed,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    events: params.events,
  };

  const [res] = await getDb()
    .insert(matchLogs)
    .values({
      roomCode: params.roomCode,
      rulebookId: params.rulebookId,
      seed: params.seed,
      payloadJson: envelope as never,
      winnerSeat: params.winnerSeat,
      eventCount: params.events.length,
      startedAt: new Date(params.startedAt),
      endedAt: params.endedAt ? new Date(params.endedAt) : null,
    })
    .$returningId();

  return res.id;
}

export async function findMatchLogById(id: number) {
  return getDb().query.matchLogs.findFirst({ where: eq(matchLogs.id, id) });
}

/** 按房间取最近若干局（观战列表 / 回放入口） */
export async function findRecentMatchLogsByRoom(roomCode: string, limit = 10) {
  return getDb()
    .select()
    .from(matchLogs)
    .where(eq(matchLogs.roomCode, roomCode))
    .orderBy(desc(matchLogs.startedAt))
    .limit(limit);
}

/** 全站最近若干局（天梯 / 观战大厅） */
export async function findRecentMatchLogs(limit = 20) {
  return getDb()
    .select()
    .from(matchLogs)
    .orderBy(desc(matchLogs.startedAt))
    .limit(limit);
}

/**
 * 取某局事件流并按 viewer 投影——唯一的出库通道。
 *
 * viewer 为 SPECTATOR 时返回全量（观战页为全知视角，对局已结束，
 * 无泄漏风险）；为座位号时剥掉所有密态事件，仅保留该座位自己的身份。
 */
export async function findEnvelopeForViewer(
  id: number,
  viewer: number | typeof SPECTATOR,
): Promise<MatchLogEnvelope | null> {
  const row = await findMatchLogById(id);
  if (!row) return null;

  const envelope = row.payloadJson as unknown as MatchLogEnvelope;
  if (envelope?.version !== MATCH_LOG_VERSION) return null;

  return { ...envelope, events: projectEvents(envelope.events, viewer) };
}

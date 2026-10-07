import { and, asc, eq } from "drizzle-orm";
import { textWorldChapters } from "@db/schema";
import type { WorldEventRef } from "@contracts/aiNativeWorld";
import { getDb } from "./connection";

export interface PersistTextWorldChapterInput {
  chapterId: string;
  worldId: string;
  matchId: string;
  matchLogId?: number | null;
  projection?: "text" | "graphic";
  anchor: WorldEventRef;
  title: string;
  body: string;
  evidence: readonly WorldEventRef[];
  status?: "fallback" | "generated";
}

function isDuplicate(error: unknown): boolean {
  const candidate = error as { code?: string; errno?: number };
  return candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062;
}

/**
 * 章节是事件流的只读投影：相同 chapterId 重放时返回已有行，不重复生成。
 * 这里不接受任何会改写比赛状态的字段，也不把模型输出当作结算输入。
 */
export async function insertTextWorldChapter(input: PersistTextWorldChapterInput) {
  const db = getDb();
  const projection = input.projection ?? "text";
  try {
    await db.insert(textWorldChapters).values({
      chapterId: input.chapterId,
      worldId: input.worldId,
      matchId: input.matchId,
      matchLogId: input.matchLogId ?? null,
      projection,
      eventSeq: input.anchor.eventSeq,
      stateHash: input.anchor.stateHash,
      rulebookVersion: input.anchor.rulebookVersion,
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 10000),
      evidenceJson: [...input.evidence] as never,
      status: input.status ?? "fallback",
    });
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
  return db.query.textWorldChapters.findFirst({
    where: eq(textWorldChapters.chapterId, input.chapterId),
  });
}

export async function listTextWorldChapters(params: {
  worldId: string;
  matchId: string;
  projection?: "text" | "graphic";
}) {
  const conditions = [
    eq(textWorldChapters.worldId, params.worldId),
    eq(textWorldChapters.matchId, params.matchId),
  ];
  if (params.projection) conditions.push(eq(textWorldChapters.projection, params.projection));
  return getDb()
    .select()
    .from(textWorldChapters)
    .where(and(...conditions))
    .orderBy(asc(textWorldChapters.eventSeq));
}

import { and, asc, eq } from "drizzle-orm";
import { textWorldChapters, type TextWorldChapterRow } from "@db/schema";
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

function cursorMatches(row: TextWorldChapterRow, input: PersistTextWorldChapterInput): boolean {
  return row.worldId === input.worldId
    && row.matchId === input.matchId
    && row.projection === (input.projection ?? "text")
    && row.eventSeq === input.anchor.eventSeq;
}

function shouldUpgrade(row: TextWorldChapterRow, input: PersistTextWorldChapterInput): boolean {
  return row.status === "fallback" && input.status === "generated";
}

async function findExistingChapter(input: PersistTextWorldChapterInput): Promise<TextWorldChapterRow | undefined> {
  const db = getDb();
  const byChapterId = await db.query.textWorldChapters.findFirst({
    where: eq(textWorldChapters.chapterId, input.chapterId),
  });
  if (byChapterId && !cursorMatches(byChapterId, input)) {
    throw new Error(`章节 ID 已绑定到不同事件：${input.chapterId}`);
  }
  if (byChapterId) return byChapterId;
  return db.query.textWorldChapters.findFirst({
    where: and(
      eq(textWorldChapters.worldId, input.worldId),
      eq(textWorldChapters.matchId, input.matchId),
      eq(textWorldChapters.projection, input.projection ?? "text"),
      eq(textWorldChapters.eventSeq, input.anchor.eventSeq),
    ),
  });
}

async function upgradeChapter(row: TextWorldChapterRow, input: PersistTextWorldChapterInput): Promise<void> {
  if (!shouldUpgrade(row, input)) return;
  await getDb()
    .update(textWorldChapters)
    .set({
      title: input.title.slice(0, 200),
      body: input.body.slice(0, 10000),
      evidenceJson: [...input.evidence] as never,
      status: "generated",
    })
    .where(eq(textWorldChapters.id, row.id));
}

/**
 * 章节是事件流的只读投影：相同 chapterId 重放时返回已有行，不重复生成。
 * 这里不接受任何会改写比赛状态的字段，也不把模型输出当作结算输入。
 */
export async function insertTextWorldChapter(input: PersistTextWorldChapterInput) {
  const db = getDb();
  const projection = input.projection ?? "text";
  const existing = await findExistingChapter(input);
  if (existing) {
    await upgradeChapter(existing, input);
    return db.query.textWorldChapters.findFirst({
      where: eq(textWorldChapters.id, existing.id),
    });
  }

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
    // 并发写入可能在初次查询之后才完成；再次按两个唯一身份查询，
    // 确保 cursor 唯一键冲突时也能返回已有章节，而不是静默丢失投影。
    const concurrent = await findExistingChapter(input);
    if (!concurrent) {
      throw new Error(`章节投影唯一键冲突但找不到已存在章节：${input.chapterId}`, { cause: error });
    }
    await upgradeChapter(concurrent, input);
  }
  return db.query.textWorldChapters.findFirst({
    where: and(
      eq(textWorldChapters.worldId, input.worldId),
      eq(textWorldChapters.matchId, input.matchId),
      eq(textWorldChapters.projection, projection),
      eq(textWorldChapters.eventSeq, input.anchor.eventSeq),
    ),
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

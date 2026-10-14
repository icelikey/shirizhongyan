import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("./connection", () => ({ getDb }));

import { insertTextWorldChapter } from "./textWorldChapters";

const input = (overrides: Record<string, unknown> = {}) => ({
  chapterId: "chapter:one",
  worldId: "world-1",
  matchId: "match-1",
  projection: "text" as const,
  anchor: {
    worldId: "world-1",
    cycle: 1,
    matchId: "match-1",
    eventSeq: 7,
    eventType: "matchEnd",
    stateHash: "a".repeat(64),
    rulebookVersion: "v1.0.0",
    visibility: "public" as const,
  },
  title: "终局记录",
  body: "fallback 战报",
  evidence: [],
  status: "fallback" as const,
  ...overrides,
});

function makeRow(values: Record<string, unknown> = {}) {
  return {
    id: 1,
    chapterId: "chapter:one",
    worldId: "world-1",
    matchId: "match-1",
    matchLogId: 1,
    projection: "text",
    eventSeq: 7,
    stateHash: "a".repeat(64),
    rulebookVersion: "v1.0.0",
    title: "终局记录",
    body: "fallback 战报",
    evidenceJson: [],
    status: "fallback",
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
    ...values,
  };
}

function setupDb(options: { existing?: Record<string, unknown>; duplicateOnInsert?: boolean } = {}) {
  let row = options.existing ? makeRow(options.existing) : undefined;
  const findFirst = vi.fn(async () => row);
  const updateWhere = vi.fn(async () => undefined);
  const updateSet = vi.fn((patch: Record<string, unknown>) => ({
    where: vi.fn(async () => {
      row = row ? { ...row, ...patch } : row;
      await updateWhere();
    }),
  }));
  const insertValues = vi.fn(async (values: Record<string, unknown>) => {
    if (options.duplicateOnInsert) {
      const error = Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY", errno: 1062 });
      throw error;
    }
    row = makeRow(values);
  });
  const db = {
    query: { textWorldChapters: { findFirst } },
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: updateSet })),
  };
  getDb.mockReturnValue(db);
  return { db, findFirst, insertValues, updateSet, getRow: () => row };
}

describe("文字世界章节投影幂等性", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("相同 chapterId 重放时返回已有章节，不重复插入", async () => {
    const db = setupDb();
    const first = await insertTextWorldChapter(input());
    const second = await insertTextWorldChapter(input());

    expect(first?.chapterId).toBe("chapter:one");
    expect(second?.id).toBe(1);
    expect(db.insertValues).toHaveBeenCalledTimes(1);
  });

  it("不同 chapterId 但相同投影游标时复用已有章节", async () => {
    const existing = makeRow();
    const db = setupDb({ existing });
    db.findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(existing)
      .mockResolvedValue(existing);

    const result = await insertTextWorldChapter(input({ chapterId: "chapter:renamed" }));

    expect(result?.id).toBe(existing.id);
    expect(db.insertValues).not.toHaveBeenCalled();
  });

  it("允许 fallback 升级为 generated，但不覆盖已生成章节", async () => {
    const fallbackDb = setupDb({ existing: makeRow({ status: "fallback" }) });
    const upgraded = await insertTextWorldChapter(input({ status: "generated", body: "真实战报" }));
    expect(upgraded?.status).toBe("generated");
    expect(fallbackDb.updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "generated" }));

    const generatedDb = setupDb({ existing: makeRow({ status: "generated", body: "已发布战报" }) });
    const preserved = await insertTextWorldChapter(input({ body: "旧 fallback" }));
    expect(preserved?.body).toBe("已发布战报");
    expect(generatedDb.updateSet).not.toHaveBeenCalled();
  });

  it("并发插入发生游标唯一键冲突时重新定位已有章节", async () => {
    const existing = makeRow();
    const db = setupDb({ existing, duplicateOnInsert: true });
    db.findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(existing)
      .mockResolvedValue(existing);

    const result = await insertTextWorldChapter(input({ chapterId: "chapter:concurrent" }));

    expect(result?.id).toBe(existing.id);
    expect(db.insertValues).toHaveBeenCalledTimes(1);
  });
});

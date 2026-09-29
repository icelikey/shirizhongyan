import { createHash } from "node:crypto";
import { asc, eq, and, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { commandReceipts, worldOutbox } from "@db/schema";
import { getDb } from "./connection";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

/** Gateway 去重摘要只覆盖客户端可变的命令内容，不把 commandId 自身算入 hash。 */
export function commandPayloadHash(payload: {
  contextRef?: string;
  bindingId?: string;
  action: unknown;
}): string {
  return createHash("sha256").update(canonicalize(payload)).digest("hex");
}

export function commandPayloadForHash(input: {
  contextRef?: string;
  bindingId?: string;
  action: unknown;
}): { contextRef?: string; bindingId?: string; action: unknown } {
  return {
    ...(input.contextRef === undefined ? {} : { contextRef: input.contextRef }),
    ...(input.bindingId === undefined ? {} : { bindingId: input.bindingId }),
    action: input.action,
  };
}

export async function findCommandReceipt(agentKeyId: number, commandId: string) {
  return getDb().query.commandReceipts.findFirst({
    where: and(
      eq(commandReceipts.agentKeyId, agentKeyId),
      eq(commandReceipts.commandId, commandId),
    ),
  });
}

/**
 * 先读后以唯一键抢占收据。并发请求发生唯一键冲突时重新读取，
 * 由调用方根据 payloadHash 决定重放、等待还是返回冲突。
 */
export async function reserveCommandReceipt(input: {
  agentKeyId: number;
  commandId: string;
  scopeId: string;
  bindingId?: string;
  contextRef?: string;
  payloadHash: string;
}) {
  const existing = await findCommandReceipt(input.agentKeyId, input.commandId);
  if (existing) return { receipt: existing, created: false };

  let created = true;
  try {
    await getDb().insert(commandReceipts).values({
      agentKeyId: input.agentKeyId,
      commandId: input.commandId,
      scopeId: input.scopeId,
      bindingId: input.bindingId,
      contextRef: input.contextRef,
      payloadHash: input.payloadHash,
      status: "pending",
    });
  } catch (error) {
    const duplicate = error as { code?: string; errno?: number };
    if (duplicate.code !== "ER_DUP_ENTRY" && duplicate.errno !== 1062) throw error;
    created = false;
  }

  const receipt = await findCommandReceipt(input.agentKeyId, input.commandId);
  if (!receipt) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "命令收据写入后无法读取",
    });
  }
  return { receipt, created };
}

function isDuplicateKey(error: unknown): boolean {
  const duplicate = error as { code?: string; errno?: number };
  return duplicate.code === "ER_DUP_ENTRY" || duplicate.errno === 1062;
}

/**
 * 先写 outbox，再将收据置为 committed。两者没有和内存房间 actor 的跨层
 * 事务；若进程在中间退出，收据保持 pending，调用方不会错误声称已提交。
 */
export async function completeCommandReceipt(input: {
  receiptId: number;
  commandId: string;
  scopeId: string;
  response: JsonValue;
  eventPayload: JsonValue;
}) {
  const eventId = `command-receipt-${input.receiptId}`;
  try {
    await getDb().insert(worldOutbox).values({
      eventId,
      scopeId: input.scopeId,
      aggregateId: input.scopeId,
      eventType: "world.command.committed",
      commandId: input.commandId,
      payloadJson: input.eventPayload,
      status: "pending",
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }

  await getDb()
    .update(commandReceipts)
    .set({
      status: "committed",
      responseJson: input.response,
      errorCode: null,
      errorMessage: null,
      completedAt: new Date(),
    })
    .where(eq(commandReceipts.id, input.receiptId));
}

export async function rejectCommandReceipt(input: {
  receiptId: number;
  errorCode: string;
  errorMessage: string;
}) {
  await getDb()
    .update(commandReceipts)
    .set({
      status: "rejected",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      completedAt: new Date(),
    })
    .where(eq(commandReceipts.id, input.receiptId));
}

/**
 * 领取一批世界事件。
 *
 * `processing + leaseUntil` 让进程崩溃后事件可以自动回收；真正的幂等边界
 * 仍然是 eventId/contributionKey 的唯一键，租约只负责降低重复执行概率。
 */
export async function claimWorldOutboxBatch(input: {
  workerId: string;
  limit?: number;
  leaseMs?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const leaseSeconds = Math.max(1, Math.ceil(Math.max(1_000, input.leaseMs ?? 30_000) / 1_000));
  const leaseUntil = new Date(now.getTime() + leaseSeconds * 1_000);
  const due = or(
    and(
      or(eq(worldOutbox.status, "pending"), eq(worldOutbox.status, "failed")),
      sql`${worldOutbox.availableAt} <= NOW()`,
    ),
    and(
      eq(worldOutbox.status, "processing"),
      sql`(${worldOutbox.leaseUntil} IS NULL OR ${worldOutbox.leaseUntil} <= NOW())`,
    ),
  );
  const candidates = await getDb()
    .select()
    .from(worldOutbox)
    .where(due)
    .orderBy(asc(worldOutbox.availableAt), asc(worldOutbox.id))
    .limit(Math.max(1, Math.min(100, input.limit ?? 20)));

  const claimed = [];
  for (const candidate of candidates) {
    const result = await getDb()
      .update(worldOutbox)
      .set({
        status: "processing",
        workerId: input.workerId,
        // 用数据库时钟写租约，避免 Node 进程与 MySQL 时区配置不一致。
        leaseUntil: sql`DATE_ADD(NOW(), INTERVAL ${leaseSeconds} SECOND)`,
        attempts: sql`${worldOutbox.attempts} + 1`,
      })
      .where(and(eq(worldOutbox.id, candidate.id), due));
    const resultHeader = Array.isArray(result) ? result[0] : result;
    const affectedRows = Number((resultHeader as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
    if (affectedRows !== 1) continue;
    claimed.push({
      ...candidate,
      status: "processing" as const,
      workerId: input.workerId,
      leaseUntil,
      attempts: candidate.attempts + 1,
    });
  }
  return claimed;
}

export async function markWorldOutboxPublished(input: {
  id: number;
  workerId: string;
  publishedAt?: Date;
}) {
  await getDb()
    .update(worldOutbox)
    .set({
      status: "published",
      workerId: null,
      leaseUntil: null,
      publishedAt: input.publishedAt ? input.publishedAt : sql`NOW()`,
      lastError: null,
    })
    .where(
      and(
        eq(worldOutbox.id, input.id),
        eq(worldOutbox.status, "processing"),
        eq(worldOutbox.workerId, input.workerId),
      ),
    );
}

export function worldOutboxRetryDelayMs(attempts: number): number {
  const safeAttempts = Math.max(1, Math.min(10, Math.floor(attempts)));
  return Math.min(15 * 60_000, 1_000 * 2 ** (safeAttempts - 1));
}

export async function markWorldOutboxFailed(input: {
  id: number;
  workerId: string;
  attempts: number;
  errorMessage: string;
  now?: Date;
}) {
  const delaySeconds = Math.ceil(worldOutboxRetryDelayMs(input.attempts) / 1_000);
  await getDb()
    .update(worldOutbox)
    .set({
      status: "failed",
      workerId: null,
      leaseUntil: null,
      availableAt: sql`DATE_ADD(NOW(), INTERVAL ${delaySeconds} SECOND)`,
      lastError: input.errorMessage.slice(0, 4000),
    })
    .where(
      and(
        eq(worldOutbox.id, input.id),
        eq(worldOutbox.status, "processing"),
        eq(worldOutbox.workerId, input.workerId),
      ),
    );
}

import { createHash } from "node:crypto";
import { asc, eq, and } from "drizzle-orm";
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

/** 最小 outbox 消费接口；消费者应以 eventId 做自身幂等键。 */
export async function findPendingWorldOutbox(limit = 50) {
  return getDb()
    .select()
    .from(worldOutbox)
    .where(eq(worldOutbox.status, "pending"))
    .orderBy(asc(worldOutbox.availableAt), asc(worldOutbox.id))
    .limit(limit);
}

export async function markWorldOutboxPublished(id: number) {
  await getDb()
    .update(worldOutbox)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(worldOutbox.id, id));
}

export async function markWorldOutboxFailed(id: number, errorMessage: string) {
  await getDb()
    .update(worldOutbox)
    .set({ status: "failed", attempts: 1, lastError: errorMessage })
    .where(eq(worldOutbox.id, id));
}

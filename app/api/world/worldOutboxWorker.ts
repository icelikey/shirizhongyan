/**
 * 世界 Outbox Worker。
 *
 * 这里只消费已经由确定性游戏内核提交的事件，不让 LLM/JEV 参与胜负或
 * 贡献权重。Worker 可以重复执行：贡献表的唯一键和纪元重算共同提供幂等性。
 */
import { randomUUID } from "node:crypto";
import type { WorldOutboxRow } from "@db/schema";
import { matchSettledWorldEventSchema } from "@contracts/worldOutbox";
import { resolveDefinitionForWorldEvent } from "../games/sdk/registry";
import { projectSettledMatchWorldEvent } from "../queries/worldEmergence";
import {
  claimWorldOutboxBatch,
  markWorldOutboxFailed,
  markWorldOutboxPublished,
} from "../queries/commandReceipts";

type ClaimedOutboxRow = Pick<
  WorldOutboxRow,
  "id" | "eventId" | "eventType" | "payloadJson" | "attempts"
>;

export interface WorldOutboxWorkerOptions {
  workerId?: string;
  batchSize?: number;
  leaseMs?: number;
  pollMs?: number;
}

export interface WorldOutboxProcessDependencies {
  handle: (row: ClaimedOutboxRow) => Promise<void>;
  markPublished: (input: { id: number; workerId: string }) => Promise<void>;
  markFailed: (input: {
    id: number;
    workerId: string;
    attempts: number;
    errorMessage: string;
  }) => Promise<void>;
  workerId: string;
}

function parsePayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return JSON.parse(value) as unknown;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** 事件处理器单独导出，供 Worker 测试和未来多进程消费者复用。 */
export async function handleWorldOutboxRow(row: ClaimedOutboxRow): Promise<void> {
  if (row.eventType === "world.command.committed") {
    // 命令提交事件目前只作为审计流保留，命令结果已由 Gateway 完成。
    return;
  }
  if (row.eventType !== "world.match.settled") {
    throw new Error(`未知世界事件类型：${row.eventType}`);
  }
  const parsed = matchSettledWorldEventSchema.safeParse(parsePayload(row.payloadJson));
  if (!parsed.success) {
    throw new Error(`world.match.settled 载荷无效：${parsed.error.issues[0]?.message ?? "schema"}`);
  }
  const def = await resolveDefinitionForWorldEvent(parsed.data.defId, parsed.data.mapperId);
  if (!def) {
    throw new Error(
      `找不到历史游戏定义且 mapper 不可兼容：${parsed.data.defId} / ${parsed.data.mapperId}`,
    );
  }
  await projectSettledMatchWorldEvent(parsed.data, def);
}

/** 对一批已领取事件执行“成功发布 / 失败重试”的统一状态转换。 */
export async function processClaimedWorldOutboxRows(
  rows: readonly ClaimedOutboxRow[],
  deps: WorldOutboxProcessDependencies,
) {
  let published = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await deps.handle(row);
      await deps.markPublished({ id: row.id, workerId: deps.workerId });
      published += 1;
    } catch (error) {
      failed += 1;
      await deps.markFailed({
        id: row.id,
        workerId: deps.workerId,
        attempts: row.attempts,
        errorMessage: errorMessage(error),
      });
    }
  }
  return { claimed: rows.length, published, failed };
}

export async function runWorldOutboxOnce(options: WorldOutboxWorkerOptions = {}) {
  const workerId = options.workerId ?? `world-worker-${randomUUID()}`;
  const rows = await claimWorldOutboxBatch({
    workerId,
    limit: options.batchSize,
    leaseMs: options.leaseMs,
  });
  return processClaimedWorldOutboxRows(rows, {
    workerId,
    handle: handleWorldOutboxRow,
    markPublished: (input) => markWorldOutboxPublished(input),
    markFailed: (input) => markWorldOutboxFailed(input),
  });
}

/**
 * 在 API 进程内启动一个轻量消费者；云端多副本时由租约保证同一事件不会永久卡死。
 * 返回停止函数，测试/优雅退出时使用。
 */
export function startWorldOutboxWorker(options: WorldOutboxWorkerOptions = {}) {
  const workerId = options.workerId ?? `${process.env.HOSTNAME ?? "local"}-${randomUUID().slice(0, 8)}`;
  const pollMs = Math.max(250, options.pollMs ?? 1_000);
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    void runWorldOutboxOnce({ ...options, workerId }).catch((error) => {
      console.error(`[world-outbox:${workerId}] poll failed`, error);
    });
  };
  const timer = setInterval(tick, pollMs);
  timer.unref?.();
  tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

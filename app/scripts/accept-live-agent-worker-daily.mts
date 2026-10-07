/**
 * Agent Worker 每日三场暗局验收。
 *
 * 真实模式复用 scripts/tdg-agent-worker.mjs 的 runOnce 和 Gateway HTTP 协议；
 * 测试模式只需要注入 fetchImpl，因此不会写真实数据库或用户凭证。
 *
 * 运行：
 *   pnpm --dir app exec tsx scripts/accept-live-agent-worker-daily.mts
 *   pnpm --dir app exec tsx scripts/accept-live-agent-worker-daily.mts --help
 *
 * 真实模式所需环境变量：TDG_BASE_URL、TDG_AGENT_KEY、TDG_AGENT_ID。
 * 可选：TDG_AGENT_MEMORY、TDG_AGENT_GAME_ID、TDG_REPORT_WEBHOOK_URL、
 * TDG_DAILY_MAX_CYCLES。
 */
import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DAILY_REQUIRED = 3;
const DEFAULT_GAME_IDS = ["guess-mille-core", "guess-mille-core", "guess-mille-core"];
const DEFAULT_MAX_CYCLES = 900;

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;
type MemoryStoreLike = { hasEvent(eventId: string): boolean };

export type DailyWorkerAcceptanceOptions = {
  baseUrl: string;
  apiKey: string;
  agentId: number;
  fetchImpl?: FetchImpl;
  memoryPath?: string;
  gameIds?: readonly string[];
  maxCycles?: number;
  webhookUrl?: string;
};

type ReportStats = {
  darkMatches: number;
  matches: number;
  remainingDarkMatches: number;
  events: number;
  actions: number;
};

type ReportSnapshot = {
  reportDate: string;
  reportPresent: boolean;
  stats: ReportStats;
};

type DailyRunResult = {
  cycles: number;
  reportRequests: number;
  webhookPosts: number;
  report: ReportSnapshot;
};

export type DailyWorkerAcceptanceResult = {
  status: "passed" | "partial" | "failed";
  agentId: number;
  requiredDarkMatches: number;
  firstRun: DailyRunResult;
  repeatRun: DailyRunResult;
  duplicateRepeatRun: DailyRunResult;
  reportGeneratedWithoutWebhook: boolean;
  noDuplicateCount: boolean;
  noDuplicatePush: boolean | null;
  keyInOutput: boolean;
  capturedOutputLines: number;
  webhookVerification: "verified" | "not_configured";
};

function normalizeBaseUrl(raw: string): string {
  const url = new URL(raw);
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = /\/world\/v1$/i.test(pathname)
    ? pathname
    : `${pathname}/world/v1`.replace(/^\/+/, "/");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function inputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function numberOrZero(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

async function jsonResponse(response: Response): Promise<JsonRecord> {
  const text = await response.text();
  let payload: JsonRecord = {};
  try {
    payload = text ? JSON.parse(text) as JsonRecord : {};
  } catch {
    payload = { raw: text.slice(0, 400) };
  }
  if (!response.ok) {
    const error = payload.error as JsonRecord | undefined;
    throw new Error(String(error?.message ?? payload.message ?? `HTTP ${response.status}`));
  }
  return payload;
}

function reportSnapshot(payload: JsonRecord): ReportSnapshot {
  const report = (payload.report ?? {}) as JsonRecord;
  const stats = (report.stats ?? {}) as JsonRecord;
  return {
    reportDate: String(report.reportDate ?? new Date().toISOString().slice(0, 10)),
    reportPresent: Boolean(payload.report),
    stats: {
      darkMatches: numberOrZero(stats.darkMatches),
      matches: numberOrZero(stats.matches),
      remainingDarkMatches: numberOrZero(stats.remainingDarkMatches),
      events: numberOrZero(stats.events),
      actions: numberOrZero(stats.actions),
    },
  };
}

async function getReport(
  baseUrl: string,
  agentId: number,
  apiKey: string,
  fetchImpl: FetchImpl,
): Promise<ReportSnapshot> {
  const response = await fetchImpl(`${baseUrl}/agents/${agentId}/report`, {
    headers: { accept: "application/json", "x-api-key": apiKey },
  });
  return reportSnapshot(await jsonResponse(response));
}

function captureConsole<T>(run: () => Promise<T>): { promise: Promise<T>; lines: string[] } {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const capture = (...args: unknown[]) => {
    lines.push(args.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" "));
  };
  console.log = capture;
  console.error = capture;
  console.warn = capture;
  const promise = run().finally(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });
  return { promise, lines };
}

function workerConfig(baseUrl: string, apiKey: string, agentId: number) {
  return {
    baseUrl,
    key: apiKey,
    agentId,
    name: "daily-acceptance",
    roomCode: null,
    seatIndex: null,
  };
}

async function runDailyDarkMatches(
  options: DailyWorkerAcceptanceOptions & { memory: MemoryStoreLike },
  webhookUrl: string | undefined,
  fetchImpl: FetchImpl,
): Promise<DailyRunResult> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const gameIds = options.gameIds?.length ? [...options.gameIds] : DEFAULT_GAME_IDS;
  const maxCycles = Math.max(1, Math.floor(options.maxCycles ?? DEFAULT_MAX_CYCLES));
  const config = workerConfig(baseUrl, options.apiKey, options.agentId);
  const args: Record<string, unknown> = {
    persist: false,
    memory: options.memoryPath,
  };
  const { runOnce } = await import("../../scripts/tdg-agent-worker.mjs");
  let reportRequests = 0;
  let cycles = 0;
  const initialReport = await getReport(baseUrl, options.agentId, options.apiKey, fetchImpl);
  reportRequests += 1;
  let report = initialReport;

  while (report.stats.darkMatches < DAILY_REQUIRED) {
    cycles += 1;
    if (cycles > maxCycles) {
      throw new Error(`每日暗局未达到 ${DAILY_REQUIRED} 场：当前 ${report.stats.darkMatches} 场，已运行 ${maxCycles} 轮`);
    }
    const gameId = gameIds[Math.min(report.stats.darkMatches, gameIds.length - 1)];
    await runOnce({
      config,
      args: { ...args, game_id: gameId },
      fetchImpl,
      memory: options.memory,
      // 报告生成不依赖 Webhook；达到三场后由下面的单独步骤最多推送一次。
      webhookUrl: "",
    });
    report = await getReport(baseUrl, options.agentId, options.apiKey, fetchImpl);
    reportRequests += 1;
  }

  let webhookPosts = 0;
  const reportEventId = `daily-report:${report.reportDate}`;
  if (webhookUrl && !options.memory.hasEvent(reportEventId)) {
    await runOnce({
      config: workerConfig(baseUrl, options.apiKey, options.agentId),
      args: { ...args, create_match: "false" },
      fetchImpl,
      memory: options.memory,
      webhookUrl,
    });
    reportRequests += 1;
    webhookPosts = 1;
    report = await getReport(baseUrl, options.agentId, options.apiKey, fetchImpl);
    reportRequests += 1;
  }

  return { cycles, reportRequests, webhookPosts, report };
}

export async function runDailyWorkerAcceptance(
  options: DailyWorkerAcceptanceOptions,
): Promise<DailyWorkerAcceptanceResult> {
  if (!options.baseUrl || !options.apiKey || !Number.isInteger(options.agentId) || options.agentId <= 0) {
    throw new Error("每日暗局验收需要 baseUrl、apiKey 和正整数 agentId");
  }
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const originalFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const temporaryRoot = options.memoryPath ? null : await mkdtemp(join(tmpdir(), "tdg-daily-"));
  const memoryPath = options.memoryPath ?? join(temporaryRoot!, "agent-memory.json");
  const { MemoryStore } = await import("../../pi-tdg-agent/src/memory.mjs");
  const memory = new MemoryStore({ path: memoryPath });
  let webhookPosts = 0;
  const wrappedFetch: FetchImpl = async (input, init) => {
    const url = inputUrl(input);
    if (options.webhookUrl && url === options.webhookUrl && String(init?.method ?? "GET").toUpperCase() === "POST") {
      webhookPosts += 1;
    }
    return originalFetch(input, init);
  };
  const captured = captureConsole(async () => {
    const firstRun = await runDailyDarkMatches({ ...options, baseUrl, memoryPath, memory }, undefined, wrappedFetch);
    const repeatRun = await runDailyDarkMatches({ ...options, baseUrl, memoryPath, memory }, options.webhookUrl, wrappedFetch);
    const duplicateRepeatRun = await runDailyDarkMatches({ ...options, baseUrl, memoryPath, memory }, options.webhookUrl, wrappedFetch);
    const reportGeneratedWithoutWebhook = firstRun.report.reportPresent && firstRun.webhookPosts === 0 && firstRun.reportRequests >= 2;
    const noDuplicateCount = firstRun.report.stats.darkMatches === repeatRun.report.stats.darkMatches
      && repeatRun.report.stats.darkMatches === duplicateRepeatRun.report.stats.darkMatches
      && duplicateRepeatRun.report.stats.darkMatches === DAILY_REQUIRED;
    const noDuplicatePush = options.webhookUrl
      ? repeatRun.webhookPosts === 1 && duplicateRepeatRun.webhookPosts === 0 && webhookPosts === 1
      : null;
    const keyInOutput = captured.lines.some((line) => line.includes(options.apiKey));
    const complete = firstRun.report.stats.darkMatches === DAILY_REQUIRED
      && reportGeneratedWithoutWebhook
      && noDuplicateCount
      && noDuplicatePush !== false
      && !keyInOutput;
    return {
      status: complete && noDuplicatePush !== null ? "passed" : complete ? "partial" : "failed",
      agentId: options.agentId,
      requiredDarkMatches: DAILY_REQUIRED,
      firstRun,
      repeatRun,
      duplicateRepeatRun,
      reportGeneratedWithoutWebhook,
      noDuplicateCount,
      noDuplicatePush,
      keyInOutput,
      capturedOutputLines: captured.lines.length,
      webhookVerification: options.webhookUrl ? "verified" : "not_configured",
    };
  });
  try {
    return await captured.promise;
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2).replaceAll("-", "_");
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function credentialFromDisk(configPath: string): JsonRecord {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as JsonRecord;
  } catch {
    throw new Error(`无法读取 Agent 配置：${configPath}`);
  }
}

function redact(value: unknown, secret: string): string {
  return String(value).replaceAll(secret, "[已隐藏]").replace(/tdg_[A-Za-z0-9_-]+/g, "tdg_[已隐藏]");
}

function usage() {
  console.log([
    "终焉 Agent Worker 每日三场暗局验收",
    "",
    "pnpm --dir app exec tsx scripts/accept-live-agent-worker-daily.mts",
    "",
    "环境变量：TDG_BASE_URL、TDG_AGENT_KEY、TDG_AGENT_ID、TDG_AGENT_MEMORY、",
    "TDG_AGENT_GAME_ID、TDG_REPORT_WEBHOOK_URL、TDG_DAILY_MAX_CYCLES。",
    "验收不会输出 API Key；没有 Webhook 仍会检查服务端日报。",
  ].join("\n"));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }
  const configPath = resolve(String(args.config || process.env.TDG_AGENT_CONFIG || join(homedir(), ".tdg", "agent.json")));
  const credential = credentialFromDisk(configPath);
  const apiKey = String(args.api_key || process.env.TDG_AGENT_KEY || credential.key || "");
  const baseUrl = String(args.base_url || process.env.TDG_BASE_URL || credential.baseUrl || "");
  const agentId = Number(args.agent_id || process.env.TDG_AGENT_ID || credential.agentId || 0);
  const webhookUrl = String(args.webhook || process.env.TDG_REPORT_WEBHOOK_URL || "").trim() || undefined;
  const gameIds = String(args.game_ids || process.env.TDG_AGENT_GAME_ID || DEFAULT_GAME_IDS.join(","))
    .split(",").map((item) => item.trim()).filter(Boolean);
  const result = await runDailyWorkerAcceptance({
    baseUrl,
    apiKey,
    agentId,
    memoryPath: String(args.memory || process.env.TDG_AGENT_MEMORY || "").trim() || undefined,
    gameIds,
    maxCycles: Number(args.max_cycles || process.env.TDG_DAILY_MAX_CYCLES || DEFAULT_MAX_CYCLES),
    webhookUrl,
  });
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  main().catch((error) => {
    const configPath = resolve(process.env.TDG_AGENT_CONFIG || join(homedir(), ".tdg", "agent.json"));
    const secret = process.env.TDG_AGENT_KEY || String(credentialFromDisk(configPath).key || "");
    console.error(JSON.stringify({ status: "failed", error: redact(error, secret) }));
    process.exitCode = 1;
  });
}

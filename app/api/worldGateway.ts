import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { allowPublicRegistration, appealForAgent } from "./agentRouter";
import { registerPublicAgent } from "./queries/agentRegistration";
import {
  findActiveAgentKey,
  findActiveAgentKeyByReportToken,
} from "./queries/agentKeys";
import {
  buildDailyReport,
  getAgentReportSnapshot,
  listAgentActivities,
  recordAgentActivity,
} from "./queries/agentActivity";
import { findRoomByCode } from "./queries/rooms";
import {
  getSdkRoom,
  listRoomSummaries,
  OFFICIAL_GAMES,
} from "./games/sdk/registry";
import { gameActionSchema } from "./roomRouter";
import { ruleBookForTemplate } from "@contracts/rulebooks.data";
import { isAppealable } from "@contracts/rulebook";
import {
  commandPayloadForHash,
  commandPayloadHash,
  completeCommandReceipt,
  rejectCommandReceipt,
  reserveCommandReceipt,
} from "./queries/commandReceipts";

/** TDG-WP v0.1 的 HTTP/JSON 适配层；网页内部 tRPC 入口另行保留。 */
export const worldGateway = new Hono();

worldGateway.use("*", cors({ origin: "*", allowHeaders: ["content-type", "x-api-key", "authorization"] }));

const PROTOCOL_VERSION = "0.1";

class GatewayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

function descriptor(c: Context) {
  const origin = publicOrigin(c);
  return {
    protocolVersion: PROTOCOL_VERSION,
    worldId: "tdg-world",
    name: "终焉 · Distributed Intelligence World",
    status: "proposal-backed-local-runtime",
    endpoints: {
      discovery: `${origin}/.well-known/tdg-world.json`,
      registerAgent: `${origin}/world/v1/agents`,
      agentActivity: `${origin}/world/v1/agents/:agentId/activity`,
      agentReport: `${origin}/world/v1/agents/:agentId/report`,
      games: `${origin}/world/v1/games`,
      matches: `${origin}/world/v1/matches`,
    },
    authentication: {
      type: "api-key",
      headers: ["x-api-key", "Authorization: Bearer <tdg_key>"],
      note: "API Key 只在注册响应中返回一次；不要放入 URL、世界内容或命令 payload。",
    },
    capabilities: {
      httpJson: true,
      cli: true,
      mcp: "adapter-planned",
      a2a: "adapter-planned",
      persistentWorker: true,
      dailyReports: true,
      reportChannels: ["feishu", "wecom"],
      sse: false,
    },
    supportedGames: OFFICIAL_GAMES.map((game) => ({
      id: game.id,
      name: game.name,
      template: game.template,
      participation: ["human-v-human", "agent-v-agent", "human-agent-teams", "human-v-agent"],
    })),
  };
}

/** 反向代理/Cloudflare Tunnel 后仍生成可直接访问的公网 HTTPS 地址。 */
function publicOrigin(c: Context): string {
  const url = new URL(c.req.url);
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto === "http" || forwardedProto === "https") url.protocol = `${forwardedProto}:`;
  if (forwardedHost) url.host = forwardedHost;
  return url.origin;
}

function errorStatus(code: string): 400 | 401 | 403 | 404 | 409 | 429 | 500 {
  if (code === "UNAUTHORIZED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  if (code === "IDEMPOTENCY_CONFLICT") return 409;
  if (code === "COMMAND_IN_PROGRESS") return 409;
  if (code === "TOO_MANY_REQUESTS") return 429;
  return code === "INTERNAL_SERVER_ERROR" ? 500 : 400;
}

function errorResponse(c: Context, error: unknown) {
  const trpc = error instanceof TRPCError;
  const gatewayError = error instanceof GatewayError;
  const code = trpc ? error.code : gatewayError ? error.code : "BAD_REQUEST";
  const message = error instanceof Error ? error.message : "请求失败";
  return c.json(
    {
      protocolVersion: PROTOCOL_VERSION,
      error: { code, message },
    },
    gatewayError ? (error as GatewayError).status : errorStatus(code),
  );
}

function codeFromPath(c: Context): string {
  const code = c.req.param("code")?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "房间码格式无效" });
  }
  return code;
}

function rawApiKey(c: Context): string {
  const header = c.req.header("x-api-key") ?? c.req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
}

async function requireAgent(c: Context) {
  const raw = rawApiKey(c);
  if (!raw) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "缺少 API Key" });
  }
  const key = await findActiveAgentKey(raw);
  if (!key) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API Key 无效或已吊销" });
  }
  return key;
}

async function requireRoom(code: string) {
  const row = await findRoomByCode(code);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在" });
  const room = await getSdkRoom(code, row);
  if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在或已归档" });
  return room;
}

async function agentSeat(c: Context) {
  const key = await requireAgent(c);
  const room = await requireRoom(codeFromPath(c));
  const seat = room.getState().seats.find(
    (item) => item?.kind === "external-agent" && item.agentKeyId === key.id,
  );
  if (!seat?.seatToken) {
    throw new TRPCError({ code: "FORBIDDEN", message: "该 Agent 尚未在此房间入座" });
  }
  return { key, room, seat };
}

function bindingFor(code: string, keyId: number, seatIndex: number) {
  return {
    bindingId: `binding-${code.toLowerCase()}-${keyId}`,
    role: "player",
    scopeId: `match-${code.toLowerCase()}`,
    seatIndex,
  };
}

function contextFor(room: Awaited<ReturnType<typeof requireRoom>>) {
  const state = room.getState();
  return `${room.code.toLowerCase()}-v${state.version}-r${state.round}-${state.phase ?? state.status}`;
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请求体必须是合法 JSON" });
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(64),
  inviteCode: z.string().trim().min(1).max(128),
});

const commandSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION).optional(),
  commandId: z.string().trim().min(1).max(128).optional(),
  contextRef: z.string().trim().min(1).max(160).optional(),
  bindingId: z.string().trim().min(1).max(160).optional(),
  action: z.unknown(),
});

const appealSchema = z.object({
  clauseId: z.string().trim().min(1).max(32),
  assertion: z.string().trim().min(20).max(500),
  quorumSize: z.union([z.literal(3), z.literal(5), z.literal(7)]).default(3),
});

const activitySchema = z.object({
  kind: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(128),
  detail: z.string().trim().max(4000).optional(),
  payload: z.unknown().optional(),
  occurredAt: z.string().datetime().optional(),
});

worldGateway.get("/.well-known/tdg-world.json", (c) => c.json(descriptor(c)));
worldGateway.get("/world/v1", (c) => c.json(descriptor(c)));

worldGateway.post("/world/v1/agents", async (c) => {
  try {
    const input = registerSchema.parse(await jsonBody(c));
    allowPublicRegistration(c.req.raw, input.inviteCode);
    const result = await registerPublicAgent(input.name);
    const origin = publicOrigin(c);
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      agent: { agentId: result.agentId, userId: result.userId, name: result.name },
      credential: {
        type: "api-key",
        key: result.key,
        shownOnce: true,
        reportToken: result.reportToken,
        reportUrl: `${origin}/agent-report/${result.agentId}?token=${encodeURIComponent(result.reportToken)}`,
      },
    }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.get("/world/v1/games", (c) => c.json({
  protocolVersion: PROTOCOL_VERSION,
  games: OFFICIAL_GAMES.map((game) => ({
    id: game.id,
    name: game.name,
    template: game.template,
    seats: game.seats,
    params: game.params,
    entryFee: game.entryFee,
    rewards: game.rewards,
    submitWindowSec: game.submitWindowSec,
    version: "0.1.0",
  })),
}));

worldGateway.get("/world/v1/matches", async (c) => {
  try {
    await requireAgent(c);
    return c.json({ protocolVersion: PROTOCOL_VERSION, matches: listRoomSummaries() });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.post("/world/v1/matches/:code/join", async (c) => {
  try {
    const key = await requireAgent(c);
    const room = await requireRoom(codeFromPath(c));
    const joined = await room.joinAsAgent({ id: key.id, name: key.name });
    void recordAgentActivity({
      agentKeyId: key.id,
      kind: "match",
      title: `入座 · ${room.def.name}`,
      detail: `影从入座 ${room.code} 的第 ${joined.seatIndex + 1} 席。`,
      payload: {
        code: room.code,
        gameName: room.def.name,
        template: room.def.template,
        seatIndex: joined.seatIndex,
      },
    }).catch(() => undefined);
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      match: { code: joined.code, seatIndex: joined.seatIndex },
      binding: bindingFor(room.code, key.id, joined.seatIndex),
      observation: room.view(joined.seatToken),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

function agentIdFromPath(c: Context): number {
  const value = Number(c.req.param("agentId"));
  if (!Number.isInteger(value) || value <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Agent ID 无效" });
  }
  return value;
}

async function reportAgent(c: Context) {
  const agentId = agentIdFromPath(c);
  const reportToken = c.req.header("x-report-token") ?? new URL(c.req.url).searchParams.get("token") ?? "";
  const key = reportToken
    ? await findActiveAgentKeyByReportToken(reportToken)
    : await requireAgent(c);
  if (!key || key.id !== agentId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "日报 Token 与 Agent 不匹配" });
  }
  return { key, agentId };
}

worldGateway.post("/world/v1/agents/:agentId/activity", async (c) => {
  try {
    const key = await requireAgent(c);
    const agentId = agentIdFromPath(c);
    if (key.id !== agentId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "只能记录当前 Agent 的活动" });
    }
    const input = activitySchema.parse(await jsonBody(c));
    await recordAgentActivity({
      agentKeyId: key.id,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      payload: input.payload,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
    });
    return c.json({ protocolVersion: PROTOCOL_VERSION, ok: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.get("/world/v1/agents/:agentId/report", async (c) => {
  try {
    const { key } = await reportAgent(c);
    const reportDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
    const report = await buildDailyReport(key.id, reportDate);
    const snapshot = await getAgentReportSnapshot(key.id, reportDate);
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      readOnly: true,
      report,
      snapshot,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.post("/world/v1/agents/:agentId/daily", async (c) => {
  try {
    const { key } = await reportAgent(c);
    const reportDate = c.req.query("date") ?? new Date().toISOString().slice(0, 10);
    const report = await buildDailyReport(key.id, reportDate);
    return c.json({ protocolVersion: PROTOCOL_VERSION, report });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.get("/world/v1/agents/:agentId/activities", async (c) => {
  try {
    const { key } = await reportAgent(c);
    const limit = Number(c.req.query("limit") ?? 60);
    return c.json({ protocolVersion: PROTOCOL_VERSION, activities: await listAgentActivities(key.id, limit) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.get("/world/v1/matches/:code/observation", async (c) => {
  try {
    const { key, room, seat } = await agentSeat(c);
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      binding: bindingFor(room.code, key.id, seat.index),
      contextRef: contextFor(room),
      observation: room.view(seat.seatToken!),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.get("/world/v1/matches/:code/rulebook", async (c) => {
  try {
    const { room } = await agentSeat(c);
    const book = ruleBookForTemplate(room.def.template);
    if (!book) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `模板 ${room.def.template} 尚无规则书`,
      });
    }
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      rulebook: {
        id: book.id,
        name: book.name,
        version: book.version,
        clauses: book.clauses.map((clause) => ({
          id: clause.id,
          title: clause.title,
          text: clause.text,
          category: clause.category,
          appealable: isAppealable(clause),
        })),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.post("/world/v1/matches/:code/appeals", async (c) => {
  try {
    const key = await requireAgent(c);
    const code = codeFromPath(c);
    const input = appealSchema.parse(await jsonBody(c));
    const result = await appealForAgent({ key, code, ...input });
    return c.json({ protocolVersion: PROTOCOL_VERSION, ...result });
  } catch (error) {
    return errorResponse(c, error);
  }
});

worldGateway.post("/world/v1/matches/:code/commands", async (c) => {
  try {
    const { key, room, seat } = await agentSeat(c);
    const envelope = commandSchema.parse(await jsonBody(c));
    const action = gameActionSchema.parse(envelope.action);
    const scopeId = `match-${room.code.toLowerCase()}`;
    const expectedBinding = bindingFor(room.code, key.id, seat.index);
    if (envelope.bindingId && envelope.bindingId !== expectedBinding.bindingId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "bindingId 与当前 Agent 座位不匹配" });
    }
    const commandId = envelope.commandId ?? `cmd_${randomBytes(10).toString("hex")}`;
    const payload = commandPayloadForHash({
      contextRef: envelope.contextRef,
      bindingId: envelope.bindingId,
      action,
    });
    const payloadHash = commandPayloadHash(payload);
    const reservation = await reserveCommandReceipt({
      agentKeyId: key.id,
      commandId,
      scopeId,
      bindingId: envelope.bindingId ?? expectedBinding.bindingId,
      contextRef: envelope.contextRef,
      payloadHash,
    });
    const receipt = reservation.receipt;
    if (receipt.payloadHash !== payloadHash) {
      throw new GatewayError("IDEMPOTENCY_CONFLICT", "commandId 已使用不同 payload，拒绝执行", 409);
    }
    if (!reservation.created) {
      if (receipt.status === "committed" && receipt.responseJson) {
        return c.json(receipt.responseJson as Record<string, unknown>);
      }
      if (receipt.status === "rejected") {
        return c.json({
          protocolVersion: PROTOCOL_VERSION,
          error: {
            code: receipt.errorCode ?? "BAD_REQUEST",
            message: receipt.errorMessage ?? "命令已拒绝",
          },
        }, errorStatus(receipt.errorCode ?? "BAD_REQUEST"));
      }
      throw new GatewayError("COMMAND_IN_PROGRESS", "同一 commandId 的命令仍在处理，未重复执行", 409);
    }
    const expectedContext = contextFor(room);
    if (envelope.contextRef && envelope.contextRef !== expectedContext) {
      await rejectCommandReceipt({
        receiptId: receipt.id,
        errorCode: "CONFLICT",
        errorMessage: "contextRef 已过期，请先重新读取 observation",
      });
      throw new TRPCError({ code: "CONFLICT", message: "contextRef 已过期，请先重新读取 observation" });
    }
    let result: unknown;
    try {
      result = await room.act(seat.seatToken!, action);
    } catch (error) {
      await rejectCommandReceipt({
        receiptId: receipt.id,
        errorCode: error instanceof TRPCError ? error.code : "BAD_REQUEST",
        errorMessage: error instanceof Error ? error.message : "命令执行失败",
      });
      throw error;
    }
    const response = {
      protocolVersion: PROTOCOL_VERSION,
      receipt: {
        commandId,
        scopeId,
        status: "committed",
        result,
      },
      contextRef: contextFor(room),
      observation: room.view(seat.seatToken!),
    };
    void recordAgentActivity({
      agentKeyId: key.id,
      kind: "action",
      title: `${room.def.name} · ${action.type}`,
      detail: `在 ${room.code} 提交了 ${action.type} 动作。`,
      payload: {
        code: room.code,
        gameName: room.def.name,
        template: room.def.template,
        actionType: action.type,
        round: (response.observation as { round?: number }).round,
        status: (response.observation as { status?: string }).status,
        result: response.receipt.result,
      },
    }).catch(() => undefined);
    try {
      await completeCommandReceipt({
        receiptId: receipt.id,
        commandId,
        scopeId,
        response: response as never,
        eventPayload: {
          commandId,
          scopeId,
          payloadHash,
          response,
        } as never,
      });
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "命令效果已交给房间，但持久化收据未完成，请稍后按原 commandId 重试",
        cause: error,
      });
    }
    return c.json(response);
  } catch (error) {
    return errorResponse(c, error);
  }
});

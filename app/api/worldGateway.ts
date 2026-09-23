import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { allowPublicRegistration, appealForAgent } from "./agentRouter";
import { registerPublicAgent } from "./queries/agentRegistration";
import { findActiveAgentKey } from "./queries/agentKeys";
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
  const origin = new URL(c.req.url).origin;
  return {
    protocolVersion: PROTOCOL_VERSION,
    worldId: "tdg-world",
    name: "十日牌局 · Ten Days Gambit",
    status: "proposal-backed-local-runtime",
    endpoints: {
      discovery: `${origin}/.well-known/tdg-world.json`,
      registerAgent: `${origin}/world/v1/agents`,
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
      sse: false,
    },
    supportedGames: OFFICIAL_GAMES.map((game) => ({
      id: game.id,
      name: game.name,
      template: game.template,
      participation: ["human-v-human", "agent-v-agent", "human-agent-teams", "mixed"],
    })),
  };
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

worldGateway.get("/.well-known/tdg-world.json", (c) => c.json(descriptor(c)));
worldGateway.get("/world/v1", (c) => c.json(descriptor(c)));

worldGateway.post("/world/v1/agents", async (c) => {
  try {
    const input = registerSchema.parse(await jsonBody(c));
    allowPublicRegistration(c.req.raw, input.inviteCode);
    const result = await registerPublicAgent(input.name);
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      agent: { agentId: result.agentId, userId: result.userId, name: result.name },
      credential: { type: "api-key", key: result.key, shownOnce: true },
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

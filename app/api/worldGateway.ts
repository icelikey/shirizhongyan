import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { allowPublicRegistration } from "./agentRouter";
import { registerPublicAgent } from "./queries/agentRegistration";
import { findActiveAgentKey } from "./queries/agentKeys";
import { findRoomByCode } from "./queries/rooms";
import {
  getSdkRoom,
  listRoomSummaries,
  OFFICIAL_GAMES,
} from "./games/sdk/registry";
import { gameActionSchema } from "./roomRouter";

/** TDG-WP v0.1 的 HTTP/JSON 适配层。tRPC 与 CLI 旧入口继续保留。 */
export const worldGateway = new Hono();

worldGateway.use("*", cors({ origin: "*", allowHeaders: ["content-type", "x-api-key", "authorization"] }));

const PROTOCOL_VERSION = "0.1";

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
  if (code === "TOO_MANY_REQUESTS") return 429;
  return code === "INTERNAL_SERVER_ERROR" ? 500 : 400;
}

function errorResponse(c: Context, error: unknown) {
  const trpc = error instanceof TRPCError;
  const code = trpc ? error.code : "BAD_REQUEST";
  const message = error instanceof Error ? error.message : "请求失败";
  return c.json(
    {
      protocolVersion: PROTOCOL_VERSION,
      error: { code, message },
    },
    errorStatus(code),
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

worldGateway.post("/world/v1/matches/:code/commands", async (c) => {
  try {
    const { key, room, seat } = await agentSeat(c);
    const envelope = commandSchema.parse(await jsonBody(c));
    const action = gameActionSchema.parse(envelope.action);
    const expectedContext = contextFor(room);
    if (envelope.contextRef && envelope.contextRef !== expectedContext) {
      throw new TRPCError({ code: "CONFLICT", message: "contextRef 已过期，请先重新读取 observation" });
    }
    const result = await room.act(seat.seatToken!, action);
    const commandId = envelope.commandId ?? `cmd_${randomBytes(10).toString("hex")}`;
    return c.json({
      protocolVersion: PROTOCOL_VERSION,
      receipt: {
        commandId,
        scopeId: `match-${room.code.toLowerCase()}`,
        status: "committed",
        result,
      },
      contextRef: contextFor(room),
      observation: room.view(seat.seatToken!),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});


/**
 * ============================================================================
 * Game SDK 注册表（api/games/sdk/registry.ts）
 * ----------------------------------------------------------------------------
 * - OFFICIAL_GAMES：官方游戏定义常量（guess-core / poll-duel-core），不入库。
 * - UGC 定义存 game_defs 表（defId 形如 'ugc_xxxxxxxx'）。
 * - 房间注册表：内存 Map<code, SdkRoom> + rooms.stateJson 恢复。
 *   兼容说明：v3 旧房间的 stateJson 无 sdk 标记，进程重启后不再恢复
 *   （旧房间随服务重启归档清理——与 v3 一致，列表本就只扫描内存注册表）。
 * ============================================================================
 */
import { randomBytes } from "node:crypto";
import type { RoomConfig, RoomSummary } from "@contracts/room";
import type {
  CreateGameDefInput,
  GameDefinition,
  GameDefSummary,
} from "@contracts/gameSdk";
import {
  numberGuessParamsSchema,
  pollDuelParamsSchema,
} from "@contracts/gameSdk";
import type { GameDefRow, Room } from "@db/schema";
import {
  findGameDefByDefId,
  insertGameDef,
  listPopularGameDefs,
} from "../../queries/gameDefs";
import { SdkRoom, SDK_STATE_VERSION } from "./runtime";
import type { SdkRoomState } from "./runtime";
import type { TemplateModule } from "./templates";
import { numberGuessModule } from "./numberGuess";
import { pollDuelModule } from "./pollDuel";

/* ------------------------------------------------------------------ */
/* 官方定义（guess-core = v3 猜平均数默认参数；poll-duel-core = 红眼病官方版）*/
/* ------------------------------------------------------------------ */
export const GUESS_CORE: GameDefinition = {
  id: "guess-core",
  name: "青野算庭 · 猜平均数",
  template: "numberGuess",
  seats: 6,
  isOfficial: true,
  params: { rounds: 5, min: 0, max: 100, targetRatio: 2 / 3, scoreWin: 2, scoreSecond: 1 },
  entryFee: { suit: "club", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 30,
};

export const POLL_DUEL_CORE: GameDefinition = {
  id: "poll-duel-core",
  name: "红眼病 · 少数派票决",
  template: "pollDuel",
  seats: 6,
  isOfficial: true,
  params: { rounds: 5, choices: ["红", "蓝"], payoff: "minority-wins", scoreWin: 2 },
  entryFee: { suit: "heart", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 30,
};

export const OFFICIAL_GAMES: GameDefinition[] = [GUESS_CORE, POLL_DUEL_CORE];

const officialMap = new Map(OFFICIAL_GAMES.map((d) => [d.id, d]));

const TEMPLATE_MODULES: Record<GameDefinition["template"], TemplateModule> = {
  numberGuess: numberGuessModule,
  pollDuel: pollDuelModule,
};

export function moduleFor(def: GameDefinition): TemplateModule {
  return TEMPLATE_MODULES[def.template];
}

/* ------------------------------------------------------------------ */
/* UGC 定义的 DB 读写                                                    */
/* ------------------------------------------------------------------ */
function rowToDefinition(row: GameDefRow): GameDefinition | null {
  const base = {
    id: row.defId,
    name: row.name,
    seats: row.seats,
    isOfficial: false,
    creatorUserId: row.creatorUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    entryFee: row.entryFee as GameDefinition["entryFee"],
    rewards: row.rewards as GameDefinition["rewards"],
    submitWindowSec: row.submitWindowSec,
  };
  if (row.template === "numberGuess") {
    const params = numberGuessParamsSchema.safeParse(row.params);
    if (!params.success) return null;
    return { ...base, template: "numberGuess", params: params.data };
  }
  if (row.template === "pollDuel") {
    const params = pollDuelParamsSchema.safeParse(row.params);
    if (!params.success) return null;
    return { ...base, template: "pollDuel", params: params.data };
  }
  return null;
}

/** 解析定义：官方常量优先，其次 game_defs 表（找不到 → null） */
export async function resolveDefinition(
  defId: string,
): Promise<GameDefinition | null> {
  const official = officialMap.get(defId);
  if (official) return official;
  const row = await findGameDefByDefId(defId);
  if (!row) return null;
  return rowToDefinition(row);
}

export function newUgcDefId(): string {
  return `ugc_${randomBytes(5).toString("hex")}`; // ugc_ + 10 hex = 14 字符
}

/** 创建 UGC 定义（入参已过 createGameDefSchema 校验），返回完整定义 */
export async function createUserDefinition(
  input: CreateGameDefInput,
  creatorUserId: number,
): Promise<GameDefinition> {
  const defId = newUgcDefId();
  await insertGameDef({
    defId,
    name: input.name,
    template: input.template,
    seats: input.seats,
    params: input.params,
    entryFee: input.entryFee,
    rewards: input.rewards,
    submitWindowSec: input.submitWindowSec,
    creatorUserId,
  });
  return {
    ...input,
    id: defId,
    isOfficial: false,
    creatorUserId,
    createdAt: new Date().toISOString(),
  } as GameDefinition;
}

/** game.listDefs：官方在前 + 热门 UGC（按 plays 倒序） */
export async function listDefinitions(): Promise<GameDefSummary[]> {
  const rows = await listPopularGameDefs(20);
  const ugc: GameDefSummary[] = [];
  for (const row of rows) {
    const def = rowToDefinition(row);
    if (def) ugc.push({ ...def, plays: row.plays });
  }
  return [
    ...OFFICIAL_GAMES.map((d) => ({ ...d, plays: 0 })),
    ...ugc,
  ];
}

/* ------------------------------------------------------------------ */
/* 房间注册表：内存 Map<code, SdkRoom> + stateJson 恢复                   */
/* ------------------------------------------------------------------ */
const registry = new Map<string, SdkRoom>();

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function createSdkRoom(opts: {
  def: GameDefinition;
  roomName: string;
  createdByUserId: number | null;
  creatorName: string;
  config?: RoomConfig;
}) {
  const code = generateRoomCode();
  const room = new SdkRoom({
    def: opts.def,
    module: moduleFor(opts.def),
    code,
    roomName: opts.roomName,
    createdByUserId: opts.createdByUserId,
    createdAt: new Date(),
    config: opts.config ?? {},
  });
  registry.set(code, room);
  const joined = await room.joinAsHuman({
    id: opts.createdByUserId ?? 0,
    name: opts.creatorName,
  });
  if (opts.config?.autoStart) {
    await room.act(joined.seatToken, { type: "start" });
  }
  return { room, code, seatToken: joined.seatToken, seatIndex: joined.seatIndex };
}

/**
 * 取房间：内存优先，miss 时从 rooms.stateJson 恢复。
 * 仅恢复快照带 sdk 标记的 v4 房间；v3 旧快照随服务重启归档（见文件头注释）。
 */
export async function getSdkRoom(
  code: string,
  row?: Room,
): Promise<SdkRoom | null> {
  const key = code.toUpperCase();
  const cached = registry.get(key);
  if (cached) return cached;
  if (!row || !row.stateJson) return null;
  const state = row.stateJson as SdkRoomState;
  if (state.sdk !== SDK_STATE_VERSION) return null;
  const def = await resolveDefinition(row.defId ?? "guess-core");
  if (!def) return null;
  const config = (row.config ?? {}) as RoomConfig;
  const room = new SdkRoom({
    def,
    module: moduleFor(def),
    code: key,
    roomName: config.roomName ?? key,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    config,
    state,
  });
  registry.set(key, room);
  room.resumeTimers();
  return room;
}

/** 进行/等待中的房间摘要（内存注册表扫描；状态变更都会写库） */
export function listRoomSummaries(): RoomSummary[] {
  return [...registry.values()]
    .filter((r) => r.status !== "finished")
    .map((r) => ({
      code: r.code,
      roomName: r.roomName,
      game: moduleFor(r.def).gameKind,
      status: r.status,
      seatsTotal: r.def.seats,
      seatsTaken: r.seatsTaken(),
      hasAgentSeat: r.hasAgentSeat(),
      createdAt: r.createdAt,
      defId: r.def.id,
      template: r.def.template,
      gameName: r.def.name,
      isOfficial: r.def.isOfficial,
      entryFee: r.def.entryFee,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** 测试辅助：清空注册表 */
export function resetSdkRoomRegistry() {
  registry.clear();
}

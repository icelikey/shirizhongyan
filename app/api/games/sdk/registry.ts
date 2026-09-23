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
  flyTeaseParamsSchema,
  numberGuessParamsSchema,
  pirateGoldParamsSchema,
  pollDuelParamsSchema,
  resolveSeatPolicy,
} from "@contracts/gameSdk";
import { FLYTEASE_CORE_ID, FLYTEASE_DEFAULT_PARAMS } from "@contracts/flyTease";
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
import { pirateGoldModule } from "./pirateGold";
import { pollDuelModule } from "./pollDuel";
import { flyTeaseModule } from "./flyTease";

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

/**
 * 千轮猜数（agent-only）：只容 Agent 席，200 轮跑出 level-k 收敛曲线——
 * 人类跟不上这个节奏，这是「分布式智能」相对人类局最有说服力的演出。
 * seats 沿用 numberGuess 模板执行器，行为与 guess-core 完全一致，
 * 仅参数（轮数/席位策略）不同，无需新写模板。
 */
export const GUESS_MILLE_CORE: GameDefinition = {
  id: "guess-mille-core",
  name: "千机演算 · 千轮猜数",
  template: "numberGuess",
  seats: 6,
  isOfficial: true,
  params: { rounds: 200, min: 0, max: 100, targetRatio: 2 / 3, scoreWin: 2, scoreSecond: 1 },
  entryFee: { suit: "club", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 10,
  seatPolicy: "agent-only",
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

export const PIRATE_GOLD_CORE: GameDefinition = {
  id: "pirate-gold-core",
  name: "金壤分潮 · 海盗分金",
  template: "pirateGold",
  seats: 5,
  isOfficial: true,
  params: { rounds: 4, coins: 20 },
  entryFee: { suit: "diamond", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 30,
  seatPolicy: "mixed-required",
  minHumanSeats: 1,
  minAgentSeats: 1,
};

export const FLYTEASE_CORE: GameDefinition = {
  id: FLYTEASE_CORE_ID,
  name: "玄渊·虫心算谱",
  template: "flyTease",
  seats: 6,
  isOfficial: true,
  params: { ...FLYTEASE_DEFAULT_PARAMS },
  entryFee: { suit: "spade", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 45,
};

export const OFFICIAL_GAMES: GameDefinition[] = [
  GUESS_CORE,
  GUESS_MILLE_CORE,
  POLL_DUEL_CORE,
  PIRATE_GOLD_CORE,
  FLYTEASE_CORE,
];

const officialMap = new Map(OFFICIAL_GAMES.map((d) => [d.id, d]));

const TEMPLATE_MODULES: Record<GameDefinition["template"], TemplateModule> = {
  numberGuess: numberGuessModule,
  pollDuel: pollDuelModule,
  pirateGold: pirateGoldModule,
  flyTease: flyTeaseModule,
};

export function moduleFor(def: GameDefinition): TemplateModule {
  return TEMPLATE_MODULES[def.template];
}

/**
 * mysql2 在不同连接模式下可能把 JSON 列返回为对象或 JSON 字符串。
 * UGC 定义必须在两种返回形态下都能被目录、建房和 Agent Gateway 解析。
 */
function parseJsonColumn<T>(value: unknown): T | null {
  if (typeof value !== "string") return (value as T) ?? null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* UGC 定义的 DB 读写                                                    */
/* ------------------------------------------------------------------ */
function rowToDefinition(row: GameDefRow): GameDefinition | null {
  const entryFee = parseJsonColumn<GameDefinition["entryFee"]>(row.entryFee);
  const rewards = parseJsonColumn<GameDefinition["rewards"]>(row.rewards);
  if (!entryFee || !rewards) return null;
  const base = {
    id: row.defId,
    name: row.name,
    seats: row.seats,
    isOfficial: false,
    creatorUserId: row.creatorUserId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    entryFee,
    rewards,
    submitWindowSec: row.submitWindowSec,
  };
  if (row.template === "numberGuess") {
    const params = numberGuessParamsSchema.safeParse(parseJsonColumn(row.params));
    if (!params.success) return null;
    return { ...base, template: "numberGuess", params: params.data };
  }
  if (row.template === "pollDuel") {
    const params = pollDuelParamsSchema.safeParse(parseJsonColumn(row.params));
    if (!params.success) return null;
    return { ...base, template: "pollDuel", params: params.data };
  }
  if (row.template === "pirateGold") {
    const params = pirateGoldParamsSchema.safeParse(parseJsonColumn(row.params));
    if (!params.success) return null;
    return { ...base, template: "pirateGold", params: params.data };
  }
  if (row.template === "flyTease") {
    const params = flyTeaseParamsSchema.safeParse(parseJsonColumn(row.params));
    if (!params.success) return null;
    return { ...base, template: "flyTease", params: params.data };
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

  // agent-only 之局不容真人入座——创建者不占座，房间空置等待外来 Agent
  // 通过 agent.gatewayJoin 落座（0 号席）后自行开局。
  if (resolveSeatPolicy(opts.def) === "agent-only") {
    return { room, code, seatToken: null, seatIndex: null };
  }

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

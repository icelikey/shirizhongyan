/**
 * ============================================================================
 * v3 兼容层（api/games/guessRoom.ts）
 * ----------------------------------------------------------------------------
 * v4 起房间运行时迁入 Game SDK（api/games/sdk/）：
 * - 通用 actor        → sdk/runtime.ts   （SdkRoom）
 * - 猜平均数模板执行器 → sdk/numberGuess.ts（规则与 v3 完全一致）
 * - 定义注册/房间注册  → sdk/registry.ts  （guess-core = v3 默认参数）
 *
 * 本文件仅保留 v3 导出签名作为薄 shim，避免破坏既有引用。
 * 旧房间 stateJson 无 sdk 标记，进程重启后随服务归档清理（见 registry.ts）。
 * ============================================================================
 */
import type { RoomConfig } from "@contracts/room";
import type { Room } from "@db/schema";
import {
  GUESS_CORE,
  createSdkRoom,
  getSdkRoom,
  listRoomSummaries,
  resetSdkRoomRegistry,
} from "./sdk/registry";
import { SdkRoom } from "./sdk/runtime";

/** v3 常量（行为不变：现由 guess-core 定义承载） */
export const GUESS_ROUNDS = 5;
export const GUESS_SEATS = 6;
export const SUBMIT_WINDOW_MS = 30_000;
export { REVEAL_MS } from "./sdk/runtime";
export const TIMEOUT_FALLBACK = 50;
export const GUESS_REWARDS = { champion: 50, runnerUp: 25, participant: 5 } as const;

/** v3 类型别名 */
export type GuessRoom = SdkRoom;

export async function createGuessRoom(opts: {
  roomName: string;
  createdByUserId: number | null;
  creatorName: string;
  config?: RoomConfig;
}) {
  return createSdkRoom({ def: GUESS_CORE, ...opts });
}

export async function getGuessRoom(
  code: string,
  row?: Room,
): Promise<SdkRoom | null> {
  return getSdkRoom(code, row);
}

export function listGuessRoomSummaries() {
  return listRoomSummaries();
}

export function resetGuessRoomRegistry() {
  resetSdkRoomRegistry();
}

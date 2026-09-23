import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { RoomConfig } from "@contracts/room";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  GUESS_CORE,
  createSdkRoom,
  getSdkRoom,
  listRoomSummaries,
  moduleFor,
  resolveDefinition,
} from "./games/sdk/registry";
import { findRoomByCode, insertRoom } from "./queries/rooms";

const codeSchema = z
  .string()
  .min(4)
  .max(8)
  .transform((s) => s.toUpperCase());

/**
 * SDK 房间动作（全模板通用）：
 * start（房主开局）/ submit（numberGuess 提交数字）/ choose（pollDuel 选项下标）。
 * 具体边界由模板执行器按 def.params 二次校验。
 */
export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  z.object({
    type: z.literal("submit"),
    value: z.number().min(-1000).max(1000),
  }),
  z.object({
    type: z.literal("choose"),
    choice: z.number().int().min(0).max(3),
  }),
  // 打牌：cardId 由模板校验是否在手牌内，此处只做形状与长度约束
  z.object({
    type: z.literal("play"),
    cardId: z.string().trim().min(1).max(48),
    targetSeat: z.number().int().min(0).max(15).optional(),
  }),
  // 提案（海盗分金）：分配数组长度/总额由模板按 def.params.coins 二次校验
  z.object({
    type: z.literal("propose"),
    allocation: z.array(z.number().int().min(0)).min(2).max(8),
  }),
  // 表决（海盗分金）
  z.object({
    type: z.literal("vote"),
    approve: z.boolean(),
  }),
  // 文本：辩论陈词、猜词提问、自由发言。
  // 上限 600 字——长文会拖慢裁判判定，且牌桌上没人读长文
  z.object({
    type: z.literal("speak"),
    text: z.string().trim().min(1).max(600),
    targetSeat: z.number().int().min(0).max(15).optional(),
  }),
]);

/** v3 别名（agent.gatewayAct 沿用） */
export const guessActionSchema = gameActionSchema;

/** 从 DB 恢复或取内存中的房间（找不到 → 404） */
async function requireRoom(code: string) {
  const row = await findRoomByCode(code);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在" });
  }
  const room = await getSdkRoom(code, row);
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在或已归档" });
  }
  return room;
}

export const roomRouter = createRouter({
  /** 进行/等待中的房间摘要（含游戏名/模板/门票/UGC 标记） */
  list: publicQuery.query(() => listRoomSummaries()),

  /** 建房：默认 guess-core；defId 可指定官方/UGC 定义，创建者占 0 号人类席 */
  create: authedQuery
    .input(
      z.object({
        roomName: z.string().min(1).max(32).optional(),
        autoStart: z.boolean().optional(),
        defId: z.string().min(1).max(24).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const def = input.defId
        ? await resolveDefinition(input.defId)
        : GUESS_CORE;
      if (!def) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "游戏定义不存在",
        });
      }
      const roomName =
        input.roomName?.trim() || `${ctx.user.name ?? "旅人"}的${def.name}`;
      const config: RoomConfig = { roomName, autoStart: input.autoStart };
      const { room, code, seatToken, seatIndex } = await createSdkRoom({
        def,
        roomName,
        createdByUserId: ctx.user.id,
        creatorName: ctx.user.name ?? "旅人",
        config,
      });
      await insertRoom({
        code,
        game: moduleFor(def).gameKind,
        defId: def.id,
        status: room.status,
        config,
        stateJson: room.getState(),
        createdByUserId: ctx.user.id,
      });
      return { code, seatToken, seatIndex, defId: def.id, template: def.template };
    }),

  /** 加入房间：分配空人类席；满则 409 */
  join: authedQuery
    .input(z.object({ code: codeSchema }))
    .mutation(async ({ ctx, input }) => {
      const room = await requireRoom(input.code);
      return room.joinAsHuman({ id: ctx.user.id, name: ctx.user.name });
    }),

  /** 座位视角的脱敏房间状态（他人已提交值在揭晓前不可见；pollDuel 附 choices） */
  state: publicQuery
    .input(
      z.object({
        code: codeSchema,
        seatToken: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const room = await requireRoom(input.code);
      return room.view(input.seatToken);
    }),

  /** 动作：start / submit（numberGuess）/ choose（pollDuel） */
  act: publicQuery
    .input(
      z.object({
        code: codeSchema,
        seatToken: z.string().min(1),
        action: gameActionSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const room = await requireRoom(input.code);
      return room.act(input.seatToken, input.action);
    }),
});

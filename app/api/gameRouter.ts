/**
 * game.listDefs / game.createDef —— Game SDK 游戏定义门户（api/gameRouter.ts）
 */
import { createGameDefSchema } from "@contracts/gameSdk";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { createUserDefinition, listDefinitions } from "./games/sdk/registry";

export const gameRouter = createRouter({
  /** 官方 + 热门 UGC 定义列表（public） */
  listDefs: publicQuery.query(() => listDefinitions()),

  /** 创建 UGC 定义（zod 严格校验各参数边界），返回完整定义（含 defId） */
  createDef: authedQuery
    .input(createGameDefSchema)
    .mutation(async ({ ctx, input }) => {
      return createUserDefinition(input, ctx.user.id);
    }),
});

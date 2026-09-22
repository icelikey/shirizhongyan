import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { findProfileByUserId, upsertProfile } from "./queries/profiles";

const frag = z.number().int().min(0).max(1_000_000);

export const profileRouter = createRouter({
  /** 读取当前用户的云端档案（无则返回 null，前端回落本地存档） */
  get: authedQuery.query(({ ctx }) => findProfileByUserId(ctx.user.id)),

  /** 全量保存档案（昵称/四碎片/位阶/各 json 字段），记录 updatedAt */
  save: authedQuery
    .input(
      z.object({
        nickname: z.string().min(1).max(32),
        fragSpade: frag,
        fragHeart: frag,
        fragClub: frag,
        fragDiamond: frag,
        tier: z.string().min(1).max(16),
        zodiacJson: z.unknown().optional(),
        companionJson: z.unknown().optional(),
        recordsJson: z.unknown().optional(),
        echoMemoriesJson: z.unknown().optional(),
        unlockedLoreJson: z.unknown().optional(),
      }),
    )
    .mutation(({ ctx, input }) => upsertProfile(ctx.user.id, input)),
});

import * as cookie from "cookie";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { env } from "./lib/env";
import { signSessionToken } from "./kimi/session";
import { upsertUser } from "./queries/users";

export const authRouter = createRouter({
  /**
   * 仅开发环境的本机试玩身份。它不经过 Kimi OAuth，也不会在生产构建中
   * 开放；用途是让本机验收联机赛马、狼人杀和 Agent 旁观流程不被云端
   * client_id 配置阻塞。
   */
  localDemo: publicQuery
    .input(z.object({ name: z.string().trim().min(1).max(32).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (env.isProduction || process.env.TDG_LOCAL_DEMO_AUTH === "false") {
        throw new Error("本机试玩登录只在开发环境可用");
      }
      const unionId = "local-demo-user";
      const name = input?.name?.trim() || "本机旅人";
      await upsertUser({ unionId, name, avatar: null });
      const token = await signSessionToken({
        unionId,
        clientId: env.appId || "local-dev",
      });
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        }),
      );
      return { ok: true, name };
    }),
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});

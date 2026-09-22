import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { profileRouter } from "./profileRouter";
import { roomRouter } from "./roomRouter";
import { agentRouter } from "./agentRouter";
import { gameRouter } from "./gameRouter";
import { worldRouter } from "./worldRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  profile: profileRouter,
  room: roomRouter,
  agent: agentRouter,
  game: gameRouter,
  /** 世界层：规则书 / 质询裁决 / 判例 / 观战回放 */
  world: worldRouter,
});

export type AppRouter = typeof appRouter;

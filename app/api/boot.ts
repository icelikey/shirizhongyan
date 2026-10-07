import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { serveStaticFiles } from "./lib/vite";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import { worldGateway } from "./worldGateway";
import { startWorldOutboxWorker } from "./world/worldOutboxWorker";
import { getDb } from "./queries/connection";
import { sql } from "drizzle-orm";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.get("/api/health", c => c.json({ ok: true, service: "ten-days-gambit" }));
app.get("/api/ready", async c => {
  try {
    await getDb().execute(sql`SELECT 1`);
    return c.json({
      ok: true,
      service: "ten-days-gambit",
      checks: { database: true },
    });
  } catch {
    return c.json(
      {
        ok: false,
        service: "ten-days-gambit",
        checks: { database: false },
      },
      503
    );
  }
});
app.route("/", worldGateway);
app.use("/api/trpc/*", async c => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", c => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

// 世界事件与 API 同进程启动；多副本时通过数据库租约竞争消费。
// Vite 本地开发也启动它，否则本地真实对局只能写入 world_outbox，
// Agent 的选择不会继续投影到 world_contributions，容易把“世界未运作”误判为接口故障。
if (process.env.TDG_WORLD_OUTBOX_WORKER !== "false") {
  startWorldOutboxWorker();
}

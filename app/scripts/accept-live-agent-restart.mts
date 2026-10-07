/**
 * M1 中途重启验收：使用独立端口启动生产服务，创建真实 Agent 对局，
 * 在提交阶段写入快照后重启进程，再用同一组凭证继续完成对局。
 *
 * 运行：
 *   pnpm --dir app exec tsx scripts/accept-live-agent-restart.mts
 *
 * 默认验证三款官方游戏；可用 TDG_RESTART_GAMES 传入逗号分隔的 defId。
 * 脚本只输出房间、数量、哈希和状态，不输出 API Key、session 或邀请码。
 */
import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { env } from "../api/lib/env";
import { signSessionToken } from "../api/kimi/session";
import { matchLogs, rooms, users } from "../db/schema";
import { fileURLToPath } from "node:url";
import path from "node:path";

type JsonRecord = Record<string, any>;
type GameId = "superpower-race-core" | "superpower-billiards-core" | "werewolf-12-core";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.TDG_RESTART_PORT?.trim() || 3110);
const baseUrl = `http://127.0.0.1:${port}`;
const inviteCode = process.env.AGENT_REGISTRATION_CODE?.trim();
if (!inviteCode) throw new Error("AGENT_REGISTRATION_CODE 未配置");

const selected = (process.env.TDG_RESTART_GAMES?.split(",").map(item => item.trim()).filter(Boolean) ?? []) as GameId[];
const games: GameId[] = selected.length > 0
  ? selected
  : ["superpower-race-core", "superpower-billiards-core", "werewolf-12-core"];

let child: ChildProcess | null = null;

async function readJson(response: Response): Promise<JsonRecord> {
  const text = await response.text();
  let body: JsonRecord;
  try {
    body = JSON.parse(text) as JsonRecord;
  } catch {
    throw new Error(`响应不是 JSON：${response.status}`);
  }
  if (!response.ok) {
    const item = Array.isArray(body) ? body[0] : body;
    throw new Error(`${response.status} ${item?.error?.json?.message ?? item?.error?.message ?? item?.message ?? "请求失败"}`);
  }
  return body;
}

async function gateway(pathname: string, init: RequestInit = {}): Promise<JsonRecord> {
  return readJson(await fetch(`${baseUrl}${pathname}`, init));
}

async function trpc(pathname: string, input: JsonRecord, cookie: string): Promise<any> {
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const body = await readJson(response);
  const item = Array.isArray(body) ? body[0] : body;
  if (item?.error) throw new Error(item.error.json?.message ?? item.error.message ?? "tRPC 请求失败");
  return item?.result?.data?.json ?? item?.result?.data;
}


async function trpcQuery(pathname: string, input: JsonRecord, cookie: string): Promise<any> {
  const encodedInput = encodeURIComponent(JSON.stringify({ "0": { json: input } }));
  const response = await fetch(`${baseUrl}/api/trpc/${pathname}?batch=1&input=${encodedInput}`, {
    method: "GET",
    headers: { cookie },
  });
  const body = await readJson(response);
  const item = Array.isArray(body) ? body[0] : body;
  if (item?.error) throw new Error(item.error.json?.message ?? item.error.message ?? "tRPC 查询失败");
  return item?.result?.data?.json ?? item?.result?.data;
}

async function waitForHealth(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const body = await gateway("/api/health");
      if (body.ok === true) return;
    } catch {
      // 服务启动窗口内连接失败是预期情况。
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`等待 ${baseUrl} 健康检查超时`);
}

function startServer() {
  child = spawn(process.execPath, ["dist/boot.js"], {
    cwd: appRoot,
    env: { ...process.env, NODE_ENV: "production", PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("exit", () => {
    child = null;
  });
}

async function stopServer() {
  const current = child;
  if (!current || current.exitCode !== null) return;
  current.kill();
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 5_000);
    current.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  child = null;
}

async function registerAgent(label: string) {
  const registration = await readJson(await fetch(`${baseUrl}/world/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `restart-${label}-${Date.now()}`, inviteCode }),
  }));
  const userId = Number(registration.agent.userId);
  const apiKey = String(registration.credential.key);
  const [user] = await getDb().select({ unionId: users.unionId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("注册 Agent 对应的用户不存在");
  const sessionToken = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
  return { apiKey, cookie: `kimi_sid=${sessionToken}` };
}

function actionFor(gameId: GameId, observation: JsonRecord): JsonRecord {
  const subPhase = observation.subPhase;
  const mySeat = Number(observation.mySeat);
  if (gameId === "superpower-race-core") {
    const racer = observation.race?.racers?.find((item: JsonRecord) => item.seat === mySeat);
    const cardId = racer?.hand?.find((id: string) => !/-d[12]$/.test(id)) ?? racer?.hand?.[0];
    if (typeof cardId !== "string") throw new Error("赛马观察中没有自己的合法牌");
    if (/-d[12]$/.test(cardId)) {
      const target = observation.race?.racers?.find((item: JsonRecord) => item.seat !== mySeat && item.finishRank == null)?.seat;
      if (typeof target !== "number") throw new Error("赛马观察中没有可供扰行的对手");
      return { type: "play", cardId, targetSeat: target };
    }
    return { type: "play", cardId };
  }
  if (gameId === "superpower-billiards-core") {
    const ball = observation.balls?.find((item: JsonRecord) => item.ownerSeat === mySeat && item.lives > 0);
    if (!ball) return { type: "ability", abilityId: "return-soul", decision: "ignore", targetBall: "doll-01" };
    if (subPhase === "ability") {
      const decision = ball.abilityId === "return-soul" ? "reflect" : ball.abilityId === "right-angle" ? "right_angle" : "phase_walk";
      return { type: "ability", abilityId: ball.abilityId, decision, targetBall: ball.id };
    }
    return { type: "strike", ballId: ball.id, angle: mySeat % 2 === 0 ? 0.2 : 2.9, power: 0.72 };
  }
  if (subPhase === "day-speech" || subPhase === "last-words") {
    return { type: "speak", text: `第 ${observation.round} 日，${mySeat + 1} 号位留下可供回放核验的公开证言。` };
  }
  if (subPhase === "day-vote") return { type: "play", cardId: "vote-abstain" };
  return { type: "play", cardId: "pass" };
}

function parseJson(value: unknown): JsonRecord {
  if (typeof value === "string") return JSON.parse(value) as JsonRecord;
  return (value ?? {}) as JsonRecord;
}

async function roomSnapshot(code: string) {
  const [row] = await getDb().select({ status: rooms.status, stateJson: rooms.stateJson }).from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!row) throw new Error(`数据库中找不到房间 ${code}`);
  const state = parseJson(row.stateJson);
  return {
    status: row.status,
    seed: state.seed ?? null,
    events: Array.isArray(state.eventLog) ? state.eventLog : [],
    stateHash: state.stateHash ?? null,
  };
}

function assertPrefix(before: JsonRecord[], after: JsonRecord[]) {
  if (after.length < before.length) throw new Error(`重启后事件前缀变短：${before.length} → ${after.length}`);
  const left = JSON.stringify(after.slice(0, before.length));
  const right = JSON.stringify(before);
  if (left !== right) throw new Error("重启后事件前缀发生改变");
}

async function runGame(gameId: GameId) {
  const agent = await registerAgent(gameId.replace(/-core$/, ""));
  const host = await trpc("room.create", { roomName: `重启验收·${gameId.replace("superpower-", "")}`, defId: gameId, autoStart: false }, agent.cookie);
  const code = String(host.code);
  const hostSeatToken = String(host.seatToken);
  const headers = { "x-api-key": agent.apiKey };
  const joined = await gateway(`/world/v1/matches/${code}/join`, { method: "POST", headers });
  const agentSeat = Number(joined.match.seatIndex);
  await trpc("room.act", { code, seatToken: hostSeatToken, action: { type: "start" } }, agent.cookie);

  let observation: JsonRecord = {};
  let hostObservation: JsonRecord = {};
  let hostSubmitted = new Set<string>();
  let agentSubmitted = new Set<string>();
  let beforeRestart: Awaited<ReturnType<typeof roomSnapshot>> | null = null;
  let afterRestart: Awaited<ReturnType<typeof roomSnapshot>> | null = null;
  let restartCompleted = false;

  const observe = async () => {
    observation = (await gateway(`/world/v1/matches/${code}/observation`, { headers })).observation;
  };
  const observeHost = async () => {
    hostObservation = await trpcQuery("room.state", { code, seatToken: hostSeatToken }, agent.cookie);
  };
  const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  await observe();
  await observeHost();
  const deadline = Date.now() + (gameId === "werewolf-12-core" ? 12 * 60_000 : 4 * 60_000);
  while (observation.status !== "finished" && Date.now() < deadline) {
    await Promise.all([observe(), observeHost()]);
    if (observation.status === "finished") break;
    if (observation.phase !== "submit") {
      await wait(250);
      continue;
    }
    const phaseKey = `${observation.round}:${observation.subPhase ?? "submit"}`;
    if (!restartCompleted) {
      if (!hostSubmitted.has(phaseKey)) {
        await trpc("room.act", { code, seatToken: hostSeatToken, action: actionFor(gameId, { ...hostObservation, mySeat: Number(hostObservation.mySeat) }) }, agent.cookie);
        hostSubmitted.add(phaseKey);
      }
      await wait(250);
      beforeRestart = await roomSnapshot(code);
      await stopServer();
      startServer();
      await waitForHealth();
      afterRestart = await roomSnapshot(code);
      assertPrefix(beforeRestart.events, afterRestart.events);
      if (beforeRestart.seed !== afterRestart.seed) throw new Error(`重启后 seed 变化：${beforeRestart.seed} → ${afterRestart.seed}`);
      restartCompleted = true;
      continue;
    }
    if (!hostSubmitted.has(phaseKey)) {
      await trpc("room.act", { code, seatToken: hostSeatToken, action: actionFor(gameId, { ...hostObservation, mySeat: Number(hostObservation.mySeat) }) }, agent.cookie);
      hostSubmitted.add(phaseKey);
    }
    if (!agentSubmitted.has(phaseKey)) {
      await observe();
      if (observation.status === "finished") break;
      const currentContext = await gateway(`/world/v1/matches/${code}/observation`, { headers });
      await gateway(`/world/v1/matches/${code}/commands`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          protocolVersion: "0.1",
          commandId: `restart-${gameId}-${phaseKey.replace(/[^a-z0-9]+/gi, "-")}-${Date.now()}`,
          contextRef: currentContext.contextRef,
          bindingId: currentContext.binding.bindingId,
          action: actionFor(gameId, { ...currentContext.observation, mySeat: agentSeat }),
        }),
      });
      agentSubmitted.add(phaseKey);
    }
    await wait(300);
  }
  await observe();
  if (observation.status !== "finished") throw new Error(`${gameId} 重启后未能在时限内终局`);
  const finalSnapshot = await roomSnapshot(code);
  if (afterRestart) assertPrefix(afterRestart.events, finalSnapshot.events);
  const logs = await getDb().select({ id: matchLogs.id, eventCount: matchLogs.eventCount }).from(matchLogs).where(eq(matchLogs.roomCode, code));
  const report = await gateway(`/world/v1/public/matches/${code}/report`);
  return {
    gameId,
    roomCode: code,
    restartCompleted,
    beforeEventCount: beforeRestart?.events.length ?? 0,
    afterRestartEventCount: afterRestart?.events.length ?? 0,
    finalEventCount: finalSnapshot.events.length,
    seedStable: beforeRestart?.seed === afterRestart?.seed,
    matchLogs: logs,
    report: {
      matchLogId: report.matchLogId,
      evidenceEventCount: report.brief?.evidenceEventCount ?? null,
      auditOk: report.narrative?.audit?.ok ?? null,
      usedFallback: report.narrative?.usedFallback ?? null,
    },
  };
}

try {
  await startServer();
  await waitForHealth();
  const results: unknown[] = [];
  for (const gameId of games) results.push(await runGame(gameId));
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
} finally {
  await stopServer();
  await getDb().$client.end();
}

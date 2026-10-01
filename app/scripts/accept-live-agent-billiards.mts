/**
 * 真实本机验收：HTTP 注册 Agent → 人类会话建短回合桌球房 →
 * Agent 通过公开 TDG-WP Gateway 入座、击杆、提交异能 → 对局结算 →
 * 核对 match_logs / world_contributions / world_epochs / 日报。
 *
 * 只输出 ID、状态和数量，不输出 API Key、日报 Token 或 session cookie。
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { users, matchLogs, worldContributions, worldEpochs } from "../db/schema";
import { env } from "../api/lib/env";
import { signSessionToken } from "../api/kimi/session";

const baseUrl = (process.env.TDG_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3010").replace(/\/$/, "");
const inviteCode = process.env.AGENT_REGISTRATION_CODE?.trim();
if (!inviteCode) throw new Error("AGENT_REGISTRATION_CODE 未配置");

type JsonRecord = Record<string, any>;

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
    throw new Error(`${response.status} ${item?.error?.json?.message ?? item?.error?.message ?? item?.message ?? body.error?.message ?? "请求失败"}`);
  }
  return body;
}

async function gateway(path: string, init: RequestInit = {}): Promise<JsonRecord> {
  return readJson(await fetch(`${baseUrl}${path}`, init));
}

async function trpc(path: string, input: JsonRecord): Promise<any> {
  const response = await fetch(`${baseUrl}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: "" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const body = await readJson(response);
  const item = Array.isArray(body) ? body[0] : body;
  if (item?.error) throw new Error(item.error.json?.message ?? item.error.message ?? "tRPC 请求失败");
  return item?.result?.data?.json ?? item?.result?.data;
}

async function authedTrpc(path: string, input: JsonRecord, cookie: string): Promise<any> {
  const response = await fetch(`${baseUrl}/api/trpc/${path}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const body = await readJson(response);
  const item = Array.isArray(body) ? body[0] : body;
  if (item?.error) throw new Error(item.error.json?.message ?? item.error.message ?? "tRPC 请求失败");
  return item?.result?.data?.json ?? item?.result?.data;
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 350,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`等待状态超时（${timeoutMs}ms）`);
}

const registration = await readJson(await fetch(`${baseUrl}/world/v1/agents`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: `live-billiards-${Date.now()}`, inviteCode }),
}));
const agentId = Number(registration.agent.agentId);
const userId = Number(registration.agent.userId);
const apiKey = String(registration.credential.key);
const reportToken = String(registration.credential.reportToken);
const gatewayHeaders = { "x-api-key": apiKey };

const db = getDb();
const [user] = await db
  .select({ unionId: users.unionId })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
if (!user) throw new Error("注册 Agent 对应的用户不存在");

const sessionToken = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
const sessionCookie = `kimi_sid=${sessionToken}`;

const def = await authedTrpc("game.createDef", {
  name: `终焉·巫蛊娃娃实时烟测-${Date.now()}`,
  template: "superpowerBilliards",
  seats: 2,
  params: {
    rounds: 3,
    balls: 6,
    pockets: 4,
    lives: 2,
    pocketPenalty: 8,
    hitScore: 15,
    comboBonus: 10,
  },
  entryFee: { suit: "spade", amount: 0 },
  rewards: { winner: 80, runnerUp: 40, participation: 10 },
  submitWindowSec: 10,
}, sessionCookie);

const created = await authedTrpc("room.create", {
  roomName: "终焉·异能桌球真实闭环烟测",
  defId: def.id,
  autoStart: false,
}, sessionCookie);
const code = String(created.code);
const hostSeatToken = String(created.seatToken);

const joined = await gateway(`/world/v1/matches/${code}/join`, {
  method: "POST",
  headers: gatewayHeaders,
});
const seatIndex = Number(joined.match.seatIndex);
const rulebook = await gateway(`/world/v1/matches/${code}/rulebook`, { headers: gatewayHeaders });
const rulebookClauseCount = Array.isArray(rulebook.rulebook?.clauses) ? rulebook.rulebook.clauses.length : 0;

await authedTrpc("room.act", {
  code,
  seatToken: hostSeatToken,
  action: { type: "start" },
}, sessionCookie);

let bindingId = "";
let contextRef = "";
let observation: any;
async function observe() {
  const response = await gateway(`/world/v1/matches/${code}/observation`, { headers: gatewayHeaders });
  observation = response.observation;
  bindingId = String(response.binding.bindingId);
  contextRef = String(response.contextRef);
  return response;
}
await observe();
let commandCount = 0;
let abilityAccepted = 0;

for (let round = 0; round < 3 && observation.status !== "finished"; round += 1) {
  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || (observation.phase === "submit" && observation.subPhase === "strike");
  }, 20_000);
  if (observation.status === "finished") break;

  const ownBalls = observation.balls.filter((item: any) => item.ownerSeat === seatIndex && item.lives > 0);
  const ball = ownBalls.find((item: any) => item.abilityId === "phase-walk") ?? ownBalls[0] ?? observation.balls[0];
  const strike = await gateway(`/world/v1/matches/${code}/commands`, {
    method: "POST",
    headers: { ...gatewayHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      protocolVersion: "0.1",
      commandId: `live-smoke-strike-${round}-${Date.now()}`,
      contextRef,
      bindingId,
      action: { type: "strike", ballId: ball.id, angle: 0.32 + round * 0.21, power: 0.62 },
    }),
  });
  commandCount += 1;
  observation = strike.observation;

  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || (observation.phase === "submit" && observation.subPhase === "ability");
  }, 20_000);
  if (observation.status === "finished") break;

  const target = observation.balls.find((item: any) => item.id === ball.id && item.ownerSeat === seatIndex && item.lives > 0)
    ?? observation.balls.find((item: any) => item.ownerSeat === seatIndex && item.lives > 0)
    ?? ball;
  const decisions: Record<string, string> = {
    "return-soul": "reflect",
    "right-angle": "right_angle",
    "phase-walk": "phase_walk",
  };
  const ability = await gateway(`/world/v1/matches/${code}/commands`, {
    method: "POST",
    headers: { ...gatewayHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      protocolVersion: "0.1",
      commandId: `live-smoke-ability-${round}-${Date.now()}`,
      contextRef,
      bindingId,
      action: {
        type: "ability",
        abilityId: target.abilityId,
        decision: decisions[target.abilityId] ?? "ignore",
        targetBall: target.id,
      },
    }),
  });
  commandCount += 1;
  observation = ability.observation;
  const ownResolution = (observation.lastReveal?.abilities ?? []).find((item: any) => item.seat === seatIndex);
  if (ownResolution?.accepted) abilityAccepted += 1;

  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || observation.round > round + 1;
  }, 20_000);
}

await waitFor(async () => {
  await observe();
  return observation.status === "finished";
}, 30_000);

// 终局返回 finished 只代表房间内核完成；世界贡献由 outbox 消费器异步投影。
// 验收必须等到 Agent 的 participantRef 真正出现，不能把“已入 outbox”算作世界已更新。
await waitFor(async () => {
  const rows = await db
    .select({ id: worldContributions.id })
    .from(worldContributions)
    .where(eq(worldContributions.participantRef, `agent:${agentId}`))
    .limit(1);
  return rows.length > 0;
}, 15_000);

const logs = await db.select({ id: matchLogs.id }).from(matchLogs).where(eq(matchLogs.roomCode, code));
const contributions = await db
  .select({ id: worldContributions.id })
  .from(worldContributions)
  .where(eq(worldContributions.participantRef, `agent:${agentId}`));
const epochs = await db.select({ id: worldEpochs.id }).from(worldEpochs).where(eq(worldEpochs.worldId, "tdg-world"));
const report = await gateway(`/world/v1/agents/${agentId}/report?token=${encodeURIComponent(reportToken)}`);
const world = await gateway("/world/v1/world/state");

console.log(JSON.stringify({
  agentId,
  defId: def.id,
  roomCode: code,
  seatIndex,
  rulebookClauseCount,
  joinStatus: "committed",
  startedStatus: "committed",
  commandCount,
  abilityAccepted,
  finalStatus: observation.status,
  finalRound: observation.round,
  matchLogCount: logs.length,
  worldContributionCountForAgent: contributions.length,
  worldEpochCount: epochs.length,
  reportKeys: Object.keys(report),
  worldStateStatus: world.world.status,
}, null, 2));
process.exit(0);

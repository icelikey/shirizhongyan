/**
 * 真实本机验收：HTTP 注册 Agent → 真人会话建少数派票决房 →
 * Agent 与真人各提交三轮 → 对局结算 → 核对世界贡献、纪元和日报。
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
    throw new Error(
      `${response.status} ${item?.error?.json?.message ?? item?.error?.message ?? item?.message ?? body.error?.message ?? "请求失败"}`,
    );
  }
  return body;
}

async function gateway(path: string, init: RequestInit = {}): Promise<JsonRecord> {
  return readJson(await fetch(`${baseUrl}${path}`, init));
}

async function trpc(path: string, input: JsonRecord, cookie = ""): Promise<any> {
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

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 300) {
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
  body: JSON.stringify({ name: `live-poll-${Date.now()}`, inviteCode }),
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

const def = await trpc("game.createDef", {
  name: `终焉·红眼病实时烟测-${Date.now()}`,
  template: "pollDuel",
  seats: 2,
  params: { rounds: 3, choices: ["红", "蓝"], payoff: "minority-wins", scoreWin: 2 },
  entryFee: { suit: "heart", amount: 0 },
  rewards: { winner: 50, runnerUp: 25, participation: 5 },
  submitWindowSec: 10,
}, sessionCookie);

const created = await trpc("room.create", {
  roomName: "终焉·少数派票决真实闭环烟测",
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

await trpc("room.act", { code, seatToken: hostSeatToken, action: { type: "start" } }, sessionCookie);

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
for (let round = 0; round < 3 && observation.status !== "finished"; round += 1) {
  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || observation.phase === "submit";
  }, 20_000);
  if (observation.status === "finished") break;

  const agentChoice = round % 2;
  const agentSubmit = await gateway(`/world/v1/matches/${code}/commands`, {
    method: "POST",
    headers: { ...gatewayHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      protocolVersion: "0.1",
      commandId: `live-poll-agent-${round}-${Date.now()}`,
      contextRef,
      bindingId,
      action: { type: "choose", choice: agentChoice },
    }),
  });
  commandCount += 1;
  observation = agentSubmit.observation;

  const humanChoice = agentChoice === 0 ? 1 : 0;
  await trpc("room.act", {
    code,
    seatToken: hostSeatToken,
    action: { type: "choose", choice: humanChoice },
  }, sessionCookie);
  commandCount += 1;

  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || observation.round > round + 1;
  }, 20_000);
}

await waitFor(async () => {
  await observe();
  return observation.status === "finished";
}, 30_000);

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
  finalStatus: observation.status,
  finalRound: observation.round,
  matchLogCount: logs.length,
  worldContributionCountForAgent: contributions.length,
  worldEpochCount: epochs.length,
  reportKeys: Object.keys(report),
  worldStateStatus: world.world.status,
}, null, 2));
process.exit(0);

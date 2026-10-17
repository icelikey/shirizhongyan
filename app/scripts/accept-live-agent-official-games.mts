/**
 * 官方游戏真实闭环验收：7 个公开游戏 + 4 个 Agent-only 暗局变体。
 *
 * 普通/混合游戏走真人会话建房，Agent-only 游戏走 Gateway 自主建房并入座；
 * 两条路径随后统一进入：开局 → 读取自己的观察并行动 → 终局 →
 * Agent 读取自己的观察并行动 → 终局 → match_logs / 公开战报核对。
 * 只输出房间、状态、事件数量和报告审计状态，不输出 API Key 或 cookie。
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../api/queries/connection";
import { matchLogs, users } from "../db/schema";
import { env } from "../api/lib/env";
import { signSessionToken } from "../api/kimi/session";

const baseUrl = (process.env.TDG_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3010").replace(/\/$/, "");
const inviteCode = process.env.AGENT_REGISTRATION_CODE?.trim();
if (!inviteCode) throw new Error("AGENT_REGISTRATION_CODE 未配置");

type JsonRecord = Record<string, any>;
type GameId =
  | "guess-core"
  | "guess-mille-core"
  | "guess-dark-core"
  | "poll-duel-core"
  | "poll-dark-core"
  | "pirate-gold-core"
  | "flytease-core"
  | "flytease-dark-core"
  | "superpower-race-core"
  | "superpower-billiards-core"
  | "werewolf-12-core";

const selected = (process.env.TDG_SMOKE_GAMES?.split(",").map(item => item.trim()).filter(Boolean) ?? []) as GameId[];
const games: GameId[] = selected.length > 0
  ? selected
  : [
      "guess-core",
      "guess-mille-core",
      "guess-dark-core",
      "poll-duel-core",
      "poll-dark-core",
      "pirate-gold-core",
      "flytease-core",
      "flytease-dark-core",
      "superpower-race-core",
      "superpower-billiards-core",
      "werewolf-12-core",
    ];

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

async function gateway(path: string, init: RequestInit = {}): Promise<JsonRecord> {
  return readJson(await fetch(`${baseUrl}${path}`, init));
}

async function trpc(path: string, input: JsonRecord, cookie: string): Promise<any> {
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

async function trpcQuery(path: string, input: JsonRecord, cookie: string): Promise<any> {
  const encodedInput = encodeURIComponent(JSON.stringify({ "0": { json: input } }));
  const response = await fetch(`${baseUrl}/api/trpc/${path}?batch=1&input=${encodedInput}`, {
    method: "GET",
    headers: { cookie },
  });
  const body = await readJson(response);
  const item = Array.isArray(body) ? body[0] : body;
  if (item?.error) throw new Error(item.error.json?.message ?? item.error.message ?? "tRPC 查询失败");
  return item?.result?.data?.json ?? item?.result?.data;
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`等待状态超时（${timeoutMs}ms）`);
}

async function registerAgent(label: string, needsSession = true) {
  const registration = await readJson(await fetch(`${baseUrl}/world/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: `official-${label}-${Date.now()}`, inviteCode }),
  }));
  const agentId = Number(registration.agent.agentId);
  const userId = Number(registration.agent.userId);
  const apiKey = String(registration.credential.key);
  if (!needsSession) {
    return { agentId, userId, apiKey, cookie: "" };
  }
  const [user] = await getDb()
    .select({ unionId: users.unionId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new Error("注册 Agent 对应的用户不存在");
  const sessionToken = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
  return { agentId, userId, apiKey, cookie: `kimi_sid=${sessionToken}` };
}

function actionFor(gameId: GameId, observation: JsonRecord): JsonRecord | null {
  const subPhase = observation.subPhase;
  const mySeat = Number(observation.mySeat);
  const round = Number(observation.round ?? 0);

  if (gameId === "guess-core" || gameId === "guess-mille-core" || gameId === "guess-dark-core") {
    // 0–100 是三个 numberGuess 官方变体的共同合法区间。
    return { type: "submit", value: 50 + ((mySeat * 7 + round) % 11) };
  }

  if (gameId === "poll-duel-core" || gameId === "poll-dark-core") {
    return { type: "choose", choice: mySeat % 2 };
  }

  if (gameId === "pirate-gold-core") {
    const proposer = Number(observation.currentProposer ?? 0);
    if (subPhase === "propose" && mySeat === proposer) {
      const alive = Array.isArray(observation.aliveSeats)
        ? observation.aliveSeats.map(Number)
        : [0, 1, 2, 3, 4];
      const seatCount = Array.isArray(observation.seats)
        ? observation.seats.length
        : Math.max(5, ...alive.map(seat => seat + 1));
      const coins = Number(observation.coins ?? 20);
      const allocation = new Array(seatCount).fill(0);
      const needExtra = Math.max(0, Math.ceil(alive.length / 2) - 1);
      const others = alive.filter(seat => seat !== mySeat);
      for (let i = 0; i < needExtra && i < others.length; i++) allocation[others[i]] = 1;
      allocation[mySeat] = Math.max(0, coins - needExtra);
      return { type: "propose", allocation };
    }
    if (subPhase === "propose" && mySeat !== proposer) return null;
    if (subPhase === "vote" && mySeat === proposer) return null;
    if (subPhase === "vote") {
      const allocation = observation.pending?.allocation;
      return {
        type: "vote",
        approve: Array.isArray(allocation) && Number(allocation[mySeat] ?? 0) > 0,
      };
    }
    return null;
  }

  if (gameId === "flytease-core" || gameId === "flytease-dark-core") {
    const cardCount = Math.max(1, Number(observation.fly?.cardCount ?? 64));
    return { type: "choose", choice: mySeat % cardCount };
  }

  if (gameId === "superpower-race-core") {
    const racer = observation.race?.racers?.find((item: JsonRecord) => item.seat === mySeat);
    // 赛马的扰行牌必须带 targetSeat；优先选一张无需目标的牌，
    // 只有手里全是扰行牌时才补一个仍在赛道上的对手。
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
    return { type: "speak", text: `第 ${round} 日，${mySeat + 1} 号位留下可供回放核验的公开证言。` };
  }
  if (subPhase === "day-vote") return { type: "play", cardId: "vote-abstain" };
  return { type: "play", cardId: "pass" };
}

async function runGame(gameId: GameId) {
  const label = gameId.replace(/-core$/, "");
  const agentOnly = gameId === "guess-mille-core"
    || gameId === "guess-dark-core"
    || gameId === "poll-dark-core"
    || gameId === "flytease-dark-core";
  const agent = await registerAgent(label, !agentOnly);
  const headers = { "x-api-key": agent.apiKey };

  let code = "";
  let seatIndex = -1;
  let hostSeatToken: string | null = null;
  let observation: JsonRecord = {};
  let hostObservation: JsonRecord = {};

  if (agentOnly) {
    const created = await gateway("/world/v1/matches", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        gameId,
        roomName: `真实验收 · ${label}`,
      }),
    });
    code = String(created.match.code);
    seatIndex = Number(created.binding.seatIndex ?? created.observation.mySeat);
  } else {
    const codeResult = await trpc(
      "room.create",
      { roomName: `真实验收 · ${label}`, defId: gameId, autoStart: false },
      agent.cookie,
    );
    code = String(codeResult.code);
    hostSeatToken = String(codeResult.seatToken);
    const joined = await gateway(`/world/v1/matches/${code}/join`, { method: "POST", headers });
    seatIndex = Number(joined.match.seatIndex);
    await trpc(
      "room.act",
      { code, seatToken: hostSeatToken, action: { type: "start" } },
      agent.cookie,
    );
  }

  // 只由本次脚本记录当前子阶段的提交，不能使用 observation.seats[].submitted：
  // 服务端的该字段可能表示本轮之前任意子阶段已经提交，桌球的 strike 和
  // ability 因而会被错误地当成同一个阶段。
  let submittedPhaseKey = "";
  let submittedHostPhaseKey = "";
  let commandCount = 0;

  async function observe() {
    const response = await gateway(`/world/v1/matches/${code}/observation`, { headers });
    observation = response.observation;
    return response;
  }

  async function observeHost() {
    if (agentOnly) {
      hostObservation = observation;
      return hostObservation;
    }
    hostObservation = await trpcQuery(
      "room.state",
      { code, seatToken: hostSeatToken },
      agent.cookie,
    );
    return hostObservation;
  }

  async function submitAgentAction(action: JsonRecord) {
    const current = await observe();
    const response = await gateway(`/world/v1/matches/${code}/commands`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        protocolVersion: "0.1",
        commandId: `official-${label}-${String(observation.round ?? 0)}-${String(observation.subPhase ?? "submit")}-${Date.now()}`,
        contextRef: String(current.contextRef),
        bindingId: String(current.binding.bindingId),
        action,
      }),
    });
    observation = response.observation ?? observation;
    commandCount += 1;
    return response;
  }

  await observe();
  await observeHost();
  if (agentOnly && observation.status === "waiting") {
    await submitAgentAction({ type: "start" });
  }
  await waitFor(async () => {
    await observe();
    return observation.status === "finished" || observation.phase === "submit";
  }, 20_000);

  const configuredDeadlineMinutes = Number(process.env.TDG_SMOKE_DEADLINE_MINUTES ?? 0);
  const totalRounds = Math.max(1, Number(observation.totalRounds ?? 1));
  const submitWindowSec = Math.max(1, Number(observation.submitWindowSec ?? 10));
  const revealBufferSec = Math.max(5, totalRounds * 5);
  const calculatedDeadlineMinutes = Math.ceil(
    (totalRounds * submitWindowSec + revealBufferSec + 60) / 60,
  );
  const deadlineMinutes = configuredDeadlineMinutes > 0
    ? configuredDeadlineMinutes
    : Math.max(gameId === "werewolf-12-core" ? 12 : 3, calculatedDeadlineMinutes);
  const deadline = Date.now() + deadlineMinutes * 60_000;
  while (observation.status !== "finished" && Date.now() < deadline) {
    await observe();
    await observeHost();
    if (observation.status === "finished") break;
    if (observation.phase !== "submit") {
      await new Promise(resolve => setTimeout(resolve, 350));
      continue;
    }

    const phaseKey = `${observation.round}:${observation.subPhase ?? "submit"}`;
    if (!agentOnly && phaseKey !== submittedHostPhaseKey) {
      const hostAction = actionFor(gameId, { ...hostObservation, mySeat: Number(hostObservation.mySeat) });
      if (hostAction) {
        await trpc(
          "room.act",
          { code, seatToken: hostSeatToken, action: hostAction },
          agent.cookie,
        );
      }
      submittedHostPhaseKey = phaseKey;
    }

    if (phaseKey !== submittedPhaseKey) {
      await observe();
      if (observation.status === "finished") break;
      const action = actionFor(gameId, { ...observation, mySeat: seatIndex });
      submittedPhaseKey = phaseKey;
      if (action) await submitAgentAction(action);
    }

    await new Promise(resolve => setTimeout(resolve, 350));
  }

  await waitFor(async () => {
    await observe();
    return observation.status === "finished";
  }, 20_000);

  const logs = agentOnly
    ? []
    : await getDb()
      .select({ id: matchLogs.id, eventCount: matchLogs.eventCount })
      .from(matchLogs)
      .where(eq(matchLogs.roomCode, code));
  const report = await gateway(`/world/v1/public/matches/${code}/report`);
  return {
    gameId,
    agentId: agent.agentId,
    roomCode: code,
    seatIndex,
    commandCount,
    finalStatus: observation.status,
    finalRound: observation.round,
    matchLogs: logs,
    report: {
      status: report.narrative?.audit?.ok === true ? "verified" : "verified-fallback",
      matchLogId: report.matchLogId,
      usedFallback: report.narrative?.usedFallback ?? null,
      auditOk: report.narrative?.audit?.ok ?? null,
      auditErrors: report.narrative?.audit?.errors ?? [],
      evidenceEventCount: report.brief?.evidenceEventCount ?? null,
    },
  };
}

const results: unknown[] = [];
try {
  for (const gameId of games) {
    results.push(await runGame(gameId));
  }
  console.log(JSON.stringify({ baseUrl, results }, null, 2));
} finally {
  await closeDb();
}

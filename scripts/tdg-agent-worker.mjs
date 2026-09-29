#!/usr/bin/env node

/**
 * 终焉外部 Agent 常驻 Worker
 *
 * 这个进程只依赖 Node.js 20 的 fetch，不读取网页 DOM：
 * 发现牌局 → 幂等入座 → 读取脱敏观测 → 选择合法动作 → 写入活动 → 生成日报。
 * 它可以在玩家本机、云主机或 GitHub Codespace 独立运行。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "../pi-tdg-agent/src/memory.mjs";

const DEFAULT_INTERVAL_MS = 5000;
const VERSION = "0.1.0";

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--once") result.once = true;
    else if (token.startsWith("--")) {
      const key = token.slice(2).replaceAll("-", "_");
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        result[key] = next;
        i += 1;
      } else result[key] = true;
    } else result._.push(token);
  }
  return result;
}

function credentialPath(args) {
  return resolve(
    args.config || process.env.TDG_AGENT_CONFIG || join(homedir(), ".tdg", "agent.json"),
  );
}

function loadCredential(args) {
  const path = credentialPath(args);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveCredential(args, credential) {
  const path = credentialPath(args);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(credential, null, 2)}\n`, "utf8");
  return path;
}

function memoryPath(args) {
  return resolve(
    args.memory || process.env.TDG_AGENT_MEMORY || join(homedir(), ".tdg", "agent-memory.json"),
  );
}

function required(value, label) {
  if (!value || !String(value).trim()) throw new Error(`缺少 ${label}`);
  return String(value).trim();
}

function normalizeBaseUrl(raw) {
  const url = new URL(required(raw, "TDG_BASE_URL 或 --base-url"));
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/world\/v1$/i.test(path)) url.pathname = path;
  else url.pathname = `${path}/world/v1`.replace(/^\/+/, "/");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function redact(error) {
  return String(error?.message || error || "请求失败").replace(/tdg_[A-Za-z0-9_-]+/g, "tdg_[已隐藏]");
}

async function jsonRequest(url, { key = "", method = "GET", body } = {}) {
  const headers = { accept: "application/json" };
  if (key) headers["x-api-key"] = key;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { raw: text.slice(0, 400) }; }
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `HTTP ${response.status}`);
  return payload;
}

async function registerIfNeeded(args, config) {
  if (config?.key && config?.agentId) return config;
  const baseUrl = normalizeBaseUrl(args.base_url || process.env.TDG_BASE_URL || config?.baseUrl);
  const name = required(args.name || process.env.TDG_AGENT_NAME || config?.name, "Agent 名称");
  const inviteCode = required(args.invite_code || process.env.TDG_INVITE_CODE, "TDG_INVITE_CODE");
  const data = await jsonRequest(`${baseUrl}/agents`, {
    method: "POST",
    body: { name, inviteCode },
  });
  const credential = data.credential || {};
  const saved = {
    baseUrl,
    key: credential.key,
    reportToken: credential.reportToken,
    reportUrl: credential.reportUrl,
    agentId: data.agent?.agentId,
    userId: data.agent?.userId,
    name: data.agent?.name || name,
    createdAt: new Date().toISOString(),
  };
  if (!saved.key || !saved.agentId) throw new Error("注册响应缺少 Agent 凭证");
  saveCredential(args, saved);
  console.log(`已注册 Agent「${saved.name}」，凭证已保存到本机配置；不会在日志中打印密钥。`);
  return saved;
}

function endpoint(config) {
  return normalizeBaseUrl(config.baseUrl || process.env.TDG_BASE_URL);
}

async function activity(config, kind, title, detail, payload = {}) {
  try {
    await jsonRequest(`${endpoint(config)}/agents/${config.agentId}/activity`, {
      key: config.key,
      method: "POST",
      body: { kind, title, detail, payload, occurredAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error(`活动写入失败：${redact(error)}`);
  }
}

function viewOf(payload) {
  return payload?.observation || payload;
}

async function matches(config) {
  const data = await jsonRequest(`${endpoint(config)}/matches`, { key: config.key });
  return data.matches || [];
}

async function world(config) {
  return jsonRequest(`${endpoint(config)}/agents/${config.agentId}/world`, { key: config.key });
}

async function recordWorldSighting(config, args, payload, memory) {
  const intel = payload?.worldIntel;
  const sightings = Array.isArray(intel?.sightings) ? intel.sightings : [];
  const sighting = sightings[sightings.length - 1];
  const sightingKey = `${new Date().toISOString().slice(0, 10)}:${sighting?.id || `floor-${intel?.floor || 1}`}`;
  if (config.lastWorldSightingKey === sightingKey || memory.hasEvent(sightingKey)) return sighting;
  const detail = sighting?.text || intel?.nextInstruction || "影从读取了当前世界层的公开见闻。";
  await activity(config, "world-sighting", sighting ? `见闻 · ${sighting.title}` : "见闻 · 塔底回声", sighting?.text || intel?.nextInstruction || "影从读取了当前世界层的公开见闻。", {
    source: intel?.source || "终焉世界公开见闻",
    sightingId: sighting?.id || null,
    realm: sighting?.realm || null,
    floor: intel?.floor || null,
    dailyDarkMatches: intel?.dailyDarkMatches || null,
  });
  memory.remember({
    kind: "semantic",
    content: detail,
    source: intel?.source || "终焉世界公开见闻",
    eventId: sightingKey,
    confidence: sighting ? 0.85 : 0.55,
    visibility: "public",
    tags: ["world-sighting", `floor:${intel?.floor || 1}`],
  });
  config.lastWorldSightingKey = sightingKey;
  saveCredential(args, config);
  return sighting;
}

async function joinMatch(config, code) {
  return jsonRequest(`${endpoint(config)}/matches/${encodeURIComponent(code)}/join`, {
    key: config.key,
    method: "POST",
  });
}

async function observe(config, code) {
  return jsonRequest(`${endpoint(config)}/matches/${encodeURIComponent(code)}/observation`, { key: config.key });
}

async function act(config, code, current, action) {
  return jsonRequest(`${endpoint(config)}/matches/${encodeURIComponent(code)}/commands`, {
    key: config.key,
    method: "POST",
    body: {
      protocolVersion: "0.1",
      commandId: randomUUID(),
      contextRef: current.contextRef,
      bindingId: current.binding?.bindingId,
      action,
    },
  });
}

function chooseAction(match, view) {
  const me = view.seats?.find((seat) => seat.index === view.mySeat);
  if (!me || me.submitted) return null;
  if (view.status === "waiting") return view.mySeat === 0 ? { type: "start" } : null;
  if (view.status !== "playing") return null;

  if (match.template === "numberGuess") {
    const round = Number(view.round || 1);
    const history = Array.isArray(view.history) ? view.history.length : 0;
    const value = Math.max(0, Math.min(100, Math.round(50 - ((round + history + (view.mySeat || 0)) % 7) * 4)));
    return { type: "submit", value };
  }
  if (match.template === "pollDuel") {
    const choices = Array.isArray(view.choices) && view.choices.length ? view.choices.length : 2;
    return { type: "choose", choice: (Number(view.round || 1) + (view.mySeat || 0)) % choices };
  }
  if (match.template === "pirateGold") {
    if (view.phase === "propose" && view.currentProposer === view.mySeat) {
      const allocation = new Array(view.seats?.length || match.seats).fill(0);
      const alive = Array.isArray(view.aliveSeats) ? view.aliveSeats : allocation.map((_, index) => index);
      const others = alive.filter((seat) => seat !== view.mySeat);
      let remaining = Number(view.coins || 20);
      for (const seat of others.slice(0, Math.max(0, Math.ceil(alive.length / 2) - 1))) {
        allocation[seat] = 1;
        remaining -= 1;
      }
      allocation[view.mySeat] = Math.max(0, remaining);
      return { type: "propose", allocation };
    }
    if (view.phase === "vote" && view.pending && !view.pending.voted?.includes(view.mySeat)) {
      return { type: "vote", approve: Number(view.pending.allocation?.[view.mySeat] || 0) > 0 };
    }
    return null;
  }
  if (match.template === "flyTease") {
    const count = Math.max(1, Number(view.fly?.cardCount || 1));
    return { type: "choose", choice: (Number(view.round || 1) + (view.mySeat || 0)) % count };
  }
  if (match.template === "superpowerBilliards") {
    const ownBalls = (Array.isArray(view.balls) ? view.balls : [])
      .filter((ball) => ball.ownerSeat === view.mySeat && ball.lives > 0 && !ball.pocketed);
    const ownBall = ownBalls[0];
    if (!ownBall) return null;

    if (view.subPhase === "strike") {
      const target = (Array.isArray(view.balls) ? view.balls : [])
        .filter((ball) => ball.ownerSeat !== view.mySeat && ball.lives > 0 && !ball.pocketed)
        .sort((a, b) => Math.hypot(a.x - ownBall.x, a.y - ownBall.y) - Math.hypot(b.x - ownBall.x, b.y - ownBall.y))[0];
      const angle = target ? Math.atan2(target.y - ownBall.y, target.x - ownBall.x) : (view.mySeat % 2 ? Math.PI : 0);
      return { type: "strike", ballId: ownBall.id, angle, power: 0.72 };
    }

    if (view.subPhase === "ability") {
      const decision = ownBall.abilityId === "return-soul"
        ? "reflect"
        : ownBall.abilityId === "right-angle"
          ? "right_angle"
          : "phase_walk";
      return {
        type: "ability",
        abilityId: ownBall.abilityId,
        decision,
        targetBall: ownBall.id,
      };
    }
  }
  return null;
}

async function runCycle(config, args, memory) {
  const worldPayload = await world(config);
  const sighting = await recordWorldSighting(config, args, worldPayload, memory);
  const requestedCode = args.room || process.env.TDG_MATCH_CODE || config.roomCode;
  let roomList = await matches(config);
  if (requestedCode) roomList = roomList.filter((room) => room.code === String(requestedCode).toUpperCase());
  if (!roomList.length) {
    await activity(config, "exploration", "巡视星网", "当前没有可加入的公开牌局；已读取并记录当前层世界见闻。", { rooms: 0, sightingId: sighting?.id || null, dailyDarkMatches: worldPayload?.worldIntel?.dailyDarkMatches || null });
    return { status: "idle", rooms: 0, dailyDarkMatches: worldPayload?.worldIntel?.dailyDarkMatches?.played || 0 };
  }

  let selected = null;
  let joined = null;
  for (const candidate of roomList) {
    try {
      joined = await joinMatch(config, candidate.code);
      selected = candidate;
      break;
    } catch (error) {
      if (requestedCode) throw error;
    }
  }
  if (!selected || !joined) {
    await activity(config, "exploration", "等待牌局", "已发现牌局，但当前没有可入座席位。", { rooms: roomList.length });
    return { status: "waiting", rooms: roomList.length };
  }

  if (config.roomCode !== selected.code || config.seatIndex !== joined.match?.seatIndex) {
    config.roomCode = selected.code;
    config.seatIndex = joined.match?.seatIndex ?? joined.seatIndex ?? null;
    saveCredential(args, config);
  }
  const current = await observe(config, selected.code);
  const view = viewOf(current);
  const action = chooseAction(selected, view);
  if (action) {
    const response = await act(config, selected.code, current, action);
    memory.remember({
      kind: "working",
      content: `在 ${selected.gameName || selected.roomName} 提交 ${action.type} 动作；当前回合 ${view.round || 1}。`,
      source: "worker.strategy",
      eventId: `command:${selected.code}:${view.contextRef || view.round || Date.now()}`,
      confidence: 0.6,
      visibility: "private",
      tags: ["strategy", selected.template || "unknown"],
    });
    await activity(config, "strategy", `${selected.gameName || selected.roomName} · 自主决策`, `Worker 提交了 ${action.type} 动作。`, {
      code: selected.code,
      gameName: selected.gameName || selected.roomName,
      template: selected.template,
      action,
      round: view.round,
    });
    const next = viewOf(response);
    if (next.status === "finished") {
      const won = next.winner === view.mySeat || next.rankings?.[0]?.seat === view.mySeat;
      memory.remember({
        kind: "episodic",
        content: `在 ${selected.gameName || selected.roomName} 完成一局，结果为${won ? "胜出" : "未胜"}。`,
        source: "gateway.match.settled",
        eventId: `match:${selected.code}:${next.matchId || next.finishedAt || Date.now()}`,
        confidence: 1,
        visibility: "private",
        tags: ["match", selected.template || "unknown", won ? "victory" : "loss"],
      });
      await activity(config, won ? "victory" : "settlement", won ? "牌局胜出" : "牌局结算", `在 ${selected.gameName || selected.roomName} 完成一局。`, { code: selected.code, gameName: selected.gameName, won });
      config.roomCode = null;
      config.seatIndex = null;
      saveCredential(args, config);
      return { status: "finished", code: selected.code, won };
    }
    return { status: "acted", code: selected.code, action: action.type };
  }
  if (view.status === "finished") {
    config.roomCode = null;
    config.seatIndex = null;
    saveCredential(args, config);
    return { status: "finished", code: selected.code };
  }
  return { status: view.status || "watching", code: selected.code, round: view.round };
}

function reportText(report) {
  const stats = report?.report?.stats || {};
  const intel = report?.snapshot?.worldIntel || report?.worldIntel || {};
  const sightings = Array.isArray(intel.sightings) ? intel.sightings : [];
  const sighting = sightings[sightings.length - 1];
  const darkMatches = stats.darkMatches ?? intel.dailyDarkMatches?.played ?? 0;
  const coi = stats.coi || {};
  const usage = coi.usage || {};
  const budgetSummary = Array.isArray(coi.budgets)
    ? coi.budgets.map((item) => {
      const budget = item?.budget || {};
      return `观察 ${budget.observationsPerDay ?? 0}/日 · 行动 ${budget.actionsPerDay ?? 0}/日 · 外部请求 ${budget.externalRequestsPerDay ?? 0}/日`;
    }).join("；")
    : "暂无预算信息";
  return [
    "终焉 · Agent 每日简报",
    report?.report?.summary || "影从今日尚无新记录。",
    `行动 ${stats.actions || 0} · 牌局 ${stats.matches || 0} · 胜场 ${stats.victories || 0}`,
    `黑暗对局 ${darkMatches}/3 · 尚欠 ${Math.max(0, 3 - darkMatches)} 场`,
    stats.games?.length ? `涉足：${stats.games.join("、")}` : "涉足：暂无",
    sighting ? `今日见闻：${sighting.title} · ${sighting.text}` : "今日见闻：暂无",
    `CoI 授权 ${coi.grants || 0} 项 · 今日观察 ${usage.observation || 0} · 今日动作 ${usage.action || 0} · 今日外部请求 ${usage.external_request || 0}`,
    `当前预算：${budgetSummary}`,
  ].join("\n");
}

async function sendDailyReport(config, memory) {
  const webhook = process.env.TDG_REPORT_WEBHOOK_URL;
  if (!webhook) return;
  const report = await jsonRequest(`${endpoint(config)}/agents/${config.agentId}/report`, { key: config.key });
  const text = reportText(report);
  memory.remember({
    kind: "working",
    content: `今日简报已生成：${report?.report?.summary || "暂无新记录"}`,
    source: "gateway.agent.report",
    eventId: `daily-report:${new Date().toISOString().slice(0, 10)}`,
    confidence: 1,
    visibility: "private",
    tags: ["daily-report"],
  });
  const channel = String(process.env.TDG_REPORT_CHANNEL || "feishu").toLowerCase();
  const body = channel === "wecom"
    ? { msgtype: "text", text: { content: text } }
    : { msg_type: "text", content: { text } };
  await jsonRequest(webhook, { method: "POST", body });
  console.log(`日报已推送至 ${channel === "wecom" ? "企业微信" : "飞书"}。`);
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(`终焉 Agent Worker v${VERSION}\n\nnode scripts/tdg-agent-worker.mjs --base-url https://your-domain --once\n\n环境变量：TDG_BASE_URL、TDG_AGENT_KEY、TDG_AGENT_NAME、TDG_INVITE_CODE、TDG_INTERVAL_MS、TDG_AGENT_MEMORY、TDG_REPORT_CHANNEL、TDG_REPORT_WEBHOOK_URL`);
    return;
  }
  let config = loadCredential(args) || {};
  if (process.env.TDG_AGENT_KEY && !config.key) config.key = process.env.TDG_AGENT_KEY;
  config.baseUrl = normalizeBaseUrl(args.base_url || process.env.TDG_BASE_URL || config.baseUrl);
  if (!config.key) config = await registerIfNeeded(args, config);
  if (!config.baseUrl) config.baseUrl = normalizeBaseUrl(args.base_url || process.env.TDG_BASE_URL || config.baseUrl);
  const memory = new MemoryStore({ path: memoryPath(args) });
  const interval = Math.max(1000, Number(args.interval || process.env.TDG_INTERVAL_MS || DEFAULT_INTERVAL_MS));
  let lastReportDate = "";
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });

  do {
    try {
      const result = await runCycle(config, args, memory);
      console.log(`探索 ${result.status}${result.code ? ` · ${result.code}` : ""}${result.action ? ` · ${result.action}` : ""}`);
      const reportDate = new Date().toISOString().slice(0, 10);
      if (reportDate !== lastReportDate && process.env.TDG_REPORT_WEBHOOK_URL) {
        await sendDailyReport(config, memory);
        lastReportDate = reportDate;
      }
    } catch (error) {
      console.error(`Worker 本轮暂停：${redact(error)}`);
    }
    if (args.once || stopped) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, interval));
  } while (!stopped);
}

main().catch((error) => {
  console.error(`Worker 启动失败：${redact(error)}`);
  process.exitCode = 1;
});

#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const VERSION = "0.1.0";
const DEFAULT_INTERVAL_MS = 1500;

function parseArgs(argv) {
  const args = { _: [], json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--json") {
      args.json = true;
      continue;
    }
    if (token === "--") {
      args._.push(...argv.slice(i + 1));
      break;
    }
    if (token?.startsWith("--")) {
      const key = token.slice(2).replaceAll("-", "_");
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
      continue;
    }
    args._.push(token);
  }
  return args;
}

function configPath(args) {
  return resolve(
    args.config || process.env.TDG_CONFIG || join(homedir(), ".tdg", "agent.json"),
  );
}

function loadConfig(args) {
  const path = configPath(args);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`配置文件无法读取：${path}（${error.message}）`);
  }
}

function saveConfig(args, config) {
  const path = configPath(args);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  if (process.platform !== "win32") chmodSync(path, 0o600);
  return path;
}

function required(args, name, value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`缺少参数 --${name.replaceAll("_", "-")}`);
  }
  return String(value).trim();
}

function normalizeBaseUrl(raw) {
  const value = required({}, "url", raw).replace(/\/+$/, "");
  return /\/api\/trpc$/i.test(value) ? value : `${value}/api/trpc`;
}

function resolveBaseUrl(args, config, { requiredUrl = true } = {}) {
  const raw = args.url || process.env.TDG_BASE || config?.baseUrl;
  if (!raw && !requiredUrl) return null;
  return normalizeBaseUrl(raw);
}

function resolveKey(args, config) {
  const key = args.api_key || process.env.TDG_API_KEY || config?.key;
  return key ? String(key).trim() : "";
}

function requireKey(args, config) {
  const key = resolveKey(args, config);
  if (!key) {
    throw new Error(
      "没有找到 API Key。先执行 register，或设置 TDG_API_KEY；Key 不要粘贴到聊天中。",
    );
  }
  return key;
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON：${error.message}`);
  }
}

function numberArg(args, name, fallback) {
  const raw = args[name] ?? fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`--${name.replaceAll("_", "-")} 必须是数字`);
  return value;
}

function healthUrl(baseUrl) {
  const url = new URL(baseUrl);
  return `${url.origin}/api/health`;
}

function redactMessage(value) {
  return String(value || "请求失败").replace(/tdg_[A-Za-z0-9_-]+/g, "tdg_[已隐藏]");
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function unwrapTrpc(payload) {
  if (payload?.error) {
    const error = payload.error.json || payload.error;
    const wrapped = new Error(redactMessage(error.message || "tRPC 请求失败"));
    wrapped.code = error.data?.code || error.code;
    throw wrapped;
  }
  const data = payload?.result?.data;
  if (data && typeof data === "object" && Object.hasOwn(data, "json")) return data.json;
  return data;
}

async function callProcedure(baseUrl, procedure, input, { key = "", method = "GET" } = {}) {
  const url = `${baseUrl}/${procedure}`;
  const headers = { accept: "application/json" };
  if (key) headers["x-api-key"] = key;
  const init = { method, headers };
  if (method === "GET") {
    const query = encodeURIComponent(JSON.stringify({ json: input ?? {} }));
    const response = await fetch(`${url}?input=${query}`, init);
    const payload = await readResponse(response);
    if (!response.ok) throw new Error(redactMessage(payload?.error?.json?.message || payload?.message));
    return unwrapTrpc(payload);
  }
  headers["content-type"] = "application/json";
  init.body = JSON.stringify({ json: input ?? {} });
  const response = await fetch(url, init);
  const payload = await readResponse(response);
  if (!response.ok) throw new Error(redactMessage(payload?.error?.json?.message || payload?.message));
  return unwrapTrpc(payload);
}

async function checkHealth(baseUrl) {
  try {
    const response = await fetch(healthUrl(baseUrl), { headers: { accept: "application/json" } });
    const payload = await readResponse(response);
    return { ok: response.ok && payload.ok === true, status: response.status, payload };
  } catch (error) {
    return { ok: false, status: null, payload: { message: redactMessage(error.message) } };
  }
}

function printSuccess(args, data) {
  if (args.json) {
    console.log(JSON.stringify({ ok: true, data }));
    return;
  }
  if (typeof data === "string") console.log(data);
  else console.log(JSON.stringify(data, null, 2));
}

function help() {
  console.log(`十日牌局 Agent CLI v${VERSION}

首次接入：
  tdg-agent register --url https://your-domain --name 白泽 --invite-code <邀请码>

持续访问：
  tdg-agent rooms
  tdg-agent join --room ABC123
  tdg-agent watch --room ABC123
  tdg-agent act --room ABC123 --type submit --value 33
  tdg-agent speak --room ABC123 --text "我认为四号的陈述存在矛盾"
  tdg-agent appeal --room ABC123 --clause-id c-guess-tie --assertion "具体规则质询"

诊断与原始读取：
  tdg-agent doctor --json
  tdg-agent rulebook --room ABC123
  tdg-agent request agent.gatewayRooms --method GET

全局参数：
  --url <服务地址>       也可用 TDG_BASE；首次 register 必填
  --config <路径>        默认 %USERPROFILE%/.tdg/agent.json
  --api-key <key>        也可用 TDG_API_KEY；不建议写入命令历史
  --json                 输出稳定 JSON；错误也不会回显 Key
`);
}

function actionFromArgs(args) {
  if (args.action_json) return parseJson(args.action_json, "--action-json");
  const type = required(args, "type", args.type);
  if (type === "start") return { type };
  if (type === "submit") return { type, value: numberArg(args, "value") };
  if (type === "choose") return { type, choice: numberArg(args, "choice") };
  if (type === "play") {
    const action = { type, cardId: required(args, "card-id", args.card_id) };
    if (args.target_seat !== undefined) action.targetSeat = numberArg(args, "target_seat");
    return action;
  }
  if (type === "speak") {
    const action = { type, text: required(args, "text", args.text) };
    if (args.target_seat !== undefined) action.targetSeat = numberArg(args, "target_seat");
    return action;
  }
  throw new Error(`不支持的动作类型：${type}`);
}

async function run(args) {
  const command = args._[0] || "help";
  if (args.version) {
    printSuccess(args, { version: VERSION });
    return;
  }
  if (["help", "--help", "-h"].includes(command)) {
    help();
    return;
  }
  if (command === "version" || command === "--version") {
    printSuccess(args, { version: VERSION });
    return;
  }

  const config = loadConfig(args);
  if (command === "register") {
    const baseUrl = resolveBaseUrl(args, config);
    const name = required(args, "name", args.name);
    const inviteCode = required(args, "invite-code", args.invite_code);
    if (config?.key && !args.force) {
      throw new Error(`已有配置 ${configPath(args)}。如需替换旧 Agent，请加 --force。`);
    }
    const data = await callProcedure(baseUrl, "agent.publicRegister", { name, inviteCode }, { method: "POST" });
    const path = saveConfig(args, {
      baseUrl,
      key: data.key,
      agentId: data.agentId,
      userId: data.userId,
      name: data.name,
      createdAt: new Date().toISOString(),
    });
    printSuccess(args, { ...data, configPath: path, next: "Key 只显示这一次，请让本机 Agent 从配置文件读取。" });
    return;
  }

  if (command === "doctor") {
    const rawBaseUrl = args.url || process.env.TDG_BASE || config?.baseUrl;
    if (!rawBaseUrl) {
      const data = {
        ok: false,
        endpoint: null,
        configPath: configPath(args),
        checks: [{ name: "endpoint", ok: false, message: "未配置服务地址；使用 --url 或 TDG_BASE" }],
        roomCount: null,
      };
      printSuccess(args, data);
      process.exitCode = 1;
      return;
    }
    const baseUrl = normalizeBaseUrl(rawBaseUrl);
    const health = await checkHealth(baseUrl);
    const key = resolveKey(args, config);
    const checks = [{ name: "health", ok: health.ok, status: health.status }];
    let rooms = null;
    if (key) {
      try {
        rooms = await callProcedure(baseUrl, "agent.gatewayRooms", {}, { key });
        checks.push({ name: "agent-key", ok: true });
      } catch (error) {
        checks.push({ name: "agent-key", ok: false, message: redactMessage(error.message) });
      }
    } else {
      checks.push({ name: "agent-key", ok: false, message: "未配置；先 register" });
    }
    const data = { ok: checks.every((item) => item.ok), endpoint: baseUrl, configPath: configPath(args), checks, roomCount: rooms?.length ?? null };
    printSuccess(args, data);
    if (!data.ok) process.exitCode = 1;
    return;
  }

  const baseUrl = resolveBaseUrl(args, config);
  const key = requireKey(args, config);
  if (command === "whoami") {
    printSuccess(args, {
      name: config?.name || "unknown",
      agentId: config?.agentId || null,
      baseUrl,
      configPath: configPath(args),
      keyConfigured: true,
    });
    return;
  }
  if (command === "rooms") {
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayRooms", {}, { key }));
    return;
  }
  if (command === "join") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayJoin", { code }, { key, method: "POST" }));
    return;
  }
  if (command === "rulebook") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayRulebook", { code }, { key }));
    return;
  }
  if (command === "act") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayAct", { code, action: actionFromArgs(args) }, { key, method: "POST" }));
    return;
  }
  if (command === "speak") {
    const code = required(args, "room", args.room).toUpperCase();
    const action = { type: "speak", text: required(args, "text", args.text) };
    if (args.target_seat !== undefined) action.targetSeat = numberArg(args, "target_seat");
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayAct", { code, action }, { key, method: "POST" }));
    return;
  }
  if (command === "appeal") {
    const input = {
      code: required(args, "room", args.room).toUpperCase(),
      clauseId: required(args, "clause-id", args.clause_id),
      assertion: required(args, "assertion", args.assertion),
      quorumSize: numberArg(args, "quorum-size", 3),
    };
    printSuccess(args, await callProcedure(baseUrl, "agent.gatewayAppeal", input, { key, method: "POST" }));
    return;
  }
  if (command === "watch") {
    const code = required(args, "room", args.room).toUpperCase();
    const interval = Math.max(250, numberArg(args, "interval", DEFAULT_INTERVAL_MS));
    const once = Boolean(args.once);
    let lastSignature = "";
    do {
      const view = await callProcedure(baseUrl, "agent.gatewayObserve", { code }, { key });
      const signature = JSON.stringify([view.status, view.round, view.phase, view.submittedCount, view.winner, view.lastReveal]);
      if (signature !== lastSignature || once) {
        printSuccess(args, view);
        lastSignature = signature;
      }
      if (once || view.status === "finished") break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, interval));
    } while (true);
    return;
  }
  if (command === "request") {
    const procedure = required(args, "procedure", args._[1]);
    const method = String(args.method || "GET").toUpperCase();
    if (method !== "GET" && !args.allow_write) {
      throw new Error("原始 request 默认只允许 GET；明确加 --allow-write 才能发送写请求。");
    }
    const input = args.input_json ? parseJson(args.input_json, "--input-json") : {};
    printSuccess(args, await callProcedure(baseUrl, procedure, input, { key, method }));
    return;
  }
  throw new Error(`未知命令：${command}。运行 tdg-agent help 查看用法。`);
}

const args = parseArgs(process.argv.slice(2));
run(args).catch((error) => {
  const message = redactMessage(error.message || error);
  if (args.json) console.error(JSON.stringify({ ok: false, error: { message } }));
  else console.error(`错误：${message}`);
  process.exitCode = 1;
});

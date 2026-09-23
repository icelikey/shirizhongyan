#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

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
  const parsed = new URL(value);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  if (/\/api\/trpc$/i.test(pathname)) {
    parsed.pathname = pathname.slice(0, -"/api/trpc".length);
  } else if (/\/world\/v1$/i.test(pathname)) {
    parsed.pathname = pathname;
  } else {
    parsed.pathname = `${pathname}/world/v1`.replace(/^\/+/g, "/");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
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

function originUrl(baseUrl) {
  const url = new URL(baseUrl);
  return url.origin;
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

async function requestJson(url, { key = "", method = "GET", body } = {}) {
  const headers = { accept: "application/json" };
  if (key) headers["x-api-key"] = key;
  const init = { method, headers };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new Error(redactMessage(payload?.error?.message || payload?.message || "请求失败"));
  }
  return payload;
}

async function gatewayRequest(baseUrl, path, options = {}) {
  return requestJson(`${baseUrl}${path}`, options);
}

async function observe(baseUrl, key, code) {
  const payload = await gatewayRequest(
    baseUrl,
    `/matches/${encodeURIComponent(code)}/observation`,
    { key },
  );
  return payload;
}

function observationData(payload) {
  return payload?.observation ?? payload;
}

function commandEnvelope(payload, action, args) {
  return {
    protocolVersion: "0.1",
    commandId: args.command_id || randomUUID(),
    contextRef: payload.contextRef,
    bindingId: payload.binding?.bindingId,
    action,
  };
}

async function sendCommand(baseUrl, key, code, action, args) {
  const current = await observe(baseUrl, key, code);
  return gatewayRequest(
    baseUrl,
    `/matches/${encodeURIComponent(code)}/commands`,
    { key, method: "POST", body: commandEnvelope(current, action, args) },
  );
}

async function readDescriptor(baseUrl) {
  return requestJson(`${originUrl(baseUrl)}/.well-known/tdg-world.json`);
}

async function readHealth(baseUrl) {
  return requestJson(healthUrl(baseUrl));
}

async function registerAgent(baseUrl, name, inviteCode) {
  return gatewayRequest(baseUrl, "/agents", {
    method: "POST",
    body: { name, inviteCode },
  });
}

async function checkHealth(baseUrl) {
  try {
    const payload = await readHealth(baseUrl);
    return { ok: payload.ok === true, status: 200, payload };
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
  tdg-agent request matches --method GET

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
    const data = await registerAgent(baseUrl, name, inviteCode);
    const agent = data.agent ?? {};
    const credential = data.credential ?? {};
    const path = saveConfig(args, {
      baseUrl,
      key: credential.key,
      agentId: agent.agentId,
      userId: agent.userId,
      name: agent.name,
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
    try {
      const descriptor = await readDescriptor(baseUrl);
      checks.push({ name: "discovery", ok: descriptor.protocolVersion === "0.1" });
    } catch (error) {
      checks.push({ name: "discovery", ok: false, message: redactMessage(error.message) });
    }
    let rooms = null;
    if (key) {
      try {
        const payload = await gatewayRequest(baseUrl, "/matches", { key });
        rooms = payload.matches ?? [];
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
    const payload = await gatewayRequest(baseUrl, "/matches", { key });
    printSuccess(args, payload.matches ?? []);
    return;
  }
  if (command === "join") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await gatewayRequest(baseUrl, `/matches/${encodeURIComponent(code)}/join`, { key, method: "POST" }));
    return;
  }
  if (command === "rulebook") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await gatewayRequest(baseUrl, `/matches/${encodeURIComponent(code)}/rulebook`, { key }));
    return;
  }
  if (command === "act") {
    const code = required(args, "room", args.room).toUpperCase();
    printSuccess(args, await sendCommand(baseUrl, key, code, actionFromArgs(args), args));
    return;
  }
  if (command === "speak") {
    const code = required(args, "room", args.room).toUpperCase();
    const action = { type: "speak", text: required(args, "text", args.text) };
    if (args.target_seat !== undefined) action.targetSeat = numberArg(args, "target_seat");
    printSuccess(args, await sendCommand(baseUrl, key, code, action, args));
    return;
  }
  if (command === "appeal") {
    const input = {
      code: required(args, "room", args.room).toUpperCase(),
      clauseId: required(args, "clause-id", args.clause_id),
      assertion: required(args, "assertion", args.assertion),
      quorumSize: numberArg(args, "quorum-size", 3),
    };
    printSuccess(args, await gatewayRequest(baseUrl, `/matches/${encodeURIComponent(input.code)}/appeals`, {
      key,
      method: "POST",
      body: {
        clauseId: input.clauseId,
        assertion: input.assertion,
        quorumSize: input.quorumSize,
      },
    }));
    return;
  }
  if (command === "watch") {
    const code = required(args, "room", args.room).toUpperCase();
    const interval = Math.max(250, numberArg(args, "interval", DEFAULT_INTERVAL_MS));
    const once = Boolean(args.once);
    let lastSignature = "";
    do {
      const payload = await observe(baseUrl, key, code);
      const view = observationData(payload);
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
    const rawPath = required(args, "path", args._[1]);
    const method = String(args.method || "GET").toUpperCase();
    if (method !== "GET" && !args.allow_write) {
      throw new Error("原始 request 默认只允许 GET；明确加 --allow-write 才能发送写请求。");
    }
    const body = args.input_json ? parseJson(args.input_json, "--input-json") : undefined;
    // Keep the old procedure-shaped request form working while normal paths
    // use the public TDG-WP gateway.
    if (!rawPath.includes("/") && rawPath.includes(".")) {
      printSuccess(args, await callProcedure(baseUrl, rawPath, body ?? {}, { key, method }));
      return;
    }
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const requestBase = /^\/(?:world\/v1|api\/trpc)(?:\/|$)/i.test(path)
      ? originUrl(baseUrl)
      : baseUrl;
    printSuccess(args, await gatewayRequest(requestBase, path, { key, method, body }));
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

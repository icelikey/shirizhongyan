import { randomUUID } from "node:crypto";

function required(value, label) {
  if (!value || !String(value).trim()) throw new Error(`缺少 ${label}`);
  return String(value).trim();
}

function normalizeBaseUrl(raw) {
  const url = new URL(required(raw, "TDG_BASE_URL"));
  const path = url.pathname.replace(/\/+$/, "");
  url.pathname = /\/world\/v1$/i.test(path) ? path : `${path}/world/v1`.replace(/^\/+/, "/");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function redact(value) {
  return String(value).replace(/tdg_[A-Za-z0-9_-]+/g, "tdg_[已隐藏]");
}

export class TdgClient {
  constructor({ baseUrl, apiKey, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = required(apiKey, "TDG API Key");
    this.fetchImpl = fetchImpl;
    this.bindings = new Map();
  }

  async request(path, { method = "GET", body, reportToken = false } = {}) {
    const headers = { accept: "application/json" };
    if (reportToken) headers["x-report-token"] = this.apiKey;
    else headers["x-api-key"] = this.apiKey;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    let payload = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw: raw.slice(0, 400) }; }
    if (!response.ok) {
      throw new Error(redact(payload?.error?.message || payload?.message || `TDG Gateway HTTP ${response.status}`));
    }
    return payload;
  }

  worldState() {
    return this.request("/world/state");
  }

  listMatches() {
    return this.request("/matches");
  }

  async joinMatch(code) {
    const normalizedCode = required(code, "房间码").toUpperCase();
    const payload = await this.request(`/matches/${encodeURIComponent(normalizedCode)}/join`, { method: "POST" });
    if (payload.binding) this.bindings.set(normalizedCode, payload.binding);
    return payload;
  }

  observe(code) {
    return this.request(`/matches/${encodeURIComponent(required(code, "房间码").toUpperCase())}/observation`);
  }

  readRulebook(code) {
    return this.request(`/matches/${encodeURIComponent(required(code, "房间码").toUpperCase())}/rulebook`);
  }

  /**
   * 每次写操作前重新读取 observation，避免 Pi 会话保存过期 contextRef。
   * commandId 由适配层生成，模型不能伪造或复用它。
   */
  async submitAction(code, action) {
    const normalizedCode = required(code, "房间码").toUpperCase();
    const current = await this.observe(normalizedCode);
    const bindingId = current.binding?.bindingId || this.bindings.get(normalizedCode)?.bindingId;
    if (!current.contextRef || !bindingId) throw new Error("当前 Agent 尚未取得有效房间绑定或上下文");
    return this.request(`/matches/${encodeURIComponent(normalizedCode)}/commands`, {
      method: "POST",
      body: {
        protocolVersion: "0.1",
        commandId: randomUUID(),
        contextRef: current.contextRef,
        bindingId,
        action,
      },
    });
  }

  requestJudges(code, { clauseId, assertion, quorumSize = 3 }) {
    return this.request(`/matches/${encodeURIComponent(required(code, "房间码").toUpperCase())}/appeals`, {
      method: "POST",
      body: { clauseId, assertion, quorumSize },
    });
  }

  reflect({ kind = "reflection", title, detail = "", payload = {} }) {
    const agentId = required(this.agentId, "Agent ID");
    return this.request(`/agents/${encodeURIComponent(agentId)}/activity`, {
      method: "POST",
      body: { kind, title, detail, payload, occurredAt: new Date().toISOString() },
    });
  }

  async dailyReport() {
    const agentId = required(this.agentId, "Agent ID");
    return this.request(`/agents/${encodeURIComponent(agentId)}/report`);
  }
}


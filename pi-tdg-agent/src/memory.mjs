import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * 终焉 Agent 的本地记忆仓。
 *
 * 记忆不是世界事实的替代品：服务器事件和 observation 才能证明世界事实。
 * 这里保存的是 Agent 可携带的工作状态、经历、已验证锚点和 Skill 候选，
 * 每条记录都必须能追溯到来源，且永远不保存密钥或思维链。
 */
export const MEMORY_KINDS = Object.freeze([
  "working",
  "episodic",
  "semantic",
  "procedural",
]);

const DEFAULT_LIMITS = Object.freeze({
  working: 32,
  episodic: 160,
  semantic: 120,
  procedural: 80,
});

const SECRET_PATTERN = /(?:tdg_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+|api[_-]?key\s*[:=]\s*[^\s,;]+|authorization\s*[:=]\s*[^\s,;]+)/i;
const CHAIN_OF_THOUGHT_PATTERN = /(?:chain[- ]of[- ]thought|思维链|逐步思考过程|完整推理过程|internal reasoning)/i;

function nowIso(clock) {
  return new Date(clock()).toISOString();
}

function nonEmpty(value, label) {
  if (!value || !String(value).trim()) throw new Error(`缺少 ${label}`);
  return String(value).trim();
}

function finiteConfidence(value) {
  if (value === undefined) return 0.5;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error("confidence 必须是 0 到 1 之间的数字");
  }
  return number;
}

function safeString(value, label, maxLength = 4000) {
  const text = nonEmpty(value, label);
  if (text.length > maxLength) throw new Error(`${label} 超过 ${maxLength} 个字符`);
  if (SECRET_PATTERN.test(text)) throw new Error(`${label} 包含凭据或密钥，拒绝写入记忆`);
  if (CHAIN_OF_THOUGHT_PATTERN.test(text)) throw new Error(`${label} 包含内部推理内容，拒绝写入记忆`);
  return text;
}

function normalizeList(value, maxLength = 12) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("tags 必须是数组");
  return [...new Set(value.map((item) => safeString(item, "tag", 64)))].slice(0, maxLength);
}

function emptyState() {
  return {
    version: 1,
    updatedAt: null,
    entries: [],
  };
}

function normalizeState(value) {
  if (!value || typeof value !== "object") return emptyState();
  const entries = Array.isArray(value.entries) ? value.entries : [];
  return {
    version: 1,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    entries: entries.filter((entry) => entry && MEMORY_KINDS.includes(entry.kind)).map((entry) => ({
      id: String(entry.id || randomUUID()),
      kind: entry.kind,
      content: String(entry.content || "").slice(0, 4000),
      source: String(entry.source || "unknown").slice(0, 160),
      eventId: String(entry.eventId || "local").slice(0, 160),
      createdAt: String(entry.createdAt || new Date(0).toISOString()),
      confidence: finiteConfidence(entry.confidence),
      visibility: String(entry.visibility || "private").slice(0, 32),
      tags: Array.isArray(entry.tags) ? entry.tags.map(String).slice(0, 12) : [],
      skillId: entry.skillId ? String(entry.skillId).slice(0, 96) : undefined,
      expiresAt: entry.expiresAt ? String(entry.expiresAt) : undefined,
    })),
  };
}

export class MemoryStore {
  constructor({ path, limits = {}, clock = Date.now } = {}) {
    this.path = path ? resolve(path) : null;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.clock = clock;
    this.state = this.path ? this.#read() : emptyState();
    this.#pruneExpired(false);
  }

  #read() {
    if (!existsSync(this.path)) return emptyState();
    try {
      return normalizeState(JSON.parse(readFileSync(this.path, "utf8")));
    } catch (error) {
      throw new Error(`记忆文件无法读取：${this.path}（${error.message}）`);
    }
  }

  #write() {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
    // Windows 的 renameSync 不能覆盖已有目标文件；先移除旧文件，
    // 保留 POSIX 下的原子 rename 路径，保证常驻 Worker 在各平台可恢复。
    if (process.platform === "win32") rmSync(this.path, { force: true });
    renameSync(tempPath, this.path);
  }

  #pruneExpired(persist = true) {
    const current = this.clock();
    const before = this.state.entries.length;
    this.state.entries = this.state.entries.filter((entry) => !entry.expiresAt || Date.parse(entry.expiresAt) > current);
    if (before !== this.state.entries.length) {
      this.state.updatedAt = nowIso(this.clock);
      if (persist) this.#write();
    }
  }

  remember({ kind, content, source, eventId, confidence, visibility = "private", tags, skillId, expiresAt } = {}) {
    if (!MEMORY_KINDS.includes(kind)) throw new Error(`不支持的记忆层：${kind}`);
    const entry = {
      id: randomUUID(),
      kind,
      content: safeString(content, "content"),
      source: safeString(source, "source", 160),
      eventId: safeString(eventId, "eventId", 160),
      createdAt: nowIso(this.clock),
      confidence: finiteConfidence(confidence),
      visibility: safeString(visibility, "visibility", 32),
      tags: normalizeList(tags),
      ...(skillId ? { skillId: safeString(skillId, "skillId", 96) } : {}),
      ...(expiresAt ? { expiresAt: safeString(expiresAt, "expiresAt", 64) } : {}),
    };
    this.#pruneExpired(false);
    const duplicate = this.state.entries.find((item) => item.kind === kind && item.eventId === entry.eventId && item.content === entry.content);
    if (duplicate) return { ...duplicate, duplicate: true };
    this.state.entries.push(entry);
    const limit = Math.max(1, Number(this.limits[kind] || DEFAULT_LIMITS[kind]));
    const sameKind = this.state.entries.filter((item) => item.kind === kind);
    if (sameKind.length > limit) {
      const keepIds = new Set(sameKind
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit)
        .map((item) => item.id));
      this.state.entries = this.state.entries.filter((item) => item.kind !== kind || keepIds.has(item.id));
    }
    this.state.updatedAt = entry.createdAt;
    this.#write();
    return entry;
  }

  hasEvent(eventId) {
    return this.state.entries.some((entry) => entry.eventId === eventId);
  }

  list(kind, { limit = 20, tags = [] } = {}) {
    this.#pruneExpired();
    const wantedTags = new Set(normalizeList(tags));
    return this.state.entries
      .filter((entry) => (!kind || entry.kind === kind) && (!wantedTags.size || entry.tags.some((tag) => wantedTags.has(tag))))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, Math.max(0, Number(limit) || 20))
      .map((entry) => ({ ...entry, tags: [...entry.tags] }));
  }

  context({ perKind = 6 } = {}) {
    return Object.fromEntries(MEMORY_KINDS.map((kind) => [kind, this.list(kind, { limit: perKind }).map((entry) => ({
      id: entry.id,
      content: entry.content,
      source: entry.source,
      eventId: entry.eventId,
      confidence: entry.confidence,
      visibility: entry.visibility,
      tags: entry.tags,
      skillId: entry.skillId,
    }))]));
  }

  promptContext(options = {}) {
    const context = this.context(options);
    return JSON.stringify(context, null, 2);
  }

  snapshot() {
    this.#pruneExpired();
    return JSON.parse(JSON.stringify(this.state));
  }
}

export function createMemoryStore(options = {}) {
  return new MemoryStore(options);
}

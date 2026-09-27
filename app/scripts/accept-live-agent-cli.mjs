/**
 * CLI 真实接入验收：使用公开邀请码注册，再由 tdg-agent 自己完成
 * doctor / whoami / rooms / report。只输出状态，不输出 API Key。
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../cli/tdg-agent.mjs");
const config = resolve(tmpdir(), `tdg-cli-smoke-${randomUUID()}.json`);
const baseUrl = (process.env.TDG_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:3010").replace(/\/$/, "");
const inviteCode = process.env.AGENT_REGISTRATION_CODE?.trim();
if (!inviteCode) throw new Error("AGENT_REGISTRATION_CODE 未配置");

function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args, "--json"], {
    cwd: resolve(here, "../.."),
    env: { ...process.env, TDG_CONFIG: config },
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`tdg-agent ${args[0]} 失败：${(result.stderr || result.stdout || "").trim().slice(0, 500)}`);
  }
  return JSON.parse(result.stdout);
}

try {
  const registration = run([
    "register",
    "--url", baseUrl,
    "--name", `cli-smoke-${Date.now()}`,
    "--invite-code", inviteCode,
    "--config", config,
  ]);
  const doctor = run(["doctor", "--config", config]);
  const whoami = run(["whoami", "--config", config]);
  const rooms = run(["rooms", "--config", config]);
  const report = run(["report", "--config", config]);
  console.log(JSON.stringify({
    registerOk: registration.ok === true,
    doctorOk: doctor.ok === true,
    whoamiOk: whoami.ok === true,
    roomsOk: rooms.ok === true,
    reportOk: report.ok === true,
    agentId: registration.data?.agent?.agentId ?? null,
    doctorChecks: doctor.data?.checks?.map((item) => ({ name: item.name, ok: item.ok })) ?? [],
    roomCount: doctor.data?.roomCount ?? null,
    keyConfigured: whoami.data?.keyConfigured === true,
  }, null, 2));
} finally {
  if (existsSync(config)) rmSync(config, { force: true });
}

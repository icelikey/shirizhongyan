import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test, afterEach } from "node:test";

const cliPath = join(import.meta.dirname, "tdg-agent.mjs");
const servers = [];
const tempDirs = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`CLI exited ${code}: ${stderr || stdout}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
}

async function jsonBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : null;
}

test("CLI completes the TDG-WP discovery/register/observe/command loop", async () => {
  const requests = [];
  let observationReads = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    requests.push({ method: req.method, path: url.pathname, headers: req.headers });
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (req.method === "GET" && url.pathname === "/.well-known/tdg-world.json") {
      send(200, { protocolVersion: "0.1", worldId: "test-world" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/health") {
      send(200, { ok: true, service: "test" });
      return;
    }
    if (req.method === "POST" && url.pathname === "/world/v1/agents") {
      const body = await jsonBody(req);
      assert.deepEqual(body, { name: "测试 Agent", inviteCode: "invite" });
      send(201, {
        protocolVersion: "0.1",
        agent: { agentId: 7, userId: 8, name: body.name },
        credential: { type: "api-key", key: "tdg_test_key", shownOnce: true },
      });
      return;
    }
    assert.equal(req.headers["x-api-key"], "tdg_test_key");
    if (req.method === "GET" && url.pathname === "/world/v1/matches") {
      send(200, { protocolVersion: "0.1", matches: [{ code: "ABC123", status: "waiting" }] });
      return;
    }
    if (req.method === "POST" && url.pathname === "/world/v1/matches/ABC123/join") {
      send(200, {
        protocolVersion: "0.1",
        match: { code: "ABC123", seatIndex: 1 },
        binding: { bindingId: "binding-abc123-7", role: "player" },
        observation: { code: "ABC123", status: "waiting" },
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/world/v1/matches/ABC123/observation") {
      observationReads += 1;
      send(200, {
        protocolVersion: "0.1",
        binding: { bindingId: "binding-abc123-7" },
        contextRef: "abc123-v3-r1-submit",
        observation: {
          code: "ABC123",
          status: "playing",
          round: 1,
          phase: "submit",
          submittedCount: 0,
          winner: null,
          lastReveal: null,
        },
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/world/v1/matches/ABC123/commands") {
      const body = await jsonBody(req);
      assert.equal(body.protocolVersion, "0.1");
      assert.equal(body.contextRef, "abc123-v3-r1-submit");
      assert.equal(body.bindingId, "binding-abc123-7");
      assert.match(body.commandId, /^[0-9a-f-]{36}$/);
      assert.deepEqual(body.action, { type: "submit", value: 33 });
      send(200, { protocolVersion: "0.1", receipt: { status: "committed", commandId: body.commandId } });
      return;
    }
    send(404, { protocolVersion: "0.1", error: { code: "NOT_FOUND", message: "missing" } });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  servers.push(server);
  const { port } = server.address();
  const tempDir = await mkdtemp(join(tmpdir(), "tdg-agent-test-"));
  tempDirs.push(tempDir);
  const config = join(tempDir, "agent.json");
  const url = `http://127.0.0.1:${port}`;
  const env = { TDG_CONFIG: config };

  const registered = await runCli(["register", "--url", url, "--name", "测试 Agent", "--invite-code", "invite", "--json"], env);
  assert.equal(registered.ok, true);
  assert.equal(registered.data.agent.agentId, 7);
  assert.equal(registered.data.credential.key, "tdg_test_key");

  const doctor = await runCli(["doctor", "--json"], env);
  assert.equal(doctor.data.ok, true);
  assert.equal(doctor.data.endpoint, `${url}/world/v1`);
  assert.equal(doctor.data.roomCount, 1);

  const rooms = await runCli(["rooms", "--json"], env);
  assert.deepEqual(rooms.data, [{ code: "ABC123", status: "waiting" }]);
  await runCli(["join", "--room", "ABC123", "--json"], env);
  const watched = await runCli(["watch", "--room", "ABC123", "--once", "--json"], env);
  assert.equal(watched.data.code, "ABC123");
  await runCli(["act", "--room", "ABC123", "--type", "submit", "--value", "33", "--json"], env);
  assert.ok(observationReads >= 2);
  assert.ok(requests.some((request) => request.path === "/world/v1/agents"));
  assert.ok(requests.every((request) => !request.path.includes("/api/trpc")));
});

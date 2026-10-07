import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const workerSource = await readFile(new URL("../scripts/tdg-agent-worker.mjs", import.meta.url), "utf8");
const worker = workerSource.includes("export async function runOnce")
  ? await import(new URL("../scripts/tdg-agent-worker.mjs", import.meta.url))
  : {};
const REQUIRED_EXPORT = "runOnce";

function requireWorkerBoundary(t) {
  if (typeof worker[REQUIRED_EXPORT] !== "function") {
    t.skip(`scripts/tdg-agent-worker.mjs must export ${REQUIRED_EXPORT}({ config, args, fetchImpl })`);
    return null;
  }
  return worker[REQUIRED_EXPORT];
}

function response(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function gatewayMock({ webhookUrl = "http://127.0.0.1:9/webhook" } = {}) {
  const requests = [];
  let observationReads = 0;
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, headers: init.headers || {}, body });

    if (url.endsWith("/.well-known/tdg-world.json")) {
      return response(200, { protocolVersion: "0.1", worldId: "mock-world" });
    }
    if (url.endsWith("/agents/agent-1/world")) {
      return response(200, { worldIntel: { floor: 1, sightings: [] } });
    }
    if (url.endsWith("/matches") && method === "GET") {
      return response(200, { protocolVersion: "0.1", matches: [] });
    }
    if (url.endsWith("/matches") && method === "POST") {
      return response(201, { match: { code: "MOCK01", template: "numberGuess", status: "waiting", seats: 2 } });
    }
    if (url.endsWith("/matches/MOCK01/join")) {
      return response(200, {
        match: { code: "MOCK01", status: "playing", template: "numberGuess", seats: 2 },
        binding: { bindingId: "binding-mock01-agent-1" },
        contextRef: "mock01-r1-submit",
        observation: { code: "MOCK01", status: "playing", mySeat: 0, round: 1, seats: [{ index: 0, submitted: false }] },
      });
    }
    if (url.endsWith("/matches/MOCK01/observation")) {
      observationReads += 1;
      return response(200, {
        contextRef: "mock01-r1-submit",
        binding: { bindingId: "binding-mock01-agent-1" },
        observation: { code: "MOCK01", status: "playing", mySeat: 0, round: 1, seats: [{ index: 0, submitted: false }] },
      });
    }
    if (url.endsWith("/matches/MOCK01/commands") && method === "POST") {
      assert.equal(body.contextRef, "mock01-r1-submit");
      assert.equal(body.bindingId, "binding-mock01-agent-1");
      assert.match(body.commandId, /^.+$/);
      return response(200, { receipt: { status: "committed", commandId: body.commandId } });
    }
    if (url.endsWith("/agents/agent-1/activity") && method === "POST") {
      return response(201, { ok: true });
    }
    if (url.endsWith("/agents/agent-1/report")) {
      return response(200, { report: { summary: "mock daily", stats: {} } });
    }
    if (url === webhookUrl) {
      throw new Error("webhook must not be called in this test");
    }
    return response(404, { error: { message: `unexpected ${method} ${url}` } });
  };
  return { fetchImpl, requests, get observationReads() { return observationReads; } };
}

const baseConfig = {
  baseUrl: "http://mock.test/world/v1",
  key: "tdg_test_secret",
  agentId: "agent-1",
  name: "测试 Worker",
};

function assertNoKeyLeak(value) {
  assert.doesNotMatch(String(value), /tdg_test_secret/);
  assert.doesNotMatch(String(value), /tdg_[A-Za-z0-9_-]+/);
}

test("Worker --once completes discovery, rooms, create/join, observation, command, activity and daily", async (t) => {
  const runOnce = requireWorkerBoundary(t);
  if (!runOnce) return;
  const mock = gatewayMock();
  const result = await runOnce({ config: { ...baseConfig }, args: { once: true, create_match: true, persist: false }, fetchImpl: mock.fetchImpl });
  assert.equal(result?.status === undefined || typeof result.status === "string", true);
  const paths = mock.requests.map(({ url }) => new URL(url).pathname);
  assert.ok(paths.some((path) => path.endsWith("/.well-known/tdg-world.json")) || paths.some((path) => path.endsWith("/world/v1")));
  assert.ok(paths.some((path) => path.endsWith("/matches")));
  assert.ok(paths.some((path) => path.endsWith("/join")));
  assert.ok(paths.some((path) => path.endsWith("/observation")));
  assert.ok(paths.some((path) => path.endsWith("/commands")));
  assert.ok(paths.some((path) => path.endsWith("/activity")));
  assert.ok(paths.some((path) => path.endsWith("/report")));
  assert.ok(mock.observationReads >= 1);
});

test("Worker command payload preserves contextRef, bindingId and commandId", async (t) => {
  const runOnce = requireWorkerBoundary(t);
  if (!runOnce) return;
  const mock = gatewayMock();
  await runOnce({ config: { ...baseConfig }, args: { once: true, create_match: true, persist: false }, fetchImpl: mock.fetchImpl });
  const command = mock.requests.find(({ url, method }) => url.endsWith("/commands") && method === "POST");
  assert.ok(command, "expected a command request");
  assert.equal(command.body.contextRef, "mock01-r1-submit");
  assert.equal(command.body.bindingId, "binding-mock01-agent-1");
  assert.equal(typeof command.body.commandId, "string");
  assert.notEqual(command.body.commandId, "");
});

test("Worker failure output never exposes the tdg_ API key", async (t) => {
  const runOnce = requireWorkerBoundary(t);
  if (!runOnce) return;
  const failure = new Error("Gateway rejected tdg_test_secret");
  const fetchImpl = async () => { throw failure; };
  await assert.rejects(
    runOnce({ config: baseConfig, args: { once: true }, fetchImpl }),
    (error) => {
      assertNoKeyLeak(error?.message);
      return true;
    },
  );
});

test("Worker without webhook configuration makes no external webhook request", async (t) => {
  const runOnce = requireWorkerBoundary(t);
  if (!runOnce) return;
  const mock = gatewayMock();
  await runOnce({ config: baseConfig, args: { once: true, create_match: true, persist: false }, fetchImpl: mock.fetchImpl, webhookUrl: "" });
  assert.equal(mock.requests.some(({ url }) => url.includes("webhook")), false);
});



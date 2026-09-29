import test from "node:test";
import assert from "node:assert/strict";
import { TdgClient } from "../src/client.mjs";
import { createTdgPiAgent } from "../src/pi-agent.mjs";
import { createTdgTools } from "../src/tools.mjs";
import { runPiLoop } from "../src/loop.mjs";

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(payload); },
  };
}

test("Pi 工具通过 Gateway 刷新上下文后提交桌球动作", async () => {
  const requests = [];
  const client = new TdgClient({
    baseUrl: "https://example.test",
    apiKey: "tdg_test_key_should_never_be_returned",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/matches/ABC123/observation")) {
        return response({
          contextRef: "ctx-42",
          binding: { bindingId: "binding-7" },
          observation: { status: "playing", subPhase: "strike" },
          worldContext: { constitution: { principle: "local_optimum_is_not_long_term_optimum" } },
        });
      }
      if (url.endsWith("/matches/ABC123/commands")) return response({ receipt: { accepted: true } });
      return response({});
    },
  });
  const submit = createTdgTools(client).find((tool) => tool.name === "tdg_submit_action");
  assert.ok(submit);

  const result = await submit.execute("call-1", {
    code: "ABC123",
    action: { type: "strike", ballId: "doll-01", angle: 0.4, power: 0.72 },
  });
  const command = requests.find((request) => request.url.endsWith("/commands"));
  const body = JSON.parse(command.init.body);

  assert.deepEqual(result.details, { receipt: { accepted: true } });
  assert.equal(body.contextRef, "ctx-42");
  assert.equal(body.bindingId, "binding-7");
  assert.equal(body.action.type, "strike");
  assert.match(body.commandId, /^[0-9a-f-]{36}$/);
  assert.ok(!JSON.stringify(result).includes("tdg_test_key"));
});

test("工具目录覆盖世界上下文、入座、规则、裁判、复盘和日报", () => {
  const client = new TdgClient({ baseUrl: "https://example.test/world/v1", apiKey: "tdg_test_key" });
  client.agentId = "agent-1";
  const names = createTdgTools(client).map((tool) => tool.name);
  assert.deepEqual(names, [
    "tdg_world_context",
    "tdg_list_matches",
    "tdg_join_match",
    "tdg_observe",
    "tdg_read_rulebook",
    "tdg_submit_action",
    "tdg_request_judges",
    "tdg_reflect",
    "tdg_daily_report",
    "tdg_memory_context",
    "tdg_remember",
  ]);
});

test("Pi Agent 初始化时只获得工具，不会获得 Gateway 密钥", () => {
  const client = new TdgClient({ baseUrl: "https://example.test", apiKey: "tdg_test_key" });
  const agent = createTdgPiAgent({
    client,
    agentId: "agent-1",
    model: { provider: "test", id: "mock" },
    streamFn: async () => { throw new Error("test stream is not invoked"); },
  });
  assert.equal(agent.state.tools.length, 11);
  assert.ok(!JSON.stringify(agent.state).includes("tdg_test_key"));
});

test("Pi loop 会持续推进并能由 AbortSignal 停止", async () => {
  let prompts = 0;
  const controller = new AbortController();
  const cycles = [];
  const result = await runPiLoop({
    agent: { prompt: async () => { prompts += 1; if (prompts === 2) controller.abort(); } },
    intervalMs: 1000,
    signal: controller.signal,
    onCycle: ({ cycle }) => cycles.push(cycle),
  });

  assert.equal(result.cycles, 2);
  assert.deepEqual(cycles, [1, 2]);
});

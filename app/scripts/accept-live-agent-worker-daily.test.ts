import assert from "node:assert/strict";
import { runDailyWorkerAcceptance } from "./accept-live-agent-worker-daily.mts";

const API_KEY = "tdg_test_daily_key_should_not_be_printed";
const AGENT_ID = 701;

type Match = {
  code: string;
  gameId: string;
  started: boolean;
  finished: boolean;
  revision: number;
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

class FakeGateway {
  readonly webhookUrl = "https://hooks.test/daily-report";
  readonly reportRows = new Set<string>();
  readonly settledMatches = new Set<string>();
  readonly webhookBodies: string[] = [];
  readonly activities: unknown[] = [];
  private readonly matches = new Map<string, Match>();
  private nextCode = 1;

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = String(init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" && init.body ? JSON.parse(init.body) as Record<string, unknown> : {};

    if (url.origin === new URL(this.webhookUrl).origin) {
      if (method !== "POST") return response({ message: "method not allowed" }, 405);
      this.webhookBodies.push(typeof init?.body === "string" ? init.body : "");
      return response({ ok: true });
    }
    if (url.pathname === "/.well-known/tdg-world.json") {
      return response({ protocolVersion: "0.1", name: "fake-终焉-gateway" });
    }
    if (!url.pathname.startsWith("/world/v1/")) return response({ message: "not found" }, 404);
    if (headers.get("x-api-key") !== API_KEY) return response({ error: { message: "unauthorized" } }, 401);

    if (url.pathname === `/world/v1/agents/${AGENT_ID}/world`) {
      return response(this.worldPayload());
    }
    if (url.pathname === `/world/v1/agents/${AGENT_ID}/activity` && method === "POST") {
      this.activities.push(body);
      return response({ protocolVersion: "0.1", ok: true });
    }
    if (url.pathname === `/world/v1/agents/${AGENT_ID}/report` && method === "GET") {
      return response(this.reportPayload());
    }
    if (url.pathname === `/world/v1/agents/${AGENT_ID}/daily` && method === "POST") {
      return response(this.reportPayload());
    }
    if (url.pathname === "/world/v1/matches" && method === "GET") {
      return response({ matches: [...this.matches.values()].filter(match => !match.finished).map(match => this.matchSummary(match)) });
    }
    if (url.pathname === "/world/v1/matches" && method === "POST") {
      const code = `D${String(this.nextCode++).padStart(5, "0")}`;
      const match: Match = {
        code,
        gameId: String(body.gameId ?? "guess-mille-core"),
        started: false,
        finished: false,
        revision: 0,
      };
      this.matches.set(code, match);
      return response({ match: this.matchSummary(match) }, 201);
    }

    const matchPath = url.pathname.match(/^\/world\/v1\/matches\/([^/]+)(?:\/(join|observation|commands))?$/);
    if (!matchPath) return response({ message: "not found" }, 404);
    const code = matchPath[1];
    const action = matchPath[2];
    const match = this.matches.get(code);
    if (!match) return response({ error: { message: "match not found" } }, 404);
    if (action === "join" && method === "POST") return response({ match: { seatIndex: 0 } });
    if (action === "observation" && method === "GET") return response({ observation: this.observation(match) });
    if (action === "commands" && method === "POST") {
      const command = (body.action ?? {}) as Record<string, unknown>;
      if (command.type === "start") {
        match.started = true;
      } else if (!match.finished) {
        match.finished = true;
        this.settledMatches.add(match.code);
      }
      match.revision += 1;
      return response({ observation: this.observation(match) });
    }
    return response({ message: "method not allowed" }, 405);
  };

  private matchSummary(match: Match) {
    return {
      code: match.code,
      defId: match.gameId,
      template: "numberGuess",
      gameName: match.gameId,
      roomName: `fake · ${match.code}`,
      seats: 6,
      status: match.finished ? "finished" : match.started ? "playing" : "waiting",
    };
  }

  private observation(match: Match) {
    return {
      status: match.finished ? "finished" : match.started ? "playing" : "waiting",
      mySeat: 0,
      round: 1,
      history: [],
      contextRef: `context-${match.code}-${match.revision}`,
      binding: { bindingId: `binding-${match.code}-701` },
      seats: [{ index: 0, submitted: false }],
      winner: match.finished ? 0 : undefined,
      matchId: match.finished ? `log-${match.code}` : undefined,
    };
  }

  private worldPayload() {
    const played = this.settledMatches.size;
    return {
      worldIntel: {
        floor: 1,
        source: "fake-gateway",
        sightings: [{ id: "sighting-1", title: "测试见闻", text: "服务端公开见闻" }],
        dailyDarkMatches: { played, required: 3, remaining: Math.max(0, 3 - played), fulfilled: played >= 3 },
      },
    };
  }

  private reportPayload() {
    const reportDate = new Date().toISOString().slice(0, 10);
    this.reportRows.add(`${AGENT_ID}:${reportDate}`);
    const matches = this.settledMatches.size;
    const stats = {
      date: reportDate,
      events: this.activities.length,
      actions: matches,
      matches,
      darkMatches: matches,
      requiredDarkMatches: 3,
      remainingDarkMatches: Math.max(0, 3 - matches),
      darkMatchesFulfilled: matches >= 3,
      victories: matches,
      encounters: 0,
      games: [...this.matches.values()].filter(match => match.finished).map(match => match.gameId),
      lastActivityAt: null,
    };
    return {
      protocolVersion: "0.1",
      readOnly: true,
      report: {
        reportDate,
        summary: `暗局 ${matches}/3`,
        stats,
        activities: this.activities,
      },
      snapshot: { worldIntel: this.worldPayload().worldIntel },
    };
  }
}

async function main() {
  const gateway = new FakeGateway();
  const result = await runDailyWorkerAcceptance({
    baseUrl: "https://gateway.test",
    apiKey: API_KEY,
    agentId: AGENT_ID,
    fetchImpl: gateway.fetch,
    gameIds: ["guess-mille-core", "guess-mille-core", "guess-mille-core"],
    maxCycles: 20,
    webhookUrl: gateway.webhookUrl,
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.firstRun.report.stats, {
    darkMatches: 3,
    matches: 3,
    remainingDarkMatches: 0,
    events: result.firstRun.report.stats.events,
    actions: result.firstRun.report.stats.actions,
  });
  assert.equal(result.reportGeneratedWithoutWebhook, true);
  assert.equal(result.noDuplicateCount, true);
  assert.equal(result.noDuplicatePush, true);
  assert.equal(result.keyInOutput, false);
  assert.equal(result.webhookVerification, "verified");
  assert.equal(gateway.settledMatches.size, 3);
  assert.equal(gateway.reportRows.size, 1);
  assert.equal(gateway.webhookBodies.length, 1);
  assert.equal(gateway.webhookBodies[0]?.includes(API_KEY), false);
  console.log(JSON.stringify({
    status: result.status,
    darkMatches: result.firstRun.report.stats.darkMatches,
    reportGeneratedWithoutWebhook: result.reportGeneratedWithoutWebhook,
    noDuplicateCount: result.noDuplicateCount,
    noDuplicatePush: result.noDuplicatePush,
    keyInOutput: result.keyInOutput,
  }, null, 2));
}

await main();

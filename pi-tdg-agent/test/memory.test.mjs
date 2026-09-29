import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryStore } from "../src/memory.mjs";

test("四层记忆带来源、可持久化且相同事件幂等", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tdg-memory-"));
  const path = join(directory, "memory.json");
  const store = new MemoryStore({ path, clock: () => Date.parse("2026-09-29T00:00:00.000Z") });

  const first = store.remember({
    kind: "semantic",
    content: "第六层的钟声与三场暗局的时间债同时出现。",
    source: "world.observation",
    eventId: "world-sighting-6",
    confidence: 0.9,
    visibility: "public",
    tags: ["floor:6", "clue"],
  });
  const duplicate = store.remember({
    kind: "semantic",
    content: "第六层的钟声与三场暗局的时间债同时出现。",
    source: "world.observation",
    eventId: "world-sighting-6",
  });

  assert.equal(first.duplicate, undefined);
  assert.equal(duplicate.duplicate, true);
  assert.equal(store.list("semantic").length, 1);
  assert.equal(JSON.parse(await readFile(path, "utf8")).entries[0].eventId, "world-sighting-6");

  const restored = new MemoryStore({ path });
  assert.equal(restored.context().semantic[0].source, "world.observation");
});

test("记忆拒绝凭据和内部思维链", () => {
  const store = new MemoryStore();
  assert.throws(() => store.remember({
    kind: "working",
    content: "tdg_should_not_be_saved",
    source: "test",
    eventId: "secret",
  }), /凭据或密钥/);
  assert.throws(() => store.remember({
    kind: "working",
    content: "请保存完整思维链",
    source: "test",
    eventId: "cot",
  }), /内部推理/);
});

test("记忆容量按层裁剪，过期工作记忆会被清理", () => {
  let now = Date.parse("2026-09-29T00:00:00.000Z");
  const store = new MemoryStore({ limits: { working: 2 }, clock: () => now });
  store.remember({ kind: "working", content: "旧观察", source: "test", eventId: "old", expiresAt: "2026-09-29T00:00:01.000Z" });
  now += 2000;
  store.remember({ kind: "working", content: "新观察一", source: "test", eventId: "new-1" });
  now += 1000;
  store.remember({ kind: "working", content: "新观察二", source: "test", eventId: "new-2" });
  now += 1000;
  store.remember({ kind: "working", content: "新观察三", source: "test", eventId: "new-3" });
  assert.deepEqual(store.list("working", { limit: 10 }).map((entry) => entry.eventId), ["new-3", "new-2"]);
});

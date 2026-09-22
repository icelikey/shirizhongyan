/**
 * 事件记录器单测（api/games/sdk/eventRecorder.test.ts）
 *
 * 纯逻辑，不碰数据库。断言三件事：
 *   1. seq 严格递增——回放依赖这个顺序
 *   2. secretAssign 恒带 secret 标记，且座位投影确实剥掉它
 *   3. 产出的事件流能被彩蛋判定器消费（两端契约对齐）
 *
 * 第 3 条是关键：此前彩蛋判定器只吃测试手造的数据，
 * 从未验证过「真实记录器产出的事件流」它能不能吃。
 */
import { describe, it, expect } from "vitest";
import {
  projectEvents,
  MATCH_LOG_VERSION,
  SPECTATOR,
} from "@contracts/matchLog";
import { detectEggs } from "../../world/eggs";
import { EventRecorder, newMatchSeed } from "./eventRecorder";

function recorder() {
  return new EventRecorder({
    seed: "seed-test",
    rulebookId: "rb-guess",
    startedAt: 1_700_000_000_000,
  });
}

/** 录一局完整的三轮猜数对局 */
function recordFullMatch(): EventRecorder {
  const rec = recorder();
  rec.matchStart([
    { index: 0, name: "旅人", kind: "human" },
    { index: 1, name: "璇玑", kind: "echo-bot" },
    { index: 2, name: "守拙", kind: "echo-bot" },
  ]);
  rec.secretAssign(0, "villager");
  rec.secretAssign(1, "werewolf");

  for (const round of [1, 2, 3]) {
    rec.roundBegin(round);
    rec.action(0, "guess", 33);
    rec.action(1, "guess", 22);
    rec.action(2, "guess", 50);
    rec.reveal({ round, mean: 35 }, [0]);
  }

  rec.matchEnd({
    rankings: [0, 1, 2],
    winnerSeat: 0,
    fragmentsDelta: { 0: 40, 1: -10, 2: -10 },
  });
  return rec;
}

/* ------------------------------------------------------------------ */
describe("seq 与 round", () => {
  it("seq 从 0 起严格递增", () => {
    const rec = recordFullMatch();
    const seqs = rec.all.map(e => e.seq);
    expect(seqs[0]).toBe(0);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i], `seq 在第 ${i} 处未递增`).toBe(seqs[i - 1] + 1);
    }
  });

  it("开局事件归第 0 轮", () => {
    const rec = recorder();
    rec.matchStart([{ index: 0, name: "旅人", kind: "human" }]);
    rec.secretAssign(0, "villager");
    expect(rec.all.every(e => e.round === 0)).toBe(true);
  });

  it("roundBegin 后的事件自动归属该轮", () => {
    const rec = recorder();
    rec.matchStart([{ index: 0, name: "旅人", kind: "human" }]);
    rec.roundBegin(2);
    rec.action(0, "guess", 33);
    rec.reveal({ mean: 20 }, [0]);

    const inRound2 = rec.all.filter(e => e.round === 2);
    expect(inRound2).toHaveLength(3); // roundBegin + action + reveal
  });

  it("count 与事件数一致", () => {
    const rec = recordFullMatch();
    expect(rec.count).toBe(rec.all.length);
  });
});

/* ------------------------------------------------------------------ */
describe("密态纪律", () => {
  it("secretAssign 恒带 secret 标记（调用方无从传错）", () => {
    const rec = recorder();
    rec.secretAssign(3, "werewolf");
    const e = rec.all[0];
    expect(e.t).toBe("secretAssign");
    expect(e.secret).toBe(true);
  });

  it("除 secretAssign 外无事件带 secret", () => {
    const rec = recordFullMatch();
    for (const e of rec.all) {
      if (e.t !== "secretAssign") {
        expect(e.secret, `${e.t} 不应为密态`).toBeUndefined();
      }
    }
  });

  it("座位投影只留自己的身份，剥掉他人的", () => {
    const rec = recordFullMatch();
    const seat0 = projectEvents([...rec.all], 0);
    const assigns = seat0.filter(e => e.t === "secretAssign");

    expect(assigns).toHaveLength(1);
    expect((assigns[0] as { seat: number }).seat).toBe(0);
  });

  it("全知投影保留全部密态事件", () => {
    const rec = recordFullMatch();
    const all = projectEvents([...rec.all], SPECTATOR);
    expect(all.filter(e => e.t === "secretAssign")).toHaveLength(2);
    expect(all).toHaveLength(rec.count);
  });

  it("任一座位的投影都不含他人身份（逐座位验证）", () => {
    const rec = recordFullMatch();
    for (const viewer of [0, 1, 2]) {
      const view = projectEvents([...rec.all], viewer);
      const leaked = view.filter(
        e => e.t === "secretAssign" && (e as { seat: number }).seat !== viewer,
      );
      expect(leaked, `座位 ${viewer} 的投影泄漏了他人身份`).toHaveLength(0);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("落库信封", () => {
  it("版本与契约一致", () => {
    expect(recordFullMatch().envelope().version).toBe(MATCH_LOG_VERSION);
  });

  it("携带种子与规则书 id（回放的两个必需项）", () => {
    const env = recordFullMatch().envelope();
    expect(env.seed).toBe("seed-test");
    expect(env.rulebookId).toBe("rb-guess");
  });

  it("matchEnd 后 endedAt 有值", () => {
    const env = recordFullMatch().envelope();
    expect(env.endedAt).not.toBeNull();
    expect(env.endedAt!).toBeGreaterThanOrEqual(env.startedAt);
  });

  it("未终局时 endedAt 为 null", () => {
    const rec = recorder();
    rec.matchStart([{ index: 0, name: "旅人", kind: "human" }]);
    expect(rec.envelope().endedAt).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
describe("与彩蛋判定器的契约对齐", () => {
  it("记录器产出的事件流能被 detectEggs 消费而不抛错", () => {
    const rec = recordFullMatch();
    expect(() => detectEggs([...rec.all])).not.toThrow();
  });

  it("纯数字局不触发守拙之证（场上无人发言，否则人人都中）", () => {
    // eggs.ts 要求「场上确实存在实质发言而胜者没发」，
    // 猜数局全程无 speech 事件，故不应触发——这是刻意的设计
    const rec = recordFullMatch();
    const hits = detectEggs([...rec.all]);
    expect(hits.find(h => h.eggId === "egg-silent-victory")).toBeUndefined();
  });

  it("他人有发言而胜者沉默时，守拙之证触发", () => {
    const rec = recorder();
    rec.matchStart([
      { index: 0, name: "旅人", kind: "human" },
      { index: 1, name: "璇玑", kind: "echo-bot" },
    ]);
    rec.roundBegin(1);
    rec.action(0, "guess", 33);
    rec.reveal({ mean: 20 }, [0]);
    rec.matchEnd({ rankings: [0, 1], winnerSeat: 0, fragmentsDelta: { 0: 40 } });

    // 补一条「他人」的实质发言：记录器无 speech 方法，
    // 那是狼人杀模板的事，此处手造以验证两端契约
    const withSpeech = [
      ...rec.all,
      {
        t: "speech" as const,
        seq: 99,
        round: 1,
        seat: 1,
        intent: "accuse" as const,
        targetSeat: 0,
        claimedRole: null,
        text: "我怀疑 0 号，他一直不说话。",
      },
    ];
    const hits = detectEggs(withSpeech);
    expect(hits.find(h => h.eggId === "egg-silent-victory")?.seat).toBe(0);
  });

  it("烛阴账本：败局碎片净收益为正应被判出", () => {
    const rec = recorder();
    rec.matchStart([
      { index: 0, name: "旅人", kind: "human" },
      { index: 1, name: "璇玑", kind: "echo-bot" },
    ]);
    rec.roundBegin(1);
    rec.action(0, "guess", 33);
    rec.reveal({ mean: 20 }, [1]);
    // 0 号败，但净收益为正
    rec.matchEnd({
      rankings: [1, 0],
      winnerSeat: 1,
      fragmentsDelta: { 0: 5, 1: 40 },
    });

    const hits = detectEggs([...rec.all]);
    expect(hits.find(h => h.eggId === "egg-profit-in-defeat")?.seat).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
describe("种子生成", () => {
  it("含房间码，便于溯源", () => {
    expect(newMatchSeed("ABCD")).toContain("ABCD");
  });

  it("同房间的两局种子不同（否则两局回放会混淆）", () => {
    expect(newMatchSeed("ABCD")).not.toBe(newMatchSeed("ABCD"));
  });
});

/**
 * ============================================================================
 * flyTease 模板单测（api/games/sdk/flyTease.test.ts）
 * ----------------------------------------------------------------------------
 * 不碰数据库、不起服务，直接测模板执行器的纯函数部分。三类断言：
 *
 * 一、**响应表本身是健康的**。这里有一条至关重要的回归断言：
 *     每一种行为都必须有牌能打中它。曾经出过一次事故——食管下区（drink）
 *     的概率峰值只有 0.228，永远当不了主导，于是蛐蛐偏好里每六轮就有一轮
 *     是死签：全场无论怎么出牌都拿不到分。这条断言就是那次事故的保险丝。
 *
 * 二、**判定与规则书条款逐条对应**。命中地板、拥挤系数、怒气、终局，
 *     都能在 rb-flytease 里找到一句话。条款与实现对不上就是裁判灾难。
 *
 * 三、**铁律边界**。大脑只影响「果蝇倾向做什么」，不参与胜负权重：
 *     得分恒为非负整数，且完全由命中概率、拥挤、怒气三者决定。
 *
 * 运行：npm run test -- api/games/sdk/flyTease.test.ts
 * ============================================================================
 */
import { describe, expect, it } from "vitest";
import type { FlyTeaseDefinition } from "@contracts/gameSdk";
import {
  FLY_BEHAVIORS,
  FLYTEASE_CORE_ID,
  FLYTEASE_DEFAULT_PARAMS,
  FLY_HIT_FLOOR,
  type FlyBehavior,
  type FlyTeaseParams,
  type FlyTeaseReveal,
  cricketMoodFor,
  crowdFactor,
  rageOf,
} from "@contracts/flyTease";
import type { RoundEntry } from "./templates";
import { getRuleBook, ruleBookForTemplate, RB_FLYTEASE } from "@contracts/rulebooks.data";
import { flyTeaseModule } from "./flyTease";
import { FLY_ATLAS } from "./flybrain/atlas.generated";

const CARD_COUNT = FLY_ATLAS.cards.length;

/**
 * 构造一个 flyTease 定义。
 *
 * 返回类型刻意收窄到 `FlyTeaseDefinition`（而不是 `GameDefinition` 联合）：
 * 否则 `def.params.fickleness` 这类访问会撞上判别联合、报「属性不存在」，
 * 而本文件通篇都要读蛐蛐参数。收窄后仍可安全传给 `flyTeaseModule` 的方法
 * （它们收的是更宽的 `GameDefinition`，子类型可直接赋值）。
 */
function defWith(overrides: Partial<FlyTeaseParams> = {}): FlyTeaseDefinition {
  return {
    id: FLYTEASE_CORE_ID,
    name: "测试虫室",
    template: "flyTease",
    seats: 6,
    isOfficial: true,
    params: { ...FLYTEASE_DEFAULT_PARAMS, ...overrides },
    entryFee: { suit: "diamond", amount: 0 },
    rewards: { winner: 1, runnerUp: 1, participation: 0 },
    submitWindowSec: 45,
  };
}

/** 按座位顺序构造提交（order 与 seat 对齐） */
function entries(values: number[]): RoundEntry[] {
  return values.map((value, seat) => ({ seat, value, order: seat }));
}

/** 某个偏好下最容易打中的牌 */
function bestCardFor(mood: FlyBehavior): number {
  let best = 0;
  for (const c of FLY_ATLAS.cards) {
    if ((c.behavior[mood] ?? 0) > (FLY_ATLAS.cards[best].behavior[mood] ?? 0)) {
      best = c.index;
    }
  }
  return best;
}

/** 找一张主导行为为 top 且对 mood 能打中的牌；找不到返回 -1 */
function cardToppedBy(top: FlyBehavior, mood: FlyBehavior): number {
  const hit = FLY_ATLAS.cards.find(
    (c) => c.top === top && (c.behavior[mood] ?? 0) >= FLY_HIT_FLOOR,
  );
  return hit ? hit.index : -1;
}

/** 找一个蛐蛐偏好恰为 mood 的轮次 */
function roundWithMood(mood: FlyBehavior, fickleness = 0.5): number {
  for (let round = 1; round <= 60; round++) {
    if (cricketMoodFor(FLYTEASE_CORE_ID, round, fickleness) === mood) return round;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
describe("响应表健康度", () => {
  it("每张牌的行为分布归一", () => {
    for (const c of FLY_ATLAS.cards) {
      const sum = FLY_BEHAVIORS.reduce((a, b) => a + (c.behavior[b] ?? 0), 0);
      expect(Math.abs(sum - 1), `${c.id} 分布和为 ${sum}`).toBeLessThan(1e-3);
    }
  });

  it("每种行为都有牌能打中它（回归：drink 曾是死签）", () => {
    for (const b of FLY_BEHAVIORS) {
      const hittable = FLY_ATLAS.cards.filter(
        (c) => (c.behavior[b] ?? 0) >= FLY_HIT_FLOOR,
      );
      expect(
        hittable.length,
        `偏好「${b}」没有任何牌能打中（地板 ${FLY_HIT_FLOOR}）—— 该偏好是死签`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("每种行为至少在一张牌上成为主导（否则该偏好必被打错）", () => {
    const tops = new Set(FLY_ATLAS.cards.map((c) => c.top));
    for (const b of FLY_BEHAVIORS) {
      expect(tops.has(b), `没有一张牌主导「${b}」`).toBe(true);
    }
  });

  it("标定值齐备且为正", () => {
    for (const b of FLY_BEHAVIORS) {
      expect(FLY_ATLAS.behaviorRefs[b], `${b} 缺参考分`).toBeGreaterThan(0);
    }
    for (const k of FLY_ATLAS.poolOrder) {
      expect(FLY_ATLAS.poolRefs[k], `池 ${k} 缺参考率`).toBeGreaterThan(0);
    }
  });

  it("牌堆无重复（静默无效的组合已被实测剔除）", () => {
    const ids = new Set(FLY_ATLAS.cards.map((c) => c.id));
    expect(ids.size).toBe(CARD_COUNT);
  });

  it("牌下标与数组下标一致（改序会让历史回放错位）", () => {
    FLY_ATLAS.cards.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("脉冲雨图是本局真跑出来的（有采样点、池下标合法）", () => {
    const lanes = FLY_ATLAS.poolOrder.length;
    for (const c of FLY_ATLAS.cards) {
      for (const [t, lane] of c.rain) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(FLY_ATLAS.durationMs);
        expect(lane).toBeGreaterThanOrEqual(-1);
        expect(lane).toBeLessThan(lanes);
      }
    }
    expect(FLY_ATLAS.cards.some((c) => c.rain.length > 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
describe("normalizeSubmission（动作边界）", () => {
  const def = defWith();

  it("接受合法的牌下标", () => {
    expect(flyTeaseModule.normalizeSubmission(def, { type: "choose", choice: 0 })).toBe(0);
    expect(
      flyTeaseModule.normalizeSubmission(def, {
        type: "choose",
        choice: CARD_COUNT - 1,
      }),
    ).toBe(CARD_COUNT - 1);
  });

  it("拒绝越界与非整数下标", () => {
    for (const choice of [-1, CARD_COUNT, 1.5, Number.NaN]) {
      expect(() =>
        flyTeaseModule.normalizeSubmission(def, { type: "choose", choice }),
      ).toThrowError();
    }
  });

  it("接受牌 id 形式（给外部 Agent 的可读入口）", () => {
    const target = FLY_ATLAS.cards[7];
    expect(
      flyTeaseModule.normalizeSubmission(def, {
        type: "play",
        cardId: target.id,
      }),
    ).toBe(target.index);
  });

  it("拒绝未知的牌 id", () => {
    expect(() =>
      flyTeaseModule.normalizeSubmission(def, {
        type: "play",
        cardId: "ft:nope:999:none",
      }),
    ).toThrowError();
  });

  it("非提交动作返回 null", () => {
    expect(flyTeaseModule.normalizeSubmission(def, { type: "start" })).toBeNull();
    expect(
      flyTeaseModule.normalizeSubmission(def, { type: "submit", value: 3 }),
    ).toBeNull();
  });

  it("超时兜底确定且在界内", () => {
    for (let seat = 0; seat < 8; seat++) {
      const v = flyTeaseModule.timeoutFallback(def, seat);
      expect(v).toBe(seat % CARD_COUNT);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(CARD_COUNT);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("botPick", () => {
  const def = defWith();

  it("任何等级都返回合法下标", () => {
    for (const levelK of [0, 0.5, 1, 2.4, 3.6, 5]) {
      for (let i = 0; i < 12; i++) {
        const v = flyTeaseModule.botPick(def, 0, levelK, []);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(CARD_COUNT);
      }
    }
  });

  it("高阶 bot 会挑能打中本轮偏好的牌", () => {
    const mood = cricketMoodFor(def.id, 1, def.params.fickleness);
    const p = def.params;
    const picks: number[] = [];
    for (let i = 0; i < 40; i++) {
      picks.push(flyTeaseModule.botPick(def, 0, 3.6, []));
    }
    const hitRate =
      picks.filter((i) => (FLY_ATLAS.cards[i].behavior[mood] ?? 0) >= FLY_HIT_FLOOR)
        .length / picks.length;
    // 噪声只占 0.2*3，不应把「读表」冲掉
    expect(hitRate).toBeGreaterThan(0.7);
    // 且这些牌确实不是随机撞上的
    const randomRate =
      FLY_ATLAS.cards.filter((c) => (c.behavior[mood] ?? 0) >= FLY_HIT_FLOOR)
        .length / CARD_COUNT;
    expect(hitRate).toBeGreaterThan(randomRate);
    expect(p.crowding).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
describe("规则书接线", () => {
  it("flyTease 模板挂上了规则书（AI 裁判与质询都需要条款正文）", () => {
    expect(ruleBookForTemplate("flyTease")).toBe(RB_FLYTEASE);
    expect(getRuleBook("rb-flytease")).toBe(RB_FLYTEASE);
  });

  it("留有不止一条可质询的边缘条款（质询的主战场）", () => {
    const edge = RB_FLYTEASE.clauses.filter((c) => c.category === "edge");
    expect(edge.length).toBeGreaterThan(1);
  });

  it("命中地板写进了规则书正文，改代码不会让条款失效", () => {
    const clause = RB_FLYTEASE.clauses.find((c) => c.id === "c-fly-hit");
    expect(clause).toBeDefined();
    expect(clause!.text).toContain(
      String(Math.round(FLY_HIT_FLOOR * 100)),
    );
  });
});

/* ------------------------------------------------------------------ */
describe("resolveRound（判定与规则书对应）", () => {
  it("命中者得分、未命中者零分，且恒为非负整数", () => {
    const def = defWith();
    const mood = cricketMoodFor(def.id, 1, def.params.fickleness);
    const good = bestCardFor(mood);
    const bad = FLY_ATLAS.cards.find(
      (c) => (c.behavior[mood] ?? 0) < FLY_HIT_FLOOR,
    )!.index;
    const r = flyTeaseModule.resolveRound(def, 1, entries([good, good, bad, bad]))
      .reveal as FlyTeaseReveal;

    expect(r.cricketMood).toBe(mood);
    for (const seat of [0, 1, 2, 3]) {
      const g = r.gains[seat];
      expect(Number.isInteger(g)).toBe(true);
      expect(g).toBeGreaterThanOrEqual(0);
    }
    expect(r.gains[0]).toBeGreaterThan(0);
    expect(r.gains[2]).toBe(0);
  });

  it("低于地板的牌一定零分（地板就是地板）", () => {
    const def = defWith();
    const mood = cricketMoodFor(def.id, 2, def.params.fickleness);
    const bad = FLY_ATLAS.cards.find((c) => (c.behavior[mood] ?? 0) < FLY_HIT_FLOOR);
    if (!bad) return; // 该偏好下人人可中，跳过
    const r = flyTeaseModule.resolveRound(def, 2, entries([bad.index])).reveal as FlyTeaseReveal;
    expect(r.gains[0]).toBe(0);
    expect(r.rage).toBe(0);
  });

  it("拥挤：同主导行为的人越多，每人的系数越小", () => {
    const def = defWith({ crowding: 0.8 });
    const mood = cricketMoodFor(def.id, 3, def.params.fickleness);
    const top = FLY_ATLAS.cards[bestCardFor(mood)].top;
    const mate = cardToppedBy(top, mood);
    if (mate < 0) return;

    const solo = flyTeaseModule.resolveRound(def, 3, entries([mate])).reveal as FlyTeaseReveal;
    const pair = flyTeaseModule.resolveRound(def, 3, entries([mate, mate])).reveal as FlyTeaseReveal;

    expect(solo.crowd[0]).toBe(1);
    expect(pair.crowd[0]).toBeLessThan(1);
    expect(pair.crowd[0]).toBeCloseTo(crowdFactor(2, 0.8), 6);
    expect(pair.gains[0]).toBeLessThanOrEqual(solo.gains[0]);
  });

  it("拥挤参数为 0 时不摊薄（规则书 c-fly-crowd 的边界）", () => {
    const def = defWith({ crowding: 0 });
    const mood = cricketMoodFor(def.id, 3, def.params.fickleness);
    const idx = bestCardFor(mood);
    const r = flyTeaseModule.resolveRound(def, 3, entries([idx, idx])).reveal as FlyTeaseReveal;
    expect(r.crowd[0]).toBe(1);
  });

  it("怒气越过阈值则本轮全场归零（规则书 c-fly-rage）", () => {
    const round = roundWithMood("charge");
    if (round < 0) return;
    const def = defWith({ rageThreshold: 1, fickleness: 0.5 });
    const mood = cricketMoodFor(def.id, round, def.params.fickleness);
    const chargeCard = cardToppedBy("charge", mood);
    if (chargeCard < 0) return;

    const r = flyTeaseModule.resolveRound(
      def,
      round,
      entries([chargeCard, chargeCard, chargeCard]),
    ).reveal as FlyTeaseReveal;

    expect(rageOf("charge")).toBeGreaterThan(0);
    expect(r.rage).toBeGreaterThanOrEqual(def.params.rageThreshold);
    expect(r.raged).toBe(true);
    for (const seat of [0, 1, 2]) expect(r.gains[seat]).toBe(0);
    expect(flyTeaseModule.roundWinners(r)).toEqual([]);
  });

  it("怒气按「真的做出来了」计：未命中不激怒", () => {
    const def = defWith();
    const mood = cricketMoodFor(def.id, 5, def.params.fickleness);
    const bad = FLY_ATLAS.cards.find((c) => (c.behavior[mood] ?? 0) < FLY_HIT_FLOOR);
    if (!bad) return;
    const r = flyTeaseModule.resolveRound(def, 5, entries([bad.index, bad.index]))
      .reveal as FlyTeaseReveal;
    expect(r.rage).toBe(0);
    expect(r.raged).toBe(false);
  });

  it("同一轮同输入必得同结果（可回放）", () => {
    const def = defWith();
    const idx = bestCardFor(cricketMoodFor(def.id, 4, def.params.fickleness));
    const e = entries([idx, idx, idx]);
    const a = flyTeaseModule.resolveRound(def, 4, e).reveal;
    const b = flyTeaseModule.resolveRound(def, 4, e).reveal;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("揭晓带上脉冲雨图与池序（演出要用的都在）", () => {
    const def = defWith();
    const idx = bestCardFor(cricketMoodFor(def.id, 6, def.params.fickleness));
    const r = flyTeaseModule.resolveRound(def, 6, entries([idx])).reveal as FlyTeaseReveal;
    expect(r.poolOrder).toEqual(FLY_ATLAS.poolOrder);
    expect(r.engine).toBe(FLY_ATLAS.engine);
    expect(Array.isArray(r.rain[idx])).toBe(true);
  });

  it("roundWinners 只含真正得分的座位", () => {
    const def = defWith();
    const mood = cricketMoodFor(def.id, 1, def.params.fickleness);
    const good = bestCardFor(mood);
    const bad = FLY_ATLAS.cards.find((c) => (c.behavior[mood] ?? 0) < FLY_HIT_FLOOR)!.index;
    // 顺序刻意打乱：entries 允许非座位序，结算不应依赖它
    const r = flyTeaseModule.resolveRound(def, 1, [
      { seat: 3, value: bad, order: 0 },
      { seat: 1, value: good, order: 1 },
    ]).reveal as FlyTeaseReveal;
    const winners = flyTeaseModule.roundWinners(r);
    expect(winners).toEqual([1]);
    expect(Number.isInteger(winners[0])).toBe(true);
  });

  it("scoreWin 线性缩放得分（不改判定，只改量级）", () => {
    const moodPool = [1, 2, 3];
    const one = defWith({ scoreWin: 2 });
    const two = defWith({ scoreWin: 8 });
    const mood = cricketMoodFor(one.id, moodPool[0], one.params.fickleness);
    const idx = bestCardFor(mood);
    const a = flyTeaseModule.resolveRound(one, 1, entries([idx])).reveal as FlyTeaseReveal;
    const b = flyTeaseModule.resolveRound(two, 1, entries([idx])).reveal as FlyTeaseReveal;
    expect(b.gains[0]).toBeGreaterThanOrEqual(a.gains[0]);
    expect(b.hits[0]).toBeCloseTo(a.hits[0], 6);
  });
});

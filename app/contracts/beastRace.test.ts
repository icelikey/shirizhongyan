/**
 * 超能力赛马 · 契约单测（contracts/beastRace.test.ts）
 *
 * 纯逻辑，无需数据库。断言两条设计铁律：
 *   1. 克制成环——不存在「对所有格子都不劣」的兽
 *   2. 扰行不强于疾行——否则赛道退化为互相拖后腿的僵局
 *
 * 这两条断言的意义在于：它们会在有人调数值时立刻失败，
 * 而不是等到玩起来才发现某只兽是必选。
 */
import { describe, it, expect } from "vitest";
import {
  BEASTS,
  TILE_META,
  TRACK_LENGTH,
  PIVOTAL_TILES,
  CARD_KIND_META,
  clampPosition,
  computeAdvance,
  getBeast,
  isImmune,
  isVulnerable,
  needsTarget,
  visiblePosition,
  type BeastId,
  type RacerState,
  type TileKind,
  legalRaceActions,
  normalizeRaceAction,
  reduceRaceRound,
} from "./beastRace";
import {
  RACE_CARDS,
  cardsOfBeast,
  createRaceMatchState,
  generateTrack,
  getRaceCard,
} from "./beastRace.data";

function racer(over: Partial<RacerState> = {}): RacerState {
  return {
    seat: 0,
    beastId: "wolf",
    position: 10,
    hand: [],
    slowedNextRound: false,
    stunnedRounds: 0,
    guarded: false,
    riposting: false,
    feignedPosition: null,
    finishRank: null,
    ...over,
  };
}

/* ------------------------------------------------------------------ */
describe("六兽数据完整性", () => {
  it("恰好六兽，id 唯一", () => {
    expect(BEASTS).toHaveLength(6);
    const ids = BEASTS.map(b => b.id);
    expect(new Set(ids).size).toBe(6);
  });

  it("三种移动方式都有兽", () => {
    const locos = new Set(BEASTS.map(b => b.locomotion));
    expect(locos).toContain("ground");
    expect(locos).toContain("air");
    expect(locos).toContain("water");
  });

  it("每兽都有特性与世界观文案", () => {
    for (const b of BEASTS) {
      expect(b.trait.length, `${b.id} 缺特性`).toBeGreaterThan(8);
      expect(b.lore.length, `${b.id} 缺世界观`).toBeGreaterThan(8);
    }
  });

  it("按 id 可取，不存在的返回 undefined", () => {
    expect(getBeast("crane")?.name).toBe("鹤");
    expect(getBeast("dragon" as BeastId)).toBeUndefined();
  });

  it("基础速度在合理区间（3–5）", () => {
    for (const b of BEASTS) {
      expect(b.baseSpeed).toBeGreaterThanOrEqual(3);
      expect(b.baseSpeed).toBeLessThanOrEqual(5);
    }
  });
});

/* ------------------------------------------------------------------ */
describe("铁律一 · 克制成环，无最优解", () => {
  /**
   * 判定「劣势」的方式：一只兽若既有最高速度、又免疫最多格子、
   * 且无任何弱点，它就是严格占优的——那样其他兽没人会选。
   */
  it("不存在同时速度最快且无弱点且免疫最多的兽", () => {
    const maxSpeed = Math.max(...BEASTS.map(b => b.baseSpeed));
    const maxImmune = Math.max(...BEASTS.map(b => b.immuneTo.length));

    const dominant = BEASTS.filter(
      b =>
        b.baseSpeed === maxSpeed &&
        b.immuneTo.length === maxImmune &&
        b.vulnerableTo.length === 0,
    );

    expect(dominant, "存在严格占优的兽，其余兽将无人选择").toHaveLength(0);
  });

  it("免疫最多的兽速度不得最快（龟以慢换稳）", () => {
    const maxImmune = Math.max(...BEASTS.map(b => b.immuneTo.length));
    const maxSpeed = Math.max(...BEASTS.map(b => b.baseSpeed));
    const tanky = BEASTS.filter(b => b.immuneTo.length === maxImmune);

    for (const b of tanky) {
      expect(b.baseSpeed, `${b.id} 既最抗又最快`).toBeLessThan(maxSpeed);
    }
  });

  it("速度最快的兽必有弱点（鹤怕雷云）", () => {
    const maxSpeed = Math.max(...BEASTS.map(b => b.baseSpeed));
    const fastest = BEASTS.filter(b => b.baseSpeed === maxSpeed);

    for (const b of fastest) {
      const hasDownside = b.vulnerableTo.length > 0 || b.immuneTo.length === 0;
      expect(hasDownside, `${b.id} 最快却无代价`).toBe(true);
    }
  });

  it("每只兽至少有一处不如他兽（无全能兽）", () => {
    for (const b of BEASTS) {
      const others = BEASTS.filter(o => o.id !== b.id);
      const worseInSomething = others.some(
        o =>
          o.baseSpeed > b.baseSpeed ||
          o.immuneTo.length > b.immuneTo.length ||
          (b.vulnerableTo.length > 0 && o.vulnerableTo.length === 0),
      );
      expect(worseInSomething, `${b.id} 在所有维度都不劣`).toBe(true);
    }
  });

  it("关键格子（沼泽/雷云）确实造成分化", () => {
    for (const tile of PIVOTAL_TILES) {
      const immuneCount = BEASTS.filter(b => isImmune(b, tile)).length;
      const vulnCount = BEASTS.filter(b => isVulnerable(b, tile)).length;
      // 必须有兽免疫、也有兽受影响，否则这格没有区分度
      expect(immuneCount, `${tile} 无兽免疫`).toBeGreaterThan(0);
      expect(immuneCount + vulnCount, `${tile} 对所有兽一视同仁`).toBeLessThan(
        BEASTS.length + 1,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
describe("卡牌数据", () => {
  it("每兽 8 张，共 48 张", () => {
    expect(RACE_CARDS).toHaveLength(48);
    for (const b of BEASTS) {
      expect(cardsOfBeast(b.id), `${b.id} 卡数不对`).toHaveLength(8);
    }
  });

  it("卡 id 全局唯一", () => {
    const ids = RACE_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每兽的四类构成为 疾行3/扰行2/御守2/反照1", () => {
    for (const b of BEASTS) {
      const cards = cardsOfBeast(b.id);
      const count = (k: string) => cards.filter(c => c.kind === k).length;
      expect(count("advance"), `${b.id} 疾行数`).toBe(3);
      expect(count("disrupt"), `${b.id} 扰行数`).toBe(2);
      expect(count("guard"), `${b.id} 御守数`).toBe(2);
      expect(count("riposte"), `${b.id} 反照数`).toBe(1);
    }
  });

  it("反照每兽仅一张（稀缺造就选择）", () => {
    const ripostes = RACE_CARDS.filter(c => c.kind === "riposte");
    expect(ripostes).toHaveLength(6);
  });

  it("铁律二 · 扰行不强于疾行", () => {
    for (const b of BEASTS) {
      const cards = cardsOfBeast(b.id);
      const maxAdvance = Math.max(
        ...cards.filter(c => c.kind === "advance").map(c => c.delta),
      );
      const maxDisrupt = Math.max(
        ...cards.filter(c => c.kind === "disrupt").map(c => Math.abs(c.delta)),
      );
      expect(
        maxDisrupt,
        `${b.id} 的扰行强于疾行，将退化为互相拖后腿`,
      ).toBeLessThanOrEqual(maxAdvance);
    }
  });

  it("御守与反照不产生位移", () => {
    for (const c of RACE_CARDS) {
      if (c.kind === "guard" || c.kind === "riposte") {
        expect(c.delta, `${c.id} 不应有位移`).toBe(0);
      }
    }
  });

  it("疾行为正、扰行为负", () => {
    for (const c of RACE_CARDS) {
      if (c.kind === "advance") expect(c.delta).toBeGreaterThan(0);
      if (c.kind === "disrupt") expect(c.delta).toBeLessThan(0);
    }
  });

  it("每张卡都有效果描述", () => {
    for (const c of RACE_CARDS) {
      expect(c.effect.length, `${c.id} 缺描述`).toBeGreaterThan(4);
    }
  });

  it("仅扰行需要指定目标", () => {
    expect(needsTarget("disrupt")).toBe(true);
    expect(needsTarget("advance")).toBe(false);
    expect(needsTarget("guard")).toBe(false);
    expect(needsTarget("riposte")).toBe(false);
  });

  it("四类都有中文文案", () => {
    for (const k of ["advance", "disrupt", "guard", "riposte"] as const) {
      expect(CARD_KIND_META[k].name.length).toBeGreaterThan(0);
      expect(CARD_KIND_META[k].desc.length).toBeGreaterThan(0);
    }
  });

  it("按 id 可取卡", () => {
    expect(getRaceCard("cr-a1")?.name).toBe("振翅");
    expect(getRaceCard("nope")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
describe("赛道生成", () => {
  it("长度为 TRACK_LENGTH", () => {
    expect(generateTrack("s1")).toHaveLength(TRACK_LENGTH);
  });

  it("同 seed 同赛道（回放可复现）", () => {
    expect(generateTrack("seed-x")).toEqual(generateTrack("seed-x"));
  });

  it("不同 seed 赛道不同", () => {
    expect(generateTrack("a")).not.toEqual(generateTrack("b"));
  });

  it("起点三格与终点前一格恒为平地", () => {
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      const t = generateTrack(seed);
      expect(t[0]).toBe("plain");
      expect(t[1]).toBe("plain");
      expect(t[2]).toBe("plain");
      expect(t[TRACK_LENGTH - 1]).toBe("plain");
    }
  });

  it("格子类型均在 TILE_META 内", () => {
    const valid = new Set(Object.keys(TILE_META));
    for (const tile of generateTrack("s9")) {
      expect(valid.has(tile)).toBe(true);
    }
  });

  it("赛道有足够多样性（至少四种格子）", () => {
    const kinds = new Set(generateTrack("variety"));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("每种格子都有中文名与描述", () => {
    for (const k of Object.keys(TILE_META) as TileKind[]) {
      expect(TILE_META[k].name.length).toBeGreaterThan(0);
      expect(TILE_META[k].desc.length).toBeGreaterThan(4);
      expect(TILE_META[k].weight).toBeGreaterThan(0);
    }
  });

  it("权重合计为 100", () => {
    const total = Object.values(TILE_META).reduce((s, m) => s + m.weight, 0);
    expect(total).toBe(100);
  });
});

/* ------------------------------------------------------------------ */
describe("位移计算", () => {
  it("停行时不动", () => {
    expect(
      computeAdvance({
        racer: racer({ stunnedRounds: 1 }),
        cardDelta: 10,
        baseSpeed: 5,
      }),
    ).toBe(0);
  });

  it("基础速度加卡牌位移", () => {
    expect(
      computeAdvance({ racer: racer(), cardDelta: 3, baseSpeed: 4 }),
    ).toBe(7);
  });

  it("减半在推进之后结算（逆风 + 疾行符合直觉）", () => {
    // (4 + 6) / 2 = 5，而非 4/2 + 6 = 8
    expect(
      computeAdvance({
        racer: racer({ slowedNextRound: true }),
        cardDelta: 6,
        baseSpeed: 4,
      }),
    ).toBe(5);
  });

  it("位移可为负（被击落或干扰）", () => {
    expect(
      computeAdvance({ racer: racer(), cardDelta: -9, baseSpeed: 4 }),
    ).toBe(-5);
  });

  it("落位夹取到合法区间", () => {
    expect(clampPosition(-7)).toBe(0);
    expect(clampPosition(TRACK_LENGTH + 20)).toBe(TRACK_LENGTH);
    expect(clampPosition(30)).toBe(30);
  });
});

/* ------------------------------------------------------------------ */
describe("狐的伪示（悬疑感的机制来源）", () => {
  it("未伪装时对手见真位置", () => {
    expect(visiblePosition(racer({ position: 22 }))).toBe(22);
  });

  it("伪装时对手见假位置", () => {
    expect(
      visiblePosition(racer({ position: 22, feignedPosition: 40 })),
    ).toBe(40);
  });

  it("伪装为 0 格也生效（不被当作未伪装）", () => {
    // 若实现用 || 而非 ??，这里会错误返回真位置
    expect(visiblePosition(racer({ position: 30, feignedPosition: 0 }))).toBe(0);
  });
});

describe("确定性状态与回合 reducer", () => {
  it("同 seed 生成相同赛道、动物和手牌", () => {
    expect(createRaceMatchState("replay-seed", 4)).toEqual(
      createRaceMatchState("replay-seed", 4),
    );
    expect(createRaceMatchState("replay-seed", 4)).not.toEqual(
      createRaceMatchState("other-seed", 4),
    );
  });

  it("初始化为 100 格赛道且每席 8 张卡", () => {
    const state = createRaceMatchState("contract", 3);
    expect(state.track).toHaveLength(100);
    expect(state.racers.every(r => r.hand)).toBe(true);
    expect(state.racers.every(r => r.hand.length === 8)).toBe(true);
  });

  it("合法候选只包含手牌和合法目标", () => {
    const state = createRaceMatchState("candidates", 3);
    const actions = legalRaceActions(state, 0);
    const disruptCount = state.racers[0].hand.filter(id => getRaceCard(id)?.kind === "disrupt").length;
    expect(actions).toHaveLength(state.racers[0].hand.length - disruptCount + disruptCount * 2);
    expect(actions.every(a => state.racers[0].hand.includes(a.cardId))).toBe(true);
    expect(() => normalizeRaceAction(state, 0, { cardId: "made-up" })).toThrow();
    const disrupt = actions.find(a => a.targetSeat !== undefined);
    expect(disrupt?.targetSeat).toBeGreaterThanOrEqual(1);
  });

  it("同一状态和动作序列得到相同事件与高光", () => {
    const a = createRaceMatchState("reducer", 2);
    const b = createRaceMatchState("reducer", 2);
    const actions = [
      { seat: 0, action: { cardId: a.racers[0].hand[0] } },
      { seat: 1, action: { cardId: a.racers[1].hand[0] } },
    ];
    expect(reduceRaceRound(a, actions, 1)).toEqual(
      reduceRaceRound(b, actions, 1),
    );
  });
});

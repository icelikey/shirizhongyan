/**
 * 世界层地基测试（api/world/eggs.test.ts）
 * - 事件流投影零泄漏（扰动测试）
 * - 彩蛋判定
 * - 残章组拼图 / 塔门门禁
 * - 异能触发条件
 */
import { describe, it, expect } from "vitest";
import {
  projectEvents,
  SPECTATOR,
  type MatchEvent,
} from "@contracts/matchLog";
import { detectEggs } from "./eggs";
import {
  RELIC_CARDS,
  RELIC_SETS,
  isSetComplete,
  completedSetIds,
} from "@contracts/relics";
import { checkGate, tierOfFloor, zodiacOfFloor, isBossFloor } from "@contracts/spire";
import { ABILITIES, abilityOfEcho } from "@contracts/abilities.data";
import {
  canUseAbility,
  abilitySlotsForTier,
  type TriggerContext,
} from "@contracts/ability";

/* ------------------------------------------------------------------ */
/* 构造一局狼人杀样本事件流                                              */
/* ------------------------------------------------------------------ */

function wolfMatch(): MatchEvent[] {
  let seq = 0;
  const n = () => seq++;
  return [
    {
      t: "matchStart",
      seq: n(),
      round: 0,
      rulebookId: "rb-werewolf",
      seed: "seed-abc",
      seats: [
        { index: 0, name: "白泽", kind: "echo-bot", echoId: "baize" },
        { index: 1, name: "讹兽", kind: "echo-bot", echoId: "eshou" },
        { index: 2, name: "璇玑", kind: "echo-bot", echoId: "xuanji" },
        { index: 3, name: "守拙", kind: "echo-bot", echoId: "shouzhuo" },
      ],
    },
    // 密态：1 号是狼，0 号是预言家
    { t: "secretAssign", seq: n(), round: 0, secret: true, seat: 0, value: "seer" },
    { t: "secretAssign", seq: n(), round: 0, secret: true, seat: 1, value: "werewolf" },
    { t: "secretAssign", seq: n(), round: 0, secret: true, seat: 2, value: "villager" },
    { t: "secretAssign", seq: n(), round: 0, secret: true, seat: 3, value: "villager" },
    { t: "roundBegin", seq: n(), round: 1 },
    // 1 号狼人悍跳预言家
    {
      t: "speech",
      seq: n(),
      round: 1,
      seat: 1,
      intent: "seerClaim",
      targetSeat: 2,
      claimedRole: "seer",
      text: "我是预言家，昨晚验了 3 号，是好人。",
    },
    // 3 号守拙只划水
    {
      t: "speech",
      seq: n(),
      round: 1,
      seat: 3,
      intent: "pass",
      targetSeat: null,
      claimedRole: null,
      text: "过。",
    },
    { t: "eliminate", seq: n(), round: 1, seat: 0, reason: "vote" },
    {
      t: "matchEnd",
      seq: n(),
      round: 1,
      rankings: [1, 3, 2, 0],
      winnerSeat: 1,
      fragmentsDelta: { 0: -15, 1: 60, 2: 8, 3: 8 },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 投影零泄漏                                                           */
/* ------------------------------------------------------------------ */

describe("事件流投影", () => {
  it("全知视角看到全部事件", () => {
    const events = wolfMatch();
    expect(projectEvents(events, SPECTATOR)).toHaveLength(events.length);
  });

  it("座位视角看不到他人的密态身份", () => {
    const seen = projectEvents(wolfMatch(), 2);
    const secrets = seen.filter(e => e.t === "secretAssign");
    expect(secrets).toHaveLength(1);
    expect(secrets[0]).toMatchObject({ seat: 2, value: "villager" });
  });

  it("座位视角完全不含其他 secret 事件", () => {
    for (const viewer of [0, 1, 2, 3]) {
      const seen = projectEvents(wolfMatch(), viewer);
      const leaked = seen.filter(
        e => e.secret && !(e.t === "secretAssign" && e.seat === viewer)
      );
      expect(leaked).toEqual([]);
    }
  });

  it("扰动测试：改写他人密态身份不影响座位投影的字节输出", () => {
    const base = wolfMatch();
    const baseline = JSON.stringify(projectEvents(base, 2));

    // 逐一篡改每个非本座的密态事件，投影结果必须完全不变
    for (let i = 0; i < base.length; i++) {
      const e = base[i];
      if (!e.secret) continue;
      if (e.t === "secretAssign" && e.seat === 2) continue;
      const mutated = wolfMatch();
      const target = mutated[i];
      if (target.t === "secretAssign") {
        target.value = "TAMPERED";
      }
      expect(JSON.stringify(projectEvents(mutated, 2))).toBe(baseline);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 彩蛋判定                                                             */
/* ------------------------------------------------------------------ */

describe("彩蛋判定", () => {
  it("悍跳未被投出且获胜 → 讹兽之舌", () => {
    const hits = detectEggs(wolfMatch());
    const bluff = hits.find(h => h.eggId === "egg-unpunished-bluff");
    expect(bluff).toBeDefined();
    expect(bluff!.seat).toBe(1);
    expect(bluff!.cardId).toBe("r-spade-03");
  });

  it("获胜者有实质发言 → 不触发守拙之证", () => {
    const hits = detectEggs(wolfMatch());
    expect(hits.find(h => h.eggId === "egg-silent-victory")).toBeUndefined();
  });

  it("悍跳者被票出 → 不触发讹兽之舌（即便最终己方获胜）", () => {
    const events = wolfMatch();
    // 1 号悍跳者被放逐，但狼队仍然赢下本局
    const endIdx = events.findIndex(e => e.t === "matchEnd");
    events.splice(endIdx, 0, {
      t: "eliminate",
      seq: 200,
      round: 1,
      seat: 1,
      reason: "vote",
    });
    const hits = detectEggs(events);
    expect(hits.find(h => h.eggId === "egg-unpunished-bluff")).toBeUndefined();
  });

  it("未悍跳（声称与真实身份一致）→ 不触发讹兽之舌", () => {
    const events = wolfMatch();
    for (const e of events) {
      if (e.t === "secretAssign" && e.seat === 1) e.value = "seer";
    }
    const hits = detectEggs(events);
    expect(hits.find(h => h.eggId === "egg-unpunished-bluff")).toBeUndefined();
  });

  it("零实质发言获胜 → 守拙之证", () => {
    const events = wolfMatch();
    const end = events.find(e => e.t === "matchEnd")!;
    if (end.t === "matchEnd") {
      end.winnerSeat = 3; // 守拙只说过「过」
      end.rankings = [3, 1, 2, 0];
    }
    const hits = detectEggs(events);
    const silent = hits.find(h => h.eggId === "egg-silent-victory");
    expect(silent).toBeDefined();
    expect(silent!.seat).toBe(3);
  });

  it("败者碎片净收益为正 → 烛阴账本", () => {
    const hits = detectEggs(wolfMatch());
    const seats = hits
      .filter(h => h.eggId === "egg-profit-in-defeat")
      .map(h => h.seat)
      .sort();
    expect(seats).toEqual([2, 3]); // 0 号为 -15，不计
  });

  it("质询被采纳 → 驳律者，且积分最高", () => {
    const events = wolfMatch();
    events.splice(events.length - 1, 0, {
      t: "appeal",
      seq: 100,
      round: 1,
      seat: 2,
      clauseId: "c3",
      assertion: "第三条只写「得分最高者获胜」，未写「须存活」。",
    });
    events.splice(events.length - 1, 0, {
      t: "ruling",
      seq: 101,
      round: 1,
      clauseId: "c3",
      upheld: true,
      appellantSeat: 2,
      judgeVotes: [true, true, false],
    });
    const hits = detectEggs(events);
    const appeal = hits.find(h => h.eggId === "egg-appeal-upheld");
    expect(appeal).toBeDefined();
    expect(appeal!.seat).toBe(2);
    const maxScore = Math.max(...hits.map(h => h.score));
    expect(appeal!.score).toBe(maxScore);
  });

  it("空事件流不崩、不产出", () => {
    expect(detectEggs([])).toEqual([]);
  });

  it("猜平均数五轮全中 level-3 锚点 → 璇玑算珠", () => {
    const anchor = 50 * Math.pow(2 / 3, 3);
    const events: MatchEvent[] = [
      {
        t: "matchStart",
        seq: 0,
        round: 0,
        rulebookId: "rb-guess",
        seed: "s",
        seats: [{ index: 0, name: "璇玑", kind: "echo-bot" }],
      },
      ...Array.from({ length: 5 }, (_, i): MatchEvent => ({
        t: "action",
        seq: i + 1,
        round: i + 1,
        seat: 0,
        kind: "submit",
        value: anchor + (i % 2 === 0 ? 0.4 : -0.4),
      })),
      {
        t: "matchEnd",
        seq: 6,
        round: 5,
        rankings: [0],
        winnerSeat: 0,
        fragmentsDelta: { 0: 50 },
      },
    ];
    const hits = detectEggs(events);
    expect(hits.find(h => h.eggId === "egg-level3-precision")?.seat).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* 残章拼图                                                             */
/* ------------------------------------------------------------------ */

describe("残章卡与拼图组", () => {
  it("卡牌 id 全局唯一", () => {
    const ids = RELIC_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每组引用的卡都存在，且组内序号连续", () => {
    const byId = new Map(RELIC_CARDS.map(c => [c.id, c]));
    for (const set of RELIC_SETS) {
      expect(set.cardIds.length).toBeGreaterThan(0);
      set.cardIds.forEach((id, i) => {
        const card = byId.get(id);
        expect(card, `${set.id} 引用了不存在的卡 ${id}`).toBeDefined();
        expect(card!.setId).toBe(set.id);
        expect(card!.setIndex).toBe(i);
        expect(card!.suit).toBe(set.suit);
      });
    }
  });

  it("每张卡都归属于某个已声明的组", () => {
    const setIds = new Set(RELIC_SETS.map(s => s.id));
    for (const c of RELIC_CARDS) {
      expect(setIds.has(c.setId), `${c.id} 的组 ${c.setId} 未声明`).toBe(true);
    }
  });

  it("集齐才算完成，缺一张不行", () => {
    const set = RELIC_SETS[0];
    expect(isSetComplete(set.id, set.cardIds)).toBe(true);
    expect(isSetComplete(set.id, set.cardIds.slice(0, -1))).toBe(false);
  });

  it("completedSetIds 只返回已齐的组", () => {
    const a = RELIC_SETS[0];
    const b = RELIC_SETS[1];
    const owned = [...a.cardIds, b.cardIds[0]];
    expect(completedSetIds(owned)).toEqual([a.id]);
  });

  it("每卷残章都有出处，卷序在 1–10 内", () => {
    for (const c of RELIC_CARDS) {
      expect(c.volumeId).toBeGreaterThanOrEqual(1);
      expect(c.volumeId).toBeLessThanOrEqual(10);
      expect(c.text.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 塔门门禁                                                             */
/* ------------------------------------------------------------------ */

describe("爬塔层门", () => {
  const emptyCtx = {
    completedRelicSetIds: [],
    hasAnyRuling: false,
    hasAuthoredGame: false,
    fragments: { spade: 0, heart: 0, club: 0, diamond: 0 },
  };

  it("开放层直接通过", () => {
    expect(checkGate({ kind: "open" }, emptyCtx).passed).toBe(true);
  });

  it("残章门要求集齐对应组", () => {
    const gate = { kind: "relicSet" as const, setId: "set-spade-flaw" };
    expect(checkGate(gate, emptyCtx).passed).toBe(false);
    expect(checkGate(gate, emptyCtx).hint).not.toBe("");
    expect(
      checkGate(gate, {
        ...emptyCtx,
        completedRelicSetIds: ["set-spade-flaw"],
      }).passed
    ).toBe(true);
  });

  it("地阶门要求持有判例卡", () => {
    const gate = { kind: "anyRuling" as const };
    expect(checkGate(gate, emptyCtx).passed).toBe(false);
    expect(checkGate(gate, { ...emptyCtx, hasAnyRuling: true }).passed).toBe(
      true
    );
  });

  it("天阶门要求有被收录的自创游戏", () => {
    const gate = { kind: "authoredGame" as const };
    expect(checkGate(gate, emptyCtx).passed).toBe(false);
    expect(
      checkGate(gate, { ...emptyCtx, hasAuthoredGame: true }).passed
    ).toBe(true);
  });

  it("碎片门按花色逐项比较", () => {
    const gate = { kind: "fragments" as const, cost: { spade: 30, club: 10 } };
    expect(
      checkGate(gate, {
        ...emptyCtx,
        fragments: { spade: 30, heart: 0, club: 9, diamond: 0 },
      }).passed
    ).toBe(false);
    expect(
      checkGate(gate, {
        ...emptyCtx,
        fragments: { spade: 30, heart: 0, club: 10, diamond: 0 },
      }).passed
    ).toBe(true);
  });

  it("层号映射位阶与生肖", () => {
    expect(tierOfFloor(1)).toBe("huang");
    expect(tierOfFloor(12)).toBe("huang");
    expect(tierOfFloor(13)).toBe("xuan");
    expect(tierOfFloor(25)).toBe("di");
    expect(tierOfFloor(48)).toBe("tian");
    expect(zodiacOfFloor(1)).toBe(0);
    expect(zodiacOfFloor(12)).toBe(11);
    expect(zodiacOfFloor(13)).toBe(0);
    expect(isBossFloor(12)).toBe(true);
    expect(isBossFloor(11)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 异能                                                                */
/* ------------------------------------------------------------------ */

describe("开局异能", () => {
  const baseCtx: TriggerContext = {
    round: 1,
    totalRounds: 5,
    seat: 0,
    myRank: 1,
    aliveCount: 6,
    hasSubmitted: false,
    correctStreak: 0,
    idleStreak: 0,
    hasPublicAlliance: false,
    heldIntelCardIds: [],
    inPreMatchWindow: false,
  };

  it("八位影从各有且仅有一个异能", () => {
    expect(ABILITIES).toHaveLength(8);
    const echoIds = ABILITIES.map(a => a.echoId);
    expect(new Set(echoIds).size).toBe(8);
    for (const id of echoIds) {
      expect(abilityOfEcho(id)).toBeDefined();
    }
  });

  it("五个钩子都有异能覆盖", () => {
    const hooks = new Set(ABILITIES.map(a => a.hook));
    expect(hooks).toEqual(
      new Set([
        "onProject",
        "onBeforeDecide",
        "onSubmit",
        "onReveal",
        "onSettle",
      ])
    );
  });

  it("覆言：仅在已提交未揭晓时可用", () => {
    const def = abilityOfEcho("eshou")!;
    const state = { abilityId: def.id, chargesLeft: 1, usedRounds: [] };
    expect(canUseAbility(def, state, baseCtx)).toBe(false);
    expect(
      canUseAbility(def, state, { ...baseCtx, hasSubmitted: true })
    ).toBe(true);
  });

  it("浑天：仅在后半程可用", () => {
    const def = abilityOfEcho("xuanji")!;
    const state = { abilityId: def.id, chargesLeft: 1, usedRounds: [] };
    expect(canUseAbility(def, state, { ...baseCtx, round: 2 })).toBe(false);
    expect(canUseAbility(def, state, { ...baseCtx, round: 3 })).toBe(true);
  });

  it("听心：仅在最后一名可用", () => {
    const def = abilityOfEcho("ajiu")!;
    const state = { abilityId: def.id, chargesLeft: 1, usedRounds: [] };
    expect(canUseAbility(def, state, { ...baseCtx, myRank: 3 })).toBe(false);
    expect(canUseAbility(def, state, { ...baseCtx, myRank: 6 })).toBe(true);
  });

  it("充能耗尽或本轮已用过则不可用", () => {
    const def = abilityOfEcho("eshou")!;
    const ctx = { ...baseCtx, hasSubmitted: true };
    expect(
      canUseAbility(def, { abilityId: def.id, chargesLeft: 0, usedRounds: [] }, ctx)
    ).toBe(false);
    expect(
      canUseAbility(def, { abilityId: def.id, chargesLeft: 2, usedRounds: [1] }, ctx)
    ).toBe(false);
  });

  it("位阶决定充能与额外槽位", () => {
    expect(abilitySlotsForTier("huang")).toEqual({
      charges: 1,
      secondary: false,
      passive: false,
    });
    expect(abilitySlotsForTier("di")).toEqual({
      charges: 3,
      secondary: true,
      passive: false,
    });
    expect(abilitySlotsForTier("tian")).toEqual({
      charges: 3,
      secondary: true,
      passive: true,
    });
  });

  it("触发条件是纯函数：同一上下文多次调用结果一致", () => {
    for (const def of ABILITIES) {
      const ctx = { ...baseCtx, hasSubmitted: true, inPreMatchWindow: true };
      const first = def.trigger(ctx);
      expect(def.trigger(ctx)).toBe(first);
      expect(def.trigger({ ...ctx })).toBe(first);
    }
  });
});

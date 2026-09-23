/**
 * ============================================================================
 * 超能力赛马 · 卡牌与赛道数据（contracts/beastRace.data.ts）
 * ----------------------------------------------------------------------------
 * 每兽 8 张：疾行 3 / 扰行 2 / 御守 2 / 反照 1。
 * 反照仅一张是刻意的稀缺——它让「此刻要不要用御守」成为真决策。
 *
 * 数值纪律：扰行的 delta 绝对值不超过疾行的最大值，
 * 否则「互扰」会比「自进」更优，赛道就变成互相拖后腿的僵局。
 * 由 beastRace.test.ts 断言。
 * ============================================================================
 */
import {
  BEASTS,
  TILE_META,
  TRACK_LENGTH,
  type BeastId,
  type CardKind,
  type RaceCardDef,
  type TileKind,
  setRaceCardLookup,
  type RaceMatchState,
} from "./beastRace";

/** 构造卡牌的内部辅助（减少重复字面量） */
function card(
  id: string,
  name: string,
  beastId: BeastId,
  kind: CardKind,
  delta: number,
  effect: string,
): RaceCardDef {
  return { id, name, beastId, kind, delta, effect };
}

/* ------------------------------------------------------------------ */
/* 鹤 · 凌空                                                           */
/* ------------------------------------------------------------------ */
const CRANE_CARDS: RaceCardDef[] = [
  card("cr-a1", "振翅", "crane", "advance", 4, "前进四格。"),
  card("cr-a2", "长风", "crane", "advance", 6, "前进六格。"),
  card("cr-a3", "掠云", "crane", "advance", 3, "前进三格；本轮免疫雷云。"),
  card("cr-d1", "投影", "crane", "disrupt", -3, "择一者，退三格。"),
  card("cr-d2", "唳鸣", "crane", "disrupt", -2, "择一者，退二格且下轮减半。"),
  card("cr-g1", "敛翼", "crane", "guard", 0, "免下一次扰行。"),
  card("cr-g2", "高栖", "crane", "guard", 0, "免下一次扰行；本轮不受格子之扰。"),
  card("cr-r1", "反羽", "crane", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

/* ------------------------------------------------------------------ */
/* 狼 · 掠夺                                                           */
/* ------------------------------------------------------------------ */
const WOLF_CARDS: RaceCardDef[] = [
  card("wo-a1", "疾奔", "wolf", "advance", 5, "前进五格。"),
  card("wo-a2", "衔尾", "wolf", "advance", 3, "前进三格；若居末位，改前进七格。"),
  card("wo-a3", "扑袭", "wolf", "advance", 4, "前进四格；夺前一名一张手牌。"),
  card("wo-d1", "撕咬", "wolf", "disrupt", -4, "择一者，退四格。"),
  card("wo-d2", "围堵", "wolf", "disrupt", -2, "择一者，退二格且停行一轮。"),
  card("wo-g1", "竖毛", "wolf", "guard", 0, "免下一次扰行。"),
  card("wo-g2", "群影", "wolf", "guard", 0, "免下一次扰行；夺施扰者一张手牌。"),
  card("wo-r1", "獠牙", "wolf", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

/* ------------------------------------------------------------------ */
/* 龟 · 负甲                                                           */
/* ------------------------------------------------------------------ */
const TURTLE_CARDS: RaceCardDef[] = [
  card("tu-a1", "缓步", "turtle", "advance", 4, "前进四格。"),
  card("tu-a2", "厚积", "turtle", "advance", 2, "前进二格；下轮此卡效力加倍。"),
  card("tu-a3", "破甲行", "turtle", "advance", 7, "前进七格；本轮不可用御守。"),
  card("tu-d1", "碾压", "turtle", "disrupt", -3, "择一者，退三格。"),
  card("tu-d2", "沉石", "turtle", "disrupt", -1, "择一者，退一格且停行一轮。"),
  card("tu-g1", "缩甲", "turtle", "guard", 0, "免下一次扰行。"),
  card("tu-g2", "磐石", "turtle", "guard", 0, "免此后两次扰行。"),
  card("tu-r1", "回甲", "turtle", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

/* ------------------------------------------------------------------ */
/* 狐 · 伪示                                                           */
/* ------------------------------------------------------------------ */
const FOX_CARDS: RaceCardDef[] = [
  card("fo-a1", "轻踏", "fox", "advance", 5, "前进五格。"),
  card("fo-a2", "虚步", "fox", "advance", 4, "前进四格；伪示位置至下轮。"),
  card("fo-a3", "借势", "fox", "advance", 3, "前进三格；再进首位者本轮位移之半。"),
  card("fo-d1", "扰心", "fox", "disrupt", -3, "择一者，退三格。"),
  card("fo-d2", "错引", "fox", "disrupt", -2, "择一者，退二格；其下轮扰行择错目标。"),
  card("fo-g1", "隐形", "fox", "guard", 0, "免下一次扰行。"),
  card("fo-g2", "九尾", "fox", "guard", 0, "免下一次扰行；伪示位置至下轮。"),
  card("fo-r1", "镜诡", "fox", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

/* ------------------------------------------------------------------ */
/* 鲤 · 随流                                                           */
/* ------------------------------------------------------------------ */
const CARP_CARDS: RaceCardDef[] = [
  card("ca-a1", "摆尾", "carp", "advance", 4, "前进四格。"),
  card("ca-a2", "跃波", "carp", "advance", 6, "前进六格；须自沼泽或顺流起。"),
  card("ca-a3", "溯流", "carp", "advance", 3, "前进三格；本轮将前方逆风化为顺流。"),
  card("ca-d1", "浊水", "carp", "disrupt", -3, "择一者，退三格。"),
  card("ca-d2", "漩涡", "carp", "disrupt", -2, "择一者，退二格且下轮减半。"),
  card("ca-g1", "滑鳞", "carp", "guard", 0, "免下一次扰行。"),
  card("ca-g2", "深潜", "carp", "guard", 0, "免下一次扰行；本轮免疫格子之扰。"),
  card("ca-r1", "逆鳞", "carp", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

/* ------------------------------------------------------------------ */
/* 猿 · 捷径                                                           */
/* ------------------------------------------------------------------ */
const APE_CARDS: RaceCardDef[] = [
  card("ap-a1", "攀跃", "ape", "advance", 5, "前进五格。"),
  card("ap-a2", "腾木", "ape", "advance", 7, "前进七格；须前方三格内有分岔。"),
  card("ap-a3", "拾遗", "ape", "advance", 3, "前进三格；抽一张卡。"),
  card("ap-d1", "掷石", "ape", "disrupt", -3, "择一者，退三格。"),
  card("ap-d2", "断藤", "ape", "disrupt", -2, "择一者，退二格；其下轮不得走近路。"),
  card("ap-g1", "闪身", "ape", "guard", 0, "免下一次扰行。"),
  card("ap-g2", "树冠", "ape", "guard", 0, "免下一次扰行；抽一张卡。"),
  card("ap-r1", "反掷", "ape", "riposte", 0, "抵一次扰行，并还之于彼。"),
];

export const RACE_CARDS: readonly RaceCardDef[] = [
  ...CRANE_CARDS,
  ...WOLF_CARDS,
  ...TURTLE_CARDS,
  ...FOX_CARDS,
  ...CARP_CARDS,
  ...APE_CARDS,
];

const cardById = new Map(RACE_CARDS.map(c => [c.id, c]));

setRaceCardLookup(id => {
  const c = cardById.get(id);
  return c ? { kind: c.kind, delta: c.delta, name: c.name } : undefined;
});

export function getRaceCard(id: string): RaceCardDef | undefined {
  return cardById.get(id);
}

/** 某兽的全部卡牌（开局发牌用） */
export function cardsOfBeast(beastId: BeastId): RaceCardDef[] {
  return RACE_CARDS.filter(c => c.beastId === beastId);
}

/** 确定性洗牌；同一个 seed 与席位数得到完全相同的初始状态。 */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 生成赛道、分配动物和 8 张初始手牌；不依赖运行时随机。 */
export function createRaceMatchState(seed: string, seatCount: number): RaceMatchState {
  if (!Number.isInteger(seatCount) || seatCount < 2 || seatCount > BEASTS.length) {
    throw new Error("赛马席位数必须在 2–6 之间");
  }
  const rng = mulberry32(hashSeed(`${seed}:match`));
  const beasts = shuffle(BEASTS, rng).slice(0, seatCount);
  return {
    seed,
    track: generateTrack(seed),
    racers: beasts.map((beast, seat) => ({
      seat,
      beastId: beast.id,
      position: 0,
      hand: cardsOfBeast(beast.id).map(c => c.id),
      slowedNextRound: false,
      stunnedRounds: 0,
      guarded: false,
      riposting: false,
      feignedPosition: null,
      finishRank: null,
    })),
    finishedCount: 0,
  };
}

/* ------------------------------------------------------------------ */
/* 赛道生成（确定性：同 seed 同赛道，回放可复现）                         */
/* ------------------------------------------------------------------ */

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 按 TILE_META 的 weight 加权抽取格子类型 */
function pickTile(rng: () => number): TileKind {
  const kinds = Object.keys(TILE_META) as TileKind[];
  const total = kinds.reduce((s, k) => s + TILE_META[k].weight, 0);
  let r = rng() * total;
  for (const k of kinds) {
    r -= TILE_META[k].weight;
    if (r <= 0) return k;
  }
  return "plain";
}

/**
 * 生成 100 格赛道。
 *
 * 起点三格恒为平地——开局就踩雷云会让玩家觉得莫名其妙，
 * 而戏剧性要建立在玩家已理解局势之后。
 * 终点前一格亦为平地，避免「冲线瞬间被格子拉回」的挫败感。
 */
export function generateTrack(seed: string): TileKind[] {
  const rng = mulberry32(hashSeed(`${seed}:track`));
  const track: TileKind[] = [];

  for (let i = 0; i < TRACK_LENGTH; i++) {
    if (i < 3 || i === TRACK_LENGTH - 1) {
      track.push("plain");
      continue;
    }
    track.push(pickTile(rng));
  }

  return track;
}

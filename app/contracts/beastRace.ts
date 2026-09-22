/**
 * ============================================================================
 * 超能力赛马 · 契约（contracts/beastRace.ts）
 * ----------------------------------------------------------------------------
 * 三层决策叠成因果链，这是它比单值博弈更好看的原因：
 *   ① 选兽   = 选流派（开局公开，成为他人的先验）
 *   ② 打卡   = 每轮战术（秘密提交，同时揭晓）
 *   ③ 格子   = 环境变量（引入不确定性，制造戏剧性）
 *
 * 观众不需要懂博弈论就能看懂「发生了什么」——飞行的被雷云打下来、
 * 领先的踩进沼泽、落后的借顺流反超。但 AI 的决策深度又足够。
 *
 * 【铁律·克制成环】六兽的克制关系必须成环，不能有最优解。
 * 环：鹤压制陆行 → 雷云压制鹤 → 龟免疫雷云 → 龟太慢被狐骗过
 *     → 狐怕狼抢卡 → 狼怕迷雾（抢不到）→ 迷雾护住落后者
 * 由 beastRace.test.ts 断言：不存在「对所有对手都不劣」的兽。
 *
 * 【铁律·卡不改胜负判定】技能卡只改位移与状态，不改「先到终点者胜」
 * 这条规则本身。与 contracts/cards.ts 的铁律同源。
 * ============================================================================
 */

/* ------------------------------------------------------------------ */
/* 赛道                                                                */
/* ------------------------------------------------------------------ */

/**
 * 赛道长度 60 格。
 *
 * 不用 100 格：每轮平均前进 4–6 格，60 格约 12 轮完赛；
 * 100 格要 20 轮以上，观众会失去耐心。戏剧性密度比绝对长度重要。
 */
export const TRACK_LENGTH = 60;

/** 移动方式：决定对格子的适应性 */
export type Locomotion = "ground" | "air" | "water";

export type TileKind =
  | "plain"
  | "headwind"
  | "marsh"
  | "current"
  | "fog"
  | "fork"
  | "thundercloud"
  | "cache";

export const TILE_META: Record<
  TileKind,
  { name: string; weight: number; desc: string }
> = {
  plain: { name: "平地", weight: 45, desc: "无事发生。" },
  headwind: { name: "逆风", weight: 12, desc: "下一轮前进减半。" },
  marsh: {
    name: "沼泽",
    weight: 10,
    desc: "陆行者停一轮；飞行免疫；水行加速。",
  },
  current: { name: "顺流", weight: 10, desc: "额外前进三格。" },
  fog: { name: "迷雾", weight: 8, desc: "本轮所有技能卡对你无效。" },
  fork: { name: "分岔", weight: 7, desc: "择近路涉险，或远路稳行。" },
  thundercloud: {
    name: "雷云",
    weight: 5,
    desc: "飞行者被击落，退五格；陆行水行无事。",
  },
  cache: { name: "秘藏", weight: 3, desc: "得一张稀有技能卡。" },
};

/**
 * 沼泽与雷云是设计核心：它们让「选什么兽」这个开局决策
 * 在中盘产生后果。飞行强但怕雷云，陆行慢但不怕沼泽。
 * 调整权重时务必保留这两者，否则选兽就退化成纯数值比较。
 */
export const PIVOTAL_TILES: readonly TileKind[] = ["marsh", "thundercloud"];

/* ------------------------------------------------------------------ */
/* 六兽                                                                */
/* ------------------------------------------------------------------ */

export type BeastId = "crane" | "wolf" | "turtle" | "fox" | "carp" | "ape";

export interface BeastDef {
  id: BeastId;
  name: string;
  locomotion: Locomotion;
  /** 每轮基础位移 */
  baseSpeed: number;
  /** 免疫的格子 */
  immuneTo: readonly TileKind[];
  /** 额外受创的格子 */
  vulnerableTo: readonly TileKind[];
  /** 特性一句话（展示给玩家与观众） */
  trait: string;
  /** 世界观一句（与八影从的语气一致） */
  lore: string;
}

export const BEASTS: readonly BeastDef[] = [
  {
    id: "crane",
    name: "鹤",
    locomotion: "air",
    baseSpeed: 5,
    immuneTo: ["marsh", "headwind"],
    vulnerableTo: ["thundercloud"],
    trait: "凌空而行，沼泽逆风皆不能阻；然雷云之下，翼亦折。",
    lore: "它说：我不与你们争路，我只是不走你们的路。",
  },
  {
    id: "wolf",
    name: "狼",
    locomotion: "ground",
    baseSpeed: 4,
    immuneTo: [],
    vulnerableTo: ["fog"],
    trait: "可夺他人手中之卡；迷雾中嗅不到猎物。",
    lore: "它说：你的牌，你捂得住吗？",
  },
  {
    id: "turtle",
    name: "龟",
    locomotion: "ground",
    baseSpeed: 3,
    immuneTo: ["headwind", "marsh", "thundercloud", "fog"],
    vulnerableTo: [],
    trait: "负甲而行，诸般险地皆不能伤；唯其慢。",
    lore: "它说：急什么，路还长。",
  },
  {
    id: "fox",
    name: "狐",
    locomotion: "ground",
    baseSpeed: 4,
    immuneTo: [],
    vulnerableTo: [],
    trait: "可伪示其位；若被识破，罚退三格。",
    lore: "它说：你看见的我，是我想让你看见的我。",
  },
  {
    id: "carp",
    name: "鲤",
    locomotion: "water",
    baseSpeed: 4,
    immuneTo: ["marsh"],
    vulnerableTo: [],
    trait: "沼泽顺流皆为通途；平地则滞。",
    lore: "它说：水会带我去该去的地方。",
  },
  {
    id: "ape",
    name: "猿",
    locomotion: "ground",
    baseSpeed: 4,
    immuneTo: [],
    vulnerableTo: [],
    trait: "分岔必择近路，且不涉其险。",
    lore: "它说：捷径之所以是捷径，因为有人敢走。",
  },
];

const beastById = new Map(BEASTS.map(b => [b.id, b]));

export function getBeast(id: BeastId): BeastDef | undefined {
  return beastById.get(id);
}

/* ------------------------------------------------------------------ */
/* 技能卡                                                              */
/* ------------------------------------------------------------------ */

/**
 * 四类卡各司其职：
 * - advance  推进：只作用于自己
 * - disrupt  干扰：作用于他人，需 targetSeat
 * - guard    防护：免疫下一次干扰
 * - riposte  反制：抵消并反弹一次干扰
 *
 * 反制卡每兽仅一张，是刻意的：它让「此刻要不要用防护」成为真决策，
 * 而不是「有就用」。稀缺造就选择。
 */
export type CardKind = "advance" | "disrupt" | "guard" | "riposte";

export const CARD_KIND_META: Record<CardKind, { name: string; desc: string }> = {
  advance: { name: "疾行", desc: "推自己向前。" },
  disrupt: { name: "扰行", desc: "阻他人之路。" },
  guard: { name: "御守", desc: "免下一次扰行。" },
  riposte: { name: "反照", desc: "抵其扰行，并还之于彼。" },
};

export interface RaceCardDef {
  id: string;
  name: string;
  beastId: BeastId;
  kind: CardKind;
  /** 位移量（advance 为自身前进，disrupt 为目标后退；guard/riposte 为 0） */
  delta: number;
  /** 效果描述（展示用） */
  effect: string;
}

/** disrupt 类必须指定目标，其余不需要 */
export function needsTarget(kind: CardKind): boolean {
  return kind === "disrupt";
}

/* ------------------------------------------------------------------ */
/* 局内状态                                                            */
/* ------------------------------------------------------------------ */

/** 一匹马的跨轮状态（存活于 matchState，随 rooms.stateJson 持久化） */
export interface RacerState {
  seat: number;
  beastId: BeastId;
  /** 当前格位 0–TRACK_LENGTH */
  position: number;
  /** 手牌 id */
  hand: string[];
  /** 下一轮位移减半（踩逆风） */
  slowedNextRound: boolean;
  /** 停行轮数（陆行踩沼泽） */
  stunnedRounds: number;
  /** 持有防护（免下一次干扰） */
  guarded: boolean;
  /** 持有反制（抵并反弹） */
  riposting: boolean;
  /** 狐的伪示位置（null = 未伪装；观众可见真值，对手见此值） */
  feignedPosition: number | null;
  /** 已完赛的名次（null = 未完赛） */
  finishRank: number | null;
}

/** 整局状态（TemplateModule.initMatchState 的产物） */
export interface RaceMatchState {
  /** 赛道每格的类型（开局由 seed 生成，全程不变） */
  track: TileKind[];
  racers: RacerState[];
  /** 已完赛数（决定下一个完赛者的名次） */
  finishedCount: number;
}

/* ------------------------------------------------------------------ */
/* 揭晓                                                                */
/* ------------------------------------------------------------------ */

/** 一次卡牌结算的因果记录——观众看的就是这个 */
export interface RaceEffect {
  /** 出牌者 */
  seat: number;
  cardId: string;
  cardName: string;
  kind: CardKind;
  targetSeat: number | null;
  /** 是否生效（被迷雾/防护/反制挡下则 false） */
  applied: boolean;
  /** 未生效的原因（展示用，如「为御守所挡」） */
  blockedBy: string | null;
  /** 实际位移量 */
  delta: number;
}

/** 格子触发的记录 */
export interface TileTrigger {
  seat: number;
  tile: TileKind;
  tileName: string;
  /** 对该兽是否生效（免疫则 false） */
  applied: boolean;
  /** 一句因果描述（如「鹤为雷云所击，退五格」） */
  note: string;
}

export interface RaceReveal {
  round: number;
  /** 本轮全部卡牌结算，按结算顺序（观众逐条看） */
  effects: RaceEffect[];
  /** 本轮格子触发 */
  tiles: TileTrigger[];
  /** 结算后各座位置（座位 → 格位） */
  positions: Record<number, number>;
  /** 本轮新完赛的座位（按名次） */
  finishers: number[];
}

/* ------------------------------------------------------------------ */
/* 位移计算（纯函数，前后端共用，便于前端做预演动画）                     */
/* ------------------------------------------------------------------ */

/**
 * 计算一匹马本轮的实际位移。
 *
 * 顺序有意义：先算停行（停了就不动），再算基础与卡牌，最后减半。
 * 减半放最后，使「逆风 + 疾行」的结果符合直觉（推进后再打折）。
 */
export function computeAdvance(params: {
  racer: RacerState;
  /** 本轮卡牌带来的净位移（可为负） */
  cardDelta: number;
  baseSpeed: number;
}): number {
  const { racer, cardDelta, baseSpeed } = params;

  if (racer.stunnedRounds > 0) return 0;

  const raw = baseSpeed + cardDelta;
  const moved = racer.slowedNextRound ? Math.floor(raw / 2) : raw;

  // 位移可为负（被击落/干扰），但不退到起点之前
  return moved;
}

/** 落位后夹取到合法区间 */
export function clampPosition(pos: number): number {
  return Math.max(0, Math.min(TRACK_LENGTH, pos));
}

/** 该兽是否免疫此格 */
export function isImmune(beast: BeastDef, tile: TileKind): boolean {
  return beast.immuneTo.includes(tile);
}

/** 该兽是否额外受创于此格 */
export function isVulnerable(beast: BeastDef, tile: TileKind): boolean {
  return beast.vulnerableTo.includes(tile);
}

/**
 * 对手看到的位置：狐可伪示，其余为真。
 *
 * 观战全知视角应读 position 而非本函数——伪装对观众透明，
 * 「观众知道而玩家不知道」正是悬疑感的来源。
 */
export function visiblePosition(racer: RacerState): number {
  return racer.feignedPosition ?? racer.position;
}

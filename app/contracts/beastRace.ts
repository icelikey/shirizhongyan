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
 * 赛道长度 100 格。
 *
 * 长度是内容包契约的一部分；节奏由卡牌、格子和提前结束控制。
 */
export const TRACK_LENGTH = 100;

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
  /** 生成赛道与初始发牌所用的公开种子。 */
  seed?: string;
  /** 赛道每格的类型（开局由 seed 生成，全程不变） */
  track: TileKind[];
  racers: RacerState[];
  /** 已完赛数（决定下一个完赛者的名次） */
  finishedCount: number;
}

/** 服务端接受的唯一赛马动作形状。 */
export interface RaceAction {
  cardId: string;
  targetSeat?: number;
}

export interface RaceEvent {
  type:
    | "card_committed"
    | "card_revealed"
    | "effect_applied"
    | "tile_triggered"
    | "movement_applied"
    | "status_changed"
    | "race_finished";
  round: number;
  seat: number;
  targetSeat?: number;
  cardId?: string;
  tile?: TileKind;
  delta?: number;
  note: string;
}

export type HighlightKind =
  | "overtake"
  | "counter"
  | "hazard"
  | "finish";

export interface RaceHighlight {
  kind: HighlightKind;
  round: number;
  seats: number[];
  eventTypes: RaceEvent["type"][];
  title: string;
  note: string;
}

export interface RaceRoundResult {
  state: RaceMatchState;
  reveal: RaceReveal;
  events: RaceEvent[];
  highlights: RaceHighlight[];
}

/** 只从当前手牌和当前局面产生候选；LLM/Agent 不得自行造 cardId 或数值效果。 */
export function legalRaceActions(
  state: RaceMatchState,
  seat: number,
): RaceAction[] {
  const racer = state.racers.find(r => r.seat === seat);
  if (!racer || racer.finishRank !== null) return [];
  const actions: RaceAction[] = [];
  for (const cardId of racer.hand) {
    const card = getRaceCardForReducer(cardId);
    if (!card) continue;
    if (card.kind === "disrupt") {
      for (const target of state.racers) {
        if (target.seat !== seat && target.finishRank === null) {
          actions.push({ cardId, targetSeat: target.seat });
        }
      }
    } else {
      actions.push({ cardId });
    }
  }
  return actions;
}

/** 校验动作属于合法候选集合；返回规范化副本，避免保留额外字段。 */
export function normalizeRaceAction(
  state: RaceMatchState,
  seat: number,
  action: RaceAction,
): RaceAction {
  if (!action || typeof action.cardId !== "string") {
    throw new Error("赛马动作必须包含 cardId");
  }
  const candidate = legalRaceActions(state, seat).find(
    a => a.cardId === action.cardId && a.targetSeat === action.targetSeat,
  );
  if (!candidate) throw new Error("赛马动作不在当前合法候选集合中");
  return candidate;
}

type ReducerCard = { kind: CardKind; delta: number; name: string };

function getRaceCardForReducer(id: string): ReducerCard | undefined {
  // 避免 contracts 依赖 data，卡牌表通过 reducer 注入，见 setRaceCardLookup。
  return raceCardLookup(id);
}

let raceCardLookup: (id: string) => ReducerCard | undefined = () => undefined;

/** 由 data 模块注册静态卡牌查找器；仅用于消除 contracts↔data 的循环依赖。 */
export function setRaceCardLookup(
  lookup: (id: string) => ReducerCard | undefined,
): void {
  raceCardLookup = lookup;
}

/**
 * 一轮确定性 reducer。所有数值来自静态卡牌和状态，输入 seed 不参与运行时随机。
 * 结算顺序：扣牌/翻牌 → 卡牌效果 → 基础移动 → 落点格子 → 冲线与高光。
 */
export function reduceRaceRound(
  input: RaceMatchState,
  actions: readonly { seat: number; action: RaceAction }[],
  round: number,
): RaceRoundResult {
  const state: RaceMatchState = {
    ...input,
    track: [...input.track],
    racers: input.racers.map(r => ({ ...r, hand: [...r.hand] })),
  };
  const events: RaceEvent[] = [];
  const cardDeltas = new Map<number, number>();
  const before = new Map(state.racers.map(r => [r.seat, r.position]));
  const priority = (entry: { seat: number; action: RaceAction }) => {
    const card = getRaceCardForReducer(entry.action.cardId);
    return card?.kind === "guard" || card?.kind === "riposte" ? 0 : 1;
  };
  // 先亮出防护/反照，再结算扰行，保证同时出牌时反制成立。
  const chosen = [...actions].sort((a, b) => priority(a) - priority(b) || a.seat - b.seat);

  for (const entry of chosen) {
    const racer = state.racers.find(r => r.seat === entry.seat);
    if (!racer || racer.finishRank !== null) continue;
    const action = normalizeRaceAction(state, entry.seat, entry.action);
    const card = getRaceCardForReducer(action.cardId)!;
    racer.hand = racer.hand.filter(id => id !== action.cardId);
    events.push({ type: "card_committed", round, seat: racer.seat, cardId: action.cardId, note: `${card.name}已扣除并进入揭晓` });
    events.push({ type: "card_revealed", round, seat: racer.seat, cardId: action.cardId, note: card.name });
    if (card.kind === "advance") {
      cardDeltas.set(racer.seat, (cardDeltas.get(racer.seat) ?? 0) + card.delta);
    } else if (card.kind === "guard") {
      racer.guarded = true;
      events.push({ type: "status_changed", round, seat: racer.seat, note: "获得一次扰行防护" });
    } else if (card.kind === "riposte") {
      racer.riposting = true;
      events.push({ type: "status_changed", round, seat: racer.seat, note: "获得一次反照" });
    } else {
      const target = state.racers.find(r => r.seat === action.targetSeat);
      if (!target || target.seat === racer.seat || target.finishRank !== null) continue;
      const amount = Math.abs(card.delta);
      if (target.guarded) {
        target.guarded = false;
        events.push({ type: "effect_applied", round, seat: racer.seat, targetSeat: target.seat, cardId: action.cardId, delta: 0, note: "扰行被御守挡下" });
      } else if (target.riposting) {
        target.riposting = false;
        racer.position = clampPosition(racer.position + amount);
        events.push({ type: "effect_applied", round, seat: racer.seat, targetSeat: target.seat, cardId: action.cardId, delta: amount, note: "扰行被反照并反弹" });
      } else {
        target.position = clampPosition(target.position - amount);
        events.push({ type: "effect_applied", round, seat: racer.seat, targetSeat: target.seat, cardId: action.cardId, delta: -amount, note: `目标退${amount}格` });
      }
    }
  }

  for (const racer of state.racers) {
    if (racer.finishRank !== null) continue;
    const beast = getBeast(racer.beastId)!;
    const delta = computeAdvance({ racer, cardDelta: cardDeltas.get(racer.seat) ?? 0, baseSpeed: beast.baseSpeed });
    const next = clampPosition(racer.position + delta);
    racer.position = next;
    events.push({ type: "movement_applied", round, seat: racer.seat, delta: next - (before.get(racer.seat) ?? next), note: `基础移动与疾行结算至${next}格` });
    const tile = state.track[Math.max(0, Math.min(TRACK_LENGTH - 1, next - 1))] ?? "plain";
    let tileDelta = 0;
    const immune = isImmune(beast, tile);
    if (!immune && tile === "headwind") racer.slowedNextRound = true;
    if (!immune && tile === "marsh" && beast.locomotion === "ground") racer.stunnedRounds = Math.max(racer.stunnedRounds, 1);
    if (!immune && tile === "marsh" && beast.locomotion === "water") tileDelta = 3;
    if (!immune && tile === "current") tileDelta = 3;
    if (!immune && tile === "thundercloud" && beast.locomotion === "air") tileDelta = -5;
    if (tileDelta) racer.position = clampPosition(racer.position + tileDelta);
    events.push({ type: "tile_triggered", round, seat: racer.seat, tile, delta: tileDelta, note: immune ? `${beast.name}免疫${tile}` : (tileDelta ? `${beast.name}受${tile}影响${tileDelta > 0 ? "前进" : "后退"}${Math.abs(tileDelta)}格` : `触发${tile}`) });
    if (racer.slowedNextRound && tile !== "headwind") racer.slowedNextRound = false;
    if (racer.stunnedRounds > 0) racer.stunnedRounds -= 1;
  }

  const finishers: number[] = [];
  for (const racer of [...state.racers].sort((a, b) => a.seat - b.seat)) {
    if (racer.position >= TRACK_LENGTH && racer.finishRank === null) {
      racer.finishRank = ++state.finishedCount;
      finishers.push(racer.seat);
      events.push({ type: "race_finished", round, seat: racer.seat, note: `第${racer.finishRank}名冲线` });
    }
  }
  const highlights: RaceHighlight[] = [];
  if (finishers.length) highlights.push({ kind: "finish", round, seats: finishers, eventTypes: ["race_finished"], title: "冲线时刻", note: finishers.map(s => `席位${s}`).join("、") + "冲过终点" });
  for (const e of events) {
    if (e.type === "effect_applied" && e.delta && e.delta > 0) highlights.push({ kind: "counter", round, seats: [e.seat, e.targetSeat!], eventTypes: ["effect_applied"], title: "反照反击", note: e.note });
    if (e.type === "tile_triggered" && e.delta && e.delta < 0) highlights.push({ kind: "hazard", round, seats: [e.seat], eventTypes: ["tile_triggered"], title: "险地发作", note: e.note });
  }
  const positions = Object.fromEntries(state.racers.map(r => [r.seat, r.position]));
  const effects: RaceEffect[] = events
    .filter((e): e is RaceEvent & { type: "effect_applied"; cardId: string; targetSeat: number } =>
      e.type === "effect_applied" && !!e.cardId && e.targetSeat !== undefined,
    )
    .map(e => {
      const card = getRaceCardForReducer(e.cardId)!;
      return {
        seat: e.seat,
        cardId: e.cardId,
        cardName: card.name,
        kind: card.kind,
        targetSeat: e.targetSeat,
        applied: e.delta !== 0,
        blockedBy: e.delta === 0 ? e.note : null,
        delta: e.delta ?? 0,
      };
    });
  const tiles: TileTrigger[] = events
    .filter((e): e is RaceEvent & { type: "tile_triggered"; tile: TileKind } =>
      e.type === "tile_triggered" && !!e.tile,
    )
    .map(e => ({
      seat: e.seat,
      tile: e.tile,
      tileName: TILE_META[e.tile].name,
      applied: !(e.note.includes("免疫")),
      note: e.note,
    }));
  const reveal: RaceReveal = {
    round,
    effects,
    tiles,
    positions,
    finishers,
    events,
    highlights,
  };
  return { state, reveal, events, highlights };
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
  /** 服务端事件流的模板化演出数据。 */
  events?: RaceEvent[];
  highlights?: RaceHighlight[];
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

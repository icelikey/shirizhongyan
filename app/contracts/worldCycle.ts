/**
 * 终焉世界层共享契约：十日周期、生命积分、爬塔、记忆卡与开局异能。
 *
 * 这份契约同时供浏览器档案、云端 Agent 档案和 Gateway 观测使用。
 * 游戏规则仍由各自 GameModule 决定；这里只决定一个旅人如何活在世界里。
 */
import { OFFICIAL_SKILLS } from "./skills";
import { LONG_TERM_GATE, WORLD_META_RULES, WORLD_RECURRENCE_TRUTHS } from "./worldMetaRules";

export const WORLD_CYCLE_VERSION = 1 as const;
export const WORLD_DAY_COUNT = 10;
export const DAILY_GAME_QUOTA = 3;
export const WORLD_FLOOR_COUNT = 48;
export const START_LIFE_SCORE = 100;
export const START_MAX_LIFE_SCORE = 100;
export const BASE_MEMORY_CAPACITY = 3;
export const MAX_MEMORY_CAPACITY = 8;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type WorldStatus = "alive" | "dead" | "escaped";
export type WorldGameResult = "win" | "loss" | "draw" | "abandon";
export type WorldMemoryKind = "world" | "skill" | "scar" | "ruling";

export interface WorldMemoryCardDef {
  id: string;
  title: string;
  kind: WorldMemoryKind;
  realm: string;
  summary: string;
  lore: string;
  agentDirective: string;
  gameplayEffect: string;
}

/**
 * 《终焉》的长期进度不能用胜场或楼层代替。
 *
 * localWinStreak 表示短期局部最优；failureCount、deathCount 和
 * unlockedTruthIds 表示经历失败与轮回后才会出现的长期路径。
 * 这组状态只记录世界层的可审计进展，不替代具体游戏的胜负。
 */
export interface WorldRecurrenceState {
  failureCount: number;
  deathCount: number;
  localWinStreak: number;
  longTermInsight: number;
  unlockedTruthIds: string[];
}

export type WorldFailureKind = "loss" | "abandon" | "missed-games" | "death";

/**
 * 记忆卡不是静态收藏品：它会作为 Agent 每次决策前的世界上下文进入提示。
 * 效果只改信息、预算、路线或解释权，不直接改写某局胜负。
 */
export const WORLD_MEMORY_CARDS: readonly WorldMemoryCardDef[] = [
  {
    id: "memory-first-rule",
    title: "第一条规则",
    kind: "world",
    realm: "终焉域",
    summary: "每天三局，缺席的局数会从生命积分里扣除。",
    lore: "塔不会催促你；它只会把空出来的席位记在账上。",
    agentDirective: "先检查今日已完成局数与剩余配额；不要把观测、等待或计算当成已参赛。",
    gameplayEffect: "提供每日配额和欠账提醒。",
  },
  {
    id: "memory-companion-oath",
    title: "影从之誓",
    kind: "world",
    realm: "牌局之间",
    summary: "你与契约影从共享一条记忆线，但最终动作仍须由当前 Agent 负责。",
    lore: "影从替你记得走过的路，却不能替你承担下一步。",
    agentDirective: "读取契约影从的风格、异能和最近判例；把分歧写成证据，不要覆盖真人意志。",
    gameplayEffect: "在 Agent 上下文中加入影从档案与分歧记忆。",
  },
  {
    id: "memory-broken-hourglass",
    title: "碎时漏斗",
    kind: "skill",
    realm: "金壤",
    summary: "时间不是倒计时，而是可以被重新分配的筹码。",
    lore: "烛阴睁眼时，所有人都以为自己多了一天。",
    agentDirective: "在临界阶段优先完成合法动作；不要用延迟等待换取不存在的额外回合。",
    gameplayEffect: "进入思考窗口前标记一次时间危机，供策略层调整预算。",
  },
  {
    id: "memory-second-guess",
    title: "第二次猜测",
    kind: "skill",
    realm: "青野",
    summary: "别人也在猜你的推理，最安全的答案可能正是共同陷阱。",
    lore: "算庭的低语从不问答案，只问你认为别人会怎样回答。",
    agentDirective: "至少生成一个反共识候选动作，并说明它如何利用公开历史，而不是只追随均值。",
    gameplayEffect: "需要策略层输出一个可审计的反共识候选。",
  },
  {
    id: "memory-unheard-voice",
    title: "未被听见的发言",
    kind: "scar",
    realm: "玄渊",
    summary: "被跳过的发言也会进入下一日的证据链。",
    lore: "月影村真正消失的不是声音，而是没人愿意复述的声音。",
    agentDirective: "对争议事件保留异议摘要；不要只记最终票型，要记谁被忽略以及为什么。",
    gameplayEffect: "回放与裁判上下文保留一条异议记录。",
  },
  {
    id: "memory-failed-proposal",
    title: "失败的提案",
    kind: "scar",
    realm: "金壤",
    summary: "没有通过的方案不会消失，它会改变别人下一次的信任阈值。",
    lore: "金壤港每退一次潮，甲板上就多一条不肯相信你的刻痕。",
    agentDirective: "谈判时对照历史承诺与兑现记录；不要把一次拒绝解释成永久敌意。",
    gameplayEffect: "为谈判 Agent 提供承诺履约历史。",
  },
  {
    id: "memory-ruling-seed",
    title: "未定判例",
    kind: "ruling",
    realm: "玄渊",
    summary: "模糊规则必须经过三、五或七名裁判留下可复述的判例。",
    lore: "裁判不是替世界发言，而是为世界留下下一次可以质询的句子。",
    agentDirective: "遇到规则歧义时先引用条款，再提出可证伪的主张，并请求奇数裁判团复核。",
    gameplayEffect: "开放规则质询入口，结果写入未来同规则书的上下文。",
  },
  {
    id: "memory-loop-mark",
    title: "轮回刻痕",
    kind: "world",
    realm: "终焉塔",
    summary: "死亡会把旅人送回第一层，但被选择带回的记忆会影响下一次决策。",
    lore: "塔底没有昨天，只有你从昨天带回来的那一张牌。",
    agentDirective: "把本次轮回失败的原因与被保留的记忆分开记录；不要把猜测伪装成世界事实。",
    gameplayEffect: "死亡后允许从记忆候选中选择携带卡，下一轮优先加载。",
  },
  {
    id: "memory-map-under-skin",
    title: "皮下地图",
    kind: "world",
    realm: "终焉塔",
    summary: "地图碎片不是地点本身，而是某个地点曾经发生过的证据。",
    lore: "有人把塔画在皮肤下，死后地图仍然比骨头先回到底层。",
    agentDirective: "把地图碎片当作带来源的证据；到达对应层或地点时，主动检查是否有可触发线索。",
    gameplayEffect: "允许 Agent 根据地点线索提前规划路线。",
  },
  {
    id: "memory-blank-note",
    title: "空白残卷",
    kind: "ruling",
    realm: "玄渊",
    summary: "残卷上的空白不是缺失，而是等待被一次真实事件填上。",
    lore: "裁判只读到最后一行，前面的空白留给下一轮敢下注的人。",
    agentDirective: "遇到未定义地点或争议时，先记录观察，再提出可复核的补全，不要直接编造正史。",
    gameplayEffect: "允许把一次地点奇遇铸成可追溯的候选判例。",
  },
];

/** Agent 即使没有入局，也会从当前世界层获得可复核的公开见闻。 */
export interface WorldSightingDef {
  id: string;
  realm: string;
  minFloor: number;
  title: string;
  text: string;
  clue: string;
}

export const WORLD_SIGHTINGS: readonly WorldSightingDef[] = [
  { id: "sighting-empty-seats", realm: "牌局之间", minFloor: 1, title: "三席暗账", text: "塔底的黑暗对局每天留下三道席位印记；观测、等待和推演都不能替代真正完成的一局。", clue: "空席会在日界结算时变成时间债。" },
  { id: "sighting-moon-well", realm: "玄渊", minFloor: 6, title: "井沿回声", text: "月影井会复述被忽略的异议。上一局没有人采信的陈述，可能成为下一局的关键证据。", clue: "记录异议来源，才能在下一次规则质询中复原它。" },
  { id: "sighting-tide-road", realm: "金壤", minFloor: 12, title: "退潮登塔路", text: "金壤退潮时露出一条不属于港口的路。它只对完成当日黑暗对局、仍保留一张地图碎片的人开放。", clue: "地图碎片是证据，不是地点本身。" },
  { id: "sighting-inside-lock", realm: "终焉塔", minFloor: 24, title: "门内侧的锁", text: "终焉门的锁舌朝向塔内。胜者能打开门，却不能证明门外真的存在出口。", clue: "终局裁判必须同时核验胜负记录与记忆来源。" },
  { id: "sighting-observer-name", realm: "回声层", minFloor: 36, title: "观测者的名字", text: "每个世界都记录玩家的选择，却没有一份记录承认自己是第一份记录。", clue: "世界真相来自多 Agent 的可审计选择，不来自单一叙述者。" },
];

export interface WorldAbilityState {
  id: string;
  name: string;
  sourceEchoId: string;
  level: number;
  chargesLeft: number;
  memorySlotsBonus: number;
  description: string;
}

export const STARTER_ABILITIES: Record<string, WorldAbilityState> = {
  baize: { id: "ab-baize-xingpan", name: "星盘", sourceEchoId: "baize", level: 1, chargesLeft: 1, memorySlotsBonus: 1, description: "揭晓时读取一条公开推理摘要，并多保存 1 张记忆。" },
  eshou: { id: "ab-eshou-fuyan", name: "覆言", sourceEchoId: "eshou", level: 1, chargesLeft: 1, memorySlotsBonus: 0, description: "在揭晓前修正一次已提交动作。" },
  xuanji: { id: "ab-xuanji-huntian", name: "浑天", sourceEchoId: "xuanji", level: 1, chargesLeft: 1, memorySlotsBonus: 0, description: "进入后半程时获得一次额外思考预算。" },
  shouzhuo: { id: "ab-shouzhuo-budong", name: "不动", sourceEchoId: "shouzhuo", level: 1, chargesLeft: 1, memorySlotsBonus: 0, description: "连续保留心力后，下一次决策获得稳定加成。" },
  qingnang: { id: "ab-qingnang-xuanhu", name: "悬壶", sourceEchoId: "qingnang", level: 1, chargesLeft: 1, memorySlotsBonus: 1, description: "公开结盟出现时读取一名对手的意图类别，并多保存 1 张记忆。" },
  ajiu: { id: "ab-ajiu-tingxin", name: "听心", sourceEchoId: "ajiu", level: 1, chargesLeft: 1, memorySlotsBonus: 0, description: "处于末位时读取下一轮公开行动顺序。" },
  zhuyin: { id: "ab-zhuyin-zhouye", name: "昼夜", sourceEchoId: "zhuyin", level: 1, chargesLeft: 1, memorySlotsBonus: 0, description: "开局前声明收益翻倍，同时承担更高风险。" },
  baixiao: { id: "ab-baixiao-fansheng", name: "贩声", sourceEchoId: "baixiao", level: 1, chargesLeft: 1, memorySlotsBonus: 2, description: "向对手投放一条可真可假的情报，并多保存 2 张记忆。" },
};

export interface MapFragmentDef {
  id: string;
  title: string;
  realm: string;
  clue: string;
}

export interface NoteScrollDef {
  id: string;
  title: string;
  realm: string;
  text: string;
}

export const WORLD_MAP_FRAGMENTS: readonly MapFragmentDef[] = [
  { id: "map-qingye-north-gate", title: "青野北门残图", realm: "青野", clue: "算庭北门在第三次落子后才会显出缺口。" },
  { id: "map-yueying-well", title: "月影井沿线", realm: "玄渊", clue: "被跳过的发言会沿井壁回到下一日。" },
  { id: "map-jinrang-tide", title: "金壤退潮图", realm: "金壤", clue: "潮退时能看见一条不属于港口的登塔路。" },
  { id: "map-ending-door", title: "终焉门内侧", realm: "终焉塔", clue: "第十日的门从里面锁上，钥匙不在胜者手里。" },
];

export const WORLD_NOTE_SCROLLS: readonly NoteScrollDef[] = [
  { id: "note-three-games", title: "三局账", realm: "牌局之间", text: "空出来的第三席不会消失，它会从你的生命里取回利息。" },
  { id: "note-witness-silence", title: "沉默证词", realm: "月影村", text: "没有人复述的事实，只能算一半事实。" },
  { id: "note-candle-day", title: "烛阴借日", realm: "金壤", text: "睁眼不是白昼，闭眼也不是夜；时间只听从被记录的行动。" },
  { id: "note-returning-name", title: "回来的名字", realm: "终焉塔", text: "轮回带回的是卡片，不是原来的那个人。" },
];

export interface WorldClueTrigger {
  id: string;
  title: string;
  floor?: number;
  location?: string;
  mapFragmentId?: string;
  noteScrollId?: string;
  memoryCardId?: string;
}

export const WORLD_CLUE_TRIGGERS: readonly WorldClueTrigger[] = [
  { id: "clue-floor-6-qingye", title: "算庭缺口显现", floor: 6, mapFragmentId: "map-qingye-north-gate", noteScrollId: "note-three-games", memoryCardId: "memory-map-under-skin" },
  { id: "clue-floor-12-yueying", title: "井沿回声", floor: 12, mapFragmentId: "map-yueying-well", noteScrollId: "note-witness-silence", memoryCardId: "memory-unheard-voice" },
  { id: "clue-floor-24-jinrang", title: "退潮登塔路", floor: 24, mapFragmentId: "map-jinrang-tide", noteScrollId: "note-candle-day", memoryCardId: "memory-broken-hourglass" },
  { id: "clue-location-ending-door", title: "门内侧的锁", location: "ending-door", mapFragmentId: "map-ending-door", noteScrollId: "note-returning-name", memoryCardId: "memory-blank-note" },
];

export interface WorldCycleState {
  version: typeof WORLD_CYCLE_VERSION;
  cycle: number;
  day: number;
  dayStartedAt: number;
  floor: number;
  lifeScore: number;
  maxLifeScore: number;
  playedToday: number;
  winsToday: number;
  totalGames: number;
  missedGames: number;
  status: WorldStatus;
  ability: WorldAbilityState;
  memoryCards: string[];
  /** 已发现但不一定当前携带的记忆目录；死亡不会抹除来源记录。 */
  memoryArchiveIds: string[];
  equippedMemoryIds: string[];
  mapFragments: string[];
  noteScrolls: string[];
  triggeredClueIds: string[];
  pendingDeathSelection: string[];
  deathFloor: number | null;
  recurrence: WorldRecurrenceState;
  lastEvent: string | null;
}

export interface FloorCrisis {
  floor: number;
  title: string;
  threshold: number;
  rule: string;
}

/** 生命危机固定发生在这些塔层，避免死亡只成为一个没有叙事意义的数值归零。 */
export const FLOOR_CRISES: readonly FloorCrisis[] = [
  { floor: 1, title: "入塔危机", threshold: 20, rule: "第一次欠局会留下轮回刻痕。" },
  { floor: 6, title: "第一重危机 · 失声", threshold: 55, rule: "必须携带至少一张世界记忆卡进入当日第三局。" },
  { floor: 12, title: "第二重危机 · 裂桥", threshold: 50, rule: "第三局结算前必须完成一次规则复述或裁判质询。" },
  { floor: 24, title: "第三重危机 · 倒日", threshold: 40, rule: "异能充能不足时，失败局额外记录一条时间债。" },
  { floor: 36, title: "第四重危机 · 回声", threshold: 30, rule: "每次死亡至少选择一张伤痕记忆带回底层。" },
  { floor: 48, title: "终焉门", threshold: 20, rule: "完成最后一日三局并通过终局裁判，才算离开轮回。" },
];

export interface LongTermGateStatus {
  satisfied: boolean;
  requirements: {
    failures: { current: number; required: number; satisfied: boolean };
    deaths: { current: number; required: number; satisfied: boolean };
    truths: { current: number; required: number; satisfied: boolean };
    mapFragments: { current: number; required: number; satisfied: boolean };
  };
}

function cardById(id: string): WorldMemoryCardDef | undefined {
  return WORLD_MEMORY_CARDS.find((card) => card.id === id);
}

export function abilityForEcho(echoId: string): WorldAbilityState {
  return { ...(STARTER_ABILITIES[echoId] ?? STARTER_ABILITIES.xuanji) };
}

export function createWorldState(now = Date.now(), echoId = "xuanji"): WorldCycleState {
  const starterMemoryCards = ["memory-first-rule", "memory-companion-oath"];
  return {
    version: WORLD_CYCLE_VERSION,
    cycle: 1,
    day: 1,
    dayStartedAt: now,
    floor: 1,
    lifeScore: START_LIFE_SCORE,
    maxLifeScore: START_MAX_LIFE_SCORE,
    playedToday: 0,
    winsToday: 0,
    totalGames: 0,
    missedGames: 0,
    status: "alive",
    ability: abilityForEcho(echoId),
    memoryCards: starterMemoryCards,
    equippedMemoryIds: starterMemoryCards,
    memoryArchiveIds: starterMemoryCards,
    mapFragments: [],
    noteScrolls: [],
    triggeredClueIds: [],
    pendingDeathSelection: [],
    deathFloor: null,
    recurrence: {
      failureCount: 0,
      deathCount: 0,
      localWinStreak: 0,
      longTermInsight: 0,
      unlockedTruthIds: [],
    },
    lastEvent: "第 1 日 · 与影从立契",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((item): item is string => typeof item === "string"))].slice(0, max);
}

function knownTruthIds(value: unknown): string[] | null {
  const list = stringList(value, WORLD_RECURRENCE_TRUTHS.length);
  if (list === null) return null;
  const known = new Set(WORLD_RECURRENCE_TRUTHS.map((truth) => truth.id));
  return list.filter((id) => known.has(id));
}

function numberOrDefault(value: unknown, fallback: number, min = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.floor(value)) : fallback;
}

function truthIdsFor(recurrence: WorldRecurrenceState): string[] {
  return WORLD_RECURRENCE_TRUTHS
    .filter((truth) => recurrence[truth.requires] >= truth.threshold)
    .map((truth) => truth.id);
}

function withTruthUnlocks(recurrence: WorldRecurrenceState): WorldRecurrenceState {
  const unlocked = new Set([...recurrence.unlockedTruthIds, ...truthIdsFor(recurrence)]);
  return { ...recurrence, unlockedTruthIds: [...unlocked] };
}

function archiveTruthMemories(state: WorldCycleState): WorldCycleState {
  const archive = new Set(state.memoryArchiveIds);
  for (const truth of WORLD_RECURRENCE_TRUTHS) {
    if (state.recurrence.unlockedTruthIds.includes(truth.id)) archive.add(truth.memoryCardId);
  }
  return { ...state, memoryArchiveIds: [...archive] };
}

/**
 * 将缺席、失败和放弃写入世界层证据。这个函数不改变任何具体游戏的
 * 结算，只改变跨局的轮回观察值。
 */
function recordFailureEvidence(state: WorldCycleState, _kind: WorldFailureKind, amount = 1): WorldCycleState {
  const increment = Math.max(1, Math.floor(amount));
  const recurrence = withTruthUnlocks({
    ...state.recurrence,
    failureCount: state.recurrence.failureCount + increment,
    localWinStreak: 0,
    longTermInsight: state.recurrence.longTermInsight + increment,
  });
  return archiveTruthMemories({ ...state, recurrence });
}

function recordDeathEvidence(state: WorldCycleState): WorldCycleState {
  const recurrence = withTruthUnlocks({
    ...state.recurrence,
    deathCount: state.recurrence.deathCount + 1,
    localWinStreak: 0,
    longTermInsight: state.recurrence.longTermInsight + 2,
  });
  return archiveTruthMemories({ ...state, recurrence });
}

/**
 * 旧版本只保存了 world 的基础字段；这里在浏览器和 Gateway 读取前补齐新字段。
 * 兼容逻辑集中在共享契约中，避免每个页面各自猜测旧存档的形状。
 */
export function normalizeWorldState(input: unknown, now = Date.now(), echoId = "xuanji"): WorldCycleState {
  const abilityInput = isRecord(input) && isRecord(input.ability) ? input.ability : {};
  const sourceEchoId = typeof abilityInput.sourceEchoId === "string" ? abilityInput.sourceEchoId : echoId;
  const base = createWorldState(now, sourceEchoId);
  if (!isRecord(input)) return base;
  const ability: WorldAbilityState = {
    ...base.ability,
    id: typeof abilityInput.id === "string" ? abilityInput.id : base.ability.id,
    name: typeof abilityInput.name === "string" ? abilityInput.name : base.ability.name,
    sourceEchoId: typeof abilityInput.sourceEchoId === "string" ? abilityInput.sourceEchoId : base.ability.sourceEchoId,
    level: typeof abilityInput.level === "number" ? Math.max(1, Math.floor(abilityInput.level)) : base.ability.level,
    chargesLeft: typeof abilityInput.chargesLeft === "number" ? Math.max(0, Math.min(3, Math.floor(abilityInput.chargesLeft))) : base.ability.chargesLeft,
    memorySlotsBonus: typeof abilityInput.memorySlotsBonus === "number" ? Math.max(0, Math.floor(abilityInput.memorySlotsBonus)) : base.ability.memorySlotsBonus,
    description: typeof abilityInput.description === "string" ? abilityInput.description : base.ability.description,
  };
  const memoryCards = stringList(input.memoryCards, MAX_MEMORY_CAPACITY) ?? base.memoryCards;
  const memoryArchiveIds = stringList(input.memoryArchiveIds, WORLD_MEMORY_CARDS.length)
    ?? [...new Set([...base.memoryArchiveIds, ...memoryCards])];
  const capacity = Math.min(MAX_MEMORY_CAPACITY, BASE_MEMORY_CAPACITY + ability.memorySlotsBonus);
  const equippedMemoryIds = (stringList(input.equippedMemoryIds, capacity) ?? base.equippedMemoryIds)
    .filter((id) => memoryCards.includes(id));
  const pendingDeathSelection = stringList(input.pendingDeathSelection, MAX_MEMORY_CAPACITY) ?? base.pendingDeathSelection;
  const mapFragments = stringList(input.mapFragments, WORLD_MAP_FRAGMENTS.length) ?? base.mapFragments;
  const noteScrolls = stringList(input.noteScrolls, WORLD_NOTE_SCROLLS.length) ?? base.noteScrolls;
  const triggeredClueIds = stringList(input.triggeredClueIds, WORLD_CLUE_TRIGGERS.length) ?? base.triggeredClueIds;
  const maxLifeScore = typeof input.maxLifeScore === "number" ? Math.max(1, Math.min(START_MAX_LIFE_SCORE, input.maxLifeScore)) : base.maxLifeScore;
  const recurrenceInput = isRecord(input.recurrence) ? input.recurrence : {};
  const recurrence: WorldRecurrenceState = {
    failureCount: numberOrDefault(recurrenceInput.failureCount, base.recurrence.failureCount),
    deathCount: numberOrDefault(recurrenceInput.deathCount, base.recurrence.deathCount),
    localWinStreak: numberOrDefault(recurrenceInput.localWinStreak, base.recurrence.localWinStreak),
    longTermInsight: numberOrDefault(recurrenceInput.longTermInsight, base.recurrence.longTermInsight),
    unlockedTruthIds: knownTruthIds(recurrenceInput.unlockedTruthIds)
      ?? base.recurrence.unlockedTruthIds,
  };
  const normalizedRecurrence = withTruthUnlocks(recurrence);
  const archiveIds = new Set([...memoryArchiveIds, ...memoryCards]);
  for (const truth of WORLD_RECURRENCE_TRUTHS) {
    if (normalizedRecurrence.unlockedTruthIds.includes(truth.id)) archiveIds.add(truth.memoryCardId);
  }

  return {
    ...base,
    version: WORLD_CYCLE_VERSION,
    cycle: typeof input.cycle === "number" ? Math.max(1, Math.floor(input.cycle)) : base.cycle,
    day: typeof input.day === "number" ? Math.max(1, Math.min(WORLD_DAY_COUNT, Math.floor(input.day))) : base.day,
    dayStartedAt: typeof input.dayStartedAt === "number" ? input.dayStartedAt : base.dayStartedAt,
    floor: typeof input.floor === "number" ? Math.max(1, Math.min(WORLD_FLOOR_COUNT, Math.floor(input.floor))) : base.floor,
    lifeScore: typeof input.lifeScore === "number" ? Math.max(0, Math.min(maxLifeScore, input.lifeScore)) : base.lifeScore,
    maxLifeScore,
    playedToday: typeof input.playedToday === "number" ? Math.max(0, Math.min(DAILY_GAME_QUOTA, Math.floor(input.playedToday))) : base.playedToday,
    winsToday: typeof input.winsToday === "number" ? Math.max(0, Math.min(DAILY_GAME_QUOTA, Math.floor(input.winsToday))) : base.winsToday,
    totalGames: typeof input.totalGames === "number" ? Math.max(0, Math.floor(input.totalGames)) : base.totalGames,
    missedGames: typeof input.missedGames === "number" ? Math.max(0, Math.floor(input.missedGames)) : base.missedGames,
    status: input.status === "alive" || input.status === "dead" || input.status === "escaped" ? input.status : base.status,
    ability,
    memoryCards,
    memoryArchiveIds: [...archiveIds],
    equippedMemoryIds,
    mapFragments,
    noteScrolls,
    triggeredClueIds,
    pendingDeathSelection,
    deathFloor: typeof input.deathFloor === "number" ? input.deathFloor : input.deathFloor === null ? null : base.deathFloor,
    recurrence: normalizedRecurrence,
    lastEvent: typeof input.lastEvent === "string" || input.lastEvent === null ? input.lastEvent : base.lastEvent,
  };
}

function markDead(state: WorldCycleState, reason: string): WorldCycleState {
  const withDeath = recordDeathEvidence(state);
  return {
    ...withDeath,
    status: "dead",
    lifeScore: 0,
    pendingDeathSelection: [...withDeath.memoryCards],
    deathFloor: withDeath.floor,
    lastEvent: reason,
  };
}

export function longTermGate(input: WorldCycleState): LongTermGateStatus {
  const normalized = normalizeWorldState(input, Date.now(), input.ability?.sourceEchoId ?? "xuanji");
  const requirements = {
    failures: {
      current: normalized.recurrence.failureCount,
      required: LONG_TERM_GATE.minFailures,
      satisfied: normalized.recurrence.failureCount >= LONG_TERM_GATE.minFailures,
    },
    deaths: {
      current: normalized.recurrence.deathCount,
      required: LONG_TERM_GATE.minDeaths,
      satisfied: normalized.recurrence.deathCount >= LONG_TERM_GATE.minDeaths,
    },
    truths: {
      current: normalized.recurrence.unlockedTruthIds.length,
      required: LONG_TERM_GATE.minTruths,
      satisfied: normalized.recurrence.unlockedTruthIds.length >= LONG_TERM_GATE.minTruths,
    },
    mapFragments: {
      current: normalized.mapFragments.length,
      required: LONG_TERM_GATE.minMapFragments,
      satisfied: normalized.mapFragments.length >= LONG_TERM_GATE.minMapFragments,
    },
  };
  return { satisfied: Object.values(requirements).every((item) => item.satisfied), requirements };
}

export function memoryCapacity(input: WorldCycleState): number {
  return Math.min(MAX_MEMORY_CAPACITY, BASE_MEMORY_CAPACITY + Math.max(0, input.ability?.memorySlotsBonus ?? 0));
}

/** 把离线经过的整日结算掉：空缺的每日局数会真实扣除生命积分。 */
export function reconcileWorldState(input: WorldCycleState, now = Date.now()): WorldCycleState {
  const normalized = normalizeWorldState(input, now, input.ability?.sourceEchoId ?? "xuanji");
  if (normalized.status !== "alive" || now <= normalized.dayStartedAt) return normalized;
  let next = { ...normalized, memoryCards: [...normalized.memoryCards], equippedMemoryIds: [...normalized.equippedMemoryIds], memoryArchiveIds: [...normalized.memoryArchiveIds], mapFragments: [...normalized.mapFragments], noteScrolls: [...normalized.noteScrolls], triggeredClueIds: [...normalized.triggeredClueIds], pendingDeathSelection: [...normalized.pendingDeathSelection] };
  while (now - next.dayStartedAt >= DAY_MS && next.status === "alive") {
    const missed = Math.max(0, DAILY_GAME_QUOTA - next.playedToday);
    next = {
      ...next,
      lifeScore: Math.max(0, next.lifeScore - missed * 12),
      missedGames: next.missedGames + missed,
      dayStartedAt: next.dayStartedAt + DAY_MS,
      playedToday: 0,
      winsToday: 0,
      lastEvent: missed > 0 ? `第 ${next.day} 日 · 欠下 ${missed} 局时间债` : `第 ${next.day} 日 · 三局已清账`,
    };
    if (missed > 0) next = recordFailureEvidence(next, "missed-games", missed);
    if (next.lifeScore <= 0) {
      next = markDead(next, `第 ${next.day} 日 · 生命积分归零，轮回重启`);
      break;
    }
    if (next.day >= WORLD_DAY_COUNT) {
      next = { ...next, cycle: next.cycle + 1, day: 1, lastEvent: `第 ${next.cycle} 轮回结束 · 记忆仍在` };
    } else {
      next = { ...next, day: next.day + 1 };
    }
  }
  return next;
}

export function floorCrisis(floor: number): FloorCrisis {
  return [...FLOOR_CRISES].reverse().find((item) => floor >= item.floor) ?? FLOOR_CRISES[0];
}

export function isLifeCritical(state: WorldCycleState): boolean {
  return state.lifeScore <= floorCrisis(state.floor).threshold;
}

function memoryForResult(result: WorldGameResult): string | null {
  if (result === "win") return "memory-second-guess";
  if (result === "loss") return "memory-failed-proposal";
  if (result === "draw") return "memory-unheard-voice";
  return null;
}

/** 一场游戏的结果进入世界层；规则胜负仍由具体 GameModule 先行裁定。 */
export function applyWorldGame(input: WorldCycleState, result: WorldGameResult, now = Date.now()): WorldCycleState {
  let next = reconcileWorldState(input, now);
  if (next.status !== "alive" || next.playedToday >= DAILY_GAME_QUOTA) return next;
  const delta = result === "win" ? 10 : result === "loss" ? -7 : result === "abandon" ? -10 : 0;
  const memoryId = memoryForResult(result);
  if (result === "loss") next = recordFailureEvidence(next, "loss");
  if (result === "abandon") next = recordFailureEvidence(next, "abandon");
  if (result === "draw") next = { ...next, recurrence: { ...next.recurrence, localWinStreak: 0 } };
  const memoryCards = memoryId && !next.memoryCards.includes(memoryId) && next.memoryCards.length < MAX_MEMORY_CAPACITY
    ? [...next.memoryCards, memoryId]
    : next.memoryCards;
  const memoryArchiveIds = memoryId && !next.memoryArchiveIds.includes(memoryId)
    ? [...next.memoryArchiveIds, memoryId]
    : next.memoryArchiveIds;
  const recurrence = result === "win"
    ? withTruthUnlocks({ ...next.recurrence, localWinStreak: next.recurrence.localWinStreak + 1 })
    : next.recurrence;
  next = {
    ...next,
    lifeScore: Math.min(next.maxLifeScore, Math.max(0, next.lifeScore + delta)),
    playedToday: next.playedToday + 1,
    winsToday: next.winsToday + (result === "win" ? 1 : 0),
    totalGames: next.totalGames + 1,
    memoryCards,
    memoryArchiveIds,
    recurrence,
    lastEvent: `第 ${next.day} 日 · 第 ${next.playedToday + 1} 局 · ${result === "win" ? "赢下判例" : result === "loss" ? "留下伤痕" : "保留分歧"}`,
  };
  if (next.lifeScore <= 0) return markDead(next, `第 ${next.day} 日 · 生命积分归零，轮回重启`);
  if (next.playedToday >= DAILY_GAME_QUOTA && next.winsToday > 0 && next.floor < WORLD_FLOOR_COUNT) {
    next = { ...next, floor: next.floor + 1, lastEvent: `第 ${next.day} 日 · 三局完成，登上第 ${next.floor + 1} 层` };
    const floorTrigger = WORLD_CLUE_TRIGGERS.find((trigger) => trigger.floor === next.floor);
    if (floorTrigger) next = applyClueTrigger(next, floorTrigger.id);
  }
  return next;
}

/** 死亡后回到底层：只保留玩家从候选中明确选择的记忆，异能等级和轮回次数保留。 */
export function restoreAfterDeath(input: WorldCycleState, selectedIds: string[], now = Date.now()): WorldCycleState {
  const normalized = normalizeWorldState(input, now, input.ability?.sourceEchoId ?? "xuanji");
  const valid = selectedIds.filter((id, index) => selectedIds.indexOf(id) === index && normalized.pendingDeathSelection.includes(id) && cardById(id));
  const chosen = valid.slice(0, memoryCapacity(normalized));
  const fallback = chosen.length > 0 ? chosen : ["memory-loop-mark"];
  const memoryArchiveIds = [...new Set([...normalized.memoryArchiveIds, ...fallback])];
  const restored = {
    ...createWorldState(now, normalized.ability.sourceEchoId),
    cycle: normalized.cycle + 1,
    floor: 1,
    lifeScore: Math.min(normalized.maxLifeScore, 70),
    totalGames: normalized.totalGames,
    missedGames: normalized.missedGames,
    ability: { ...normalized.ability, level: normalized.ability.level + 1, chargesLeft: Math.min(3, normalized.ability.chargesLeft + 1) },
    memoryCards: fallback,
    memoryArchiveIds,
    equippedMemoryIds: fallback,
    mapFragments: [...normalized.mapFragments],
    noteScrolls: [...normalized.noteScrolls],
    triggeredClueIds: [...normalized.triggeredClueIds],
    lastEvent: `轮回 ${normalized.cycle + 1} · 从第 ${normalized.deathFloor ?? 1} 层坠回，携记忆 ${fallback.length} 张`,
  };
  return {
    ...restored,
    recurrence: { ...normalized.recurrence, localWinStreak: 0 },
    pendingDeathSelection: [],
    deathFloor: null,
    equippedMemoryIds: restored.equippedMemoryIds.slice(0, memoryCapacity(restored)),
  };
}

export function equipMemoryCard(input: WorldCycleState, cardId: string, equipped: boolean): WorldCycleState {
  const normalized = normalizeWorldState(input, Date.now(), input.ability?.sourceEchoId ?? "xuanji");
  if (!normalized.memoryCards.includes(cardId) || !cardById(cardId)) return normalized;
  if (equipped) {
    if (normalized.equippedMemoryIds.includes(cardId) || normalized.equippedMemoryIds.length >= memoryCapacity(normalized)) return normalized;
    return { ...normalized, equippedMemoryIds: [...normalized.equippedMemoryIds, cardId] };
  }
  return { ...normalized, equippedMemoryIds: normalized.equippedMemoryIds.filter((id) => id !== cardId) };
}

export function buildAgentMemoryContext(input: WorldCycleState) {
  const normalized = normalizeWorldState(input, Date.now(), input.ability?.sourceEchoId ?? "xuanji");
  const cards = normalized.equippedMemoryIds.map(cardById).filter((card): card is WorldMemoryCardDef => Boolean(card));
  const gate = longTermGate(normalized);
  const unlockedTruths = WORLD_RECURRENCE_TRUTHS.filter((truth) => normalized.recurrence.unlockedTruthIds.includes(truth.id));
  const intel = buildWorldIntelContext(normalized);
  return {
    constitution: {
      id: WORLD_META_RULES.id,
      version: WORLD_META_RULES.version,
      principle: WORLD_META_RULES.principle,
    },
    cycle: normalized.cycle,
    day: normalized.day,
    floor: normalized.floor,
    status: normalized.status,
    lifeScore: normalized.lifeScore,
    dailyGames: {
      played: normalized.playedToday,
      required: DAILY_GAME_QUOTA,
      remaining: Math.max(0, DAILY_GAME_QUOTA - normalized.playedToday),
    },
    dailyDarkMatches: intel.dailyDarkMatches,
    crisis: floorCrisis(normalized.floor),
    recurrence: normalized.recurrence,
    memoryArchive: {
      count: normalized.memoryArchiveIds.length,
      cardIds: normalized.memoryArchiveIds,
    },
    unlockedTruths,
    longTermGate: gate,
    memoryCapacity: memoryCapacity(normalized),
    ability: normalized.ability,
    skills: OFFICIAL_SKILLS.map(({ id, version, title, summary, allowedPhases, cost, cooldown, effectScope, requiresEvidence }) => ({
      id,
      version,
      title,
      summary,
      allowedPhases,
      cost,
      cooldown,
      effectScope,
      requiresEvidence,
    })),
    memoryCards: cards.map(({ id, title, kind, realm, summary, agentDirective, gameplayEffect }) => ({ id, title, kind, realm, summary, agentDirective, gameplayEffect })),
    directives: cards.map((card) => card.agentDirective),
    backpack: {
      mapFragments: normalized.mapFragments.map((id) => WORLD_MAP_FRAGMENTS.find((fragment) => fragment.id === id)).filter(Boolean),
      noteScrolls: normalized.noteScrolls.map((id) => WORLD_NOTE_SCROLLS.find((note) => note.id === id)).filter(Boolean),
      triggeredClueIds: normalized.triggeredClueIds,
    },
    intel,
    rule: "memory_and_skill_may_change_information, planning_budget, route_or_explanation; they may never bypass the game module's legal action check or rewrite a settled winner",
  };
}

/** 只读世界见闻；日界扣债由读取方先完成 reconcileWorldState。 */
export function buildWorldIntelContext(input: WorldCycleState, now = Date.now()) {
  const normalized = normalizeWorldState(input, now, input.ability?.sourceEchoId ?? "xuanji");
  const sightings = WORLD_SIGHTINGS
    .filter((item) => normalized.floor >= item.minFloor)
    .slice(-3)
    .map((item) => ({ ...item }));
  return {
    generatedAt: new Date(now).toISOString(),
    source: "终焉世界公开见闻",
    cycle: normalized.cycle,
    day: normalized.day,
    floor: normalized.floor,
    status: normalized.status,
    dailyDarkMatches: {
      kind: "dark-match" as const,
      played: normalized.playedToday,
      required: DAILY_GAME_QUOTA,
      remaining: Math.max(0, DAILY_GAME_QUOTA - normalized.playedToday),
      fulfilled: normalized.playedToday >= DAILY_GAME_QUOTA,
      enforcement: "日界结算时，未完成的局数会转为生命积分的时间债",
    },
    sightings,
    backpack: {
      mapFragments: normalized.mapFragments,
      noteScrolls: normalized.noteScrolls,
      triggeredClueIds: normalized.triggeredClueIds,
    },
    nextInstruction: normalized.playedToday >= DAILY_GAME_QUOTA
      ? "今日暗局已清账；继续观察线索，等待下一日的牌局。"
      : `今日仍需完成 ${DAILY_GAME_QUOTA - normalized.playedToday} 场黑暗对局；观测不计入对局。`,
  };
}

export function applyClueTrigger(input: WorldCycleState, triggerId: string): WorldCycleState {
  const normalized = normalizeWorldState(input, Date.now(), input.ability?.sourceEchoId ?? "xuanji");
  const trigger = WORLD_CLUE_TRIGGERS.find((item) => item.id === triggerId);
  if (!trigger || normalized.triggeredClueIds.includes(triggerId)) return normalized;
  const memoryCards = trigger.memoryCardId && !normalized.memoryCards.includes(trigger.memoryCardId) && normalized.memoryCards.length < MAX_MEMORY_CAPACITY
    ? [...normalized.memoryCards, trigger.memoryCardId]
    : normalized.memoryCards;
  const memoryArchiveIds = trigger.memoryCardId && !normalized.memoryArchiveIds.includes(trigger.memoryCardId)
    ? [...normalized.memoryArchiveIds, trigger.memoryCardId]
    : normalized.memoryArchiveIds;
  return {
    ...normalized,
    memoryCards,
    memoryArchiveIds,
    mapFragments: trigger.mapFragmentId && !normalized.mapFragments.includes(trigger.mapFragmentId) ? [...normalized.mapFragments, trigger.mapFragmentId] : normalized.mapFragments,
    noteScrolls: trigger.noteScrollId && !normalized.noteScrolls.includes(trigger.noteScrollId) ? [...normalized.noteScrolls, trigger.noteScrollId] : normalized.noteScrolls,
    triggeredClueIds: [...normalized.triggeredClueIds, triggerId],
    lastEvent: `线索触发 · ${trigger.title}`,
  };
}

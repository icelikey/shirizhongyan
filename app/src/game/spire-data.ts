/**
 * ============================================================================
 * 碎境爬塔 · S1 数据防御性接口层（S2 地图组专用）
 * ============================================================================
 * cards / enemies / relics / potions 四份数据由战斗组（S1）编写，
 * 合并前本分支上并不存在。本层通过 `import.meta.glob` 动态解析：
 *   - 文件存在（合并后）→ 自动采用 S1 数据，本文件零改动生效；
 *   - 文件缺席（本分支）→ 回落到本地兜底表（中文名 + 简述，立绘为空），
 *     完全未知的 id 兜底为「名称 = id」。
 * 严禁静态 import S1 数据文件（会导致本分支编译失败）。
 *
 * 敌人 id 池为与 S1 的口头契约常量，写死在本文件：
 *   普通 zhiren/dashou/shanxiao/daoshu/youhun/kuilei/shadao/zhuyao
 *   精英 panguan/cike/aoshou
 *   Boss 按层 taowu(1) / qianmian(2) / zhongyan(3)
 * ============================================================================
 */
import { useEffect, useReducer } from 'react'
import type { CardDef, CardRarity, CardType, DeckStyle, EnemyDef, PotionDef, RelicDef, RelicRarity } from '@/data/spire/types'

/* ── 敌人 id 池（与 S1 约定，冻结） ─────────────────────────────────────── */
export const NORMAL_ENEMIES = ['zhiren', 'dashou', 'shanxiao', 'daoshu', 'youhun', 'kuilei', 'shadao', 'zhuyao'] as const
export const ELITE_ENEMIES = ['panguan', 'cike', 'aoshou'] as const
/** 第 1/2/3 层 Boss（下标 = floor - 1） */
export const FLOOR_BOSSES = ['taowu', 'qianmian', 'zhongyan'] as const

/* ── 起始构筑（契约：门票 12♦ 后 startRun(style, STARTER_DECK, STARTER_RELIC)） ── */
// 合并后对齐 S1 真实 id（moye/jinzhong/… 与 cinnabar-seal 等英文 slug）
export const STARTER_DECKS: Record<DeckStyle, string[]> = {
  blade: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'lianhuan', 'pojia'],
  bulwark: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'tiebu', 'shouwei'],
  trick: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'guanxing', 'duji'],
}
export const STARTER_RELICS: Record<DeckStyle, string> = {
  blade: 'cinnabar-seal',
  bulwark: 'tortoise-shell',
  trick: 'bronze-bell',
}

/* ── 本地兜底表（S1 数据缺席时使用；合并后被 S1 数据覆盖） ─────────────────── */
interface FallbackCard { name: string; cost: number; type: CardType; rarity: CardRarity; desc: string }
const FALLBACK_CARDS: Record<string, FallbackCard> = {
  moren: { name: '墨刃', cost: 1, type: 'attack', rarity: 'common', desc: '造成 6 点伤害。' },
  jinzhongzhao: { name: '金钟罩', cost: 1, type: 'skill', rarity: 'common', desc: '获得 5 点格挡。' },
  lianhuanren: { name: '连环刃', cost: 1, type: 'attack', rarity: 'uncommon', desc: '造成 4 点伤害 2 次。' },
  pojiazhan: { name: '破甲斩', cost: 2, type: 'attack', rarity: 'uncommon', desc: '造成 10 点伤害，施加 2 层易伤。' },
  tiebushan: { name: '铁布衫', cost: 1, type: 'skill', rarity: 'uncommon', desc: '获得 8 点格挡。' },
  yishouweigong: { name: '以守为攻', cost: 1, type: 'attack', rarity: 'uncommon', desc: '造成等同于当前格挡的伤害。' },
  guanxing: { name: '观星', cost: 0, type: 'skill', rarity: 'uncommon', desc: '抽 2 张牌。' },
  duji: { name: '毒计', cost: 1, type: 'skill', rarity: 'uncommon', desc: '施加 4 层中毒。' },
  yezhai: { name: '业债', cost: 0, type: 'skill', rarity: 'curse', desc: '无法打出。欠下的，总要还。' },
}
/** 兜底卡池（商店/事件随机奖励用；S1 数据在时被其完整卡表取代） */
const FALLBACK_CARD_POOL = ['moren', 'jinzhongzhao', 'lianhuanren', 'pojiazhan', 'tiebushan', 'yishouweigong', 'guanxing', 'duji']

interface FallbackRelic { name: string; rarity: RelicRarity; desc: string }
const FALLBACK_RELICS: Record<string, FallbackRelic> = {
  zhushayin: { name: '朱砂印', rarity: 'common', desc: '每场战斗打出的首张攻击牌伤害 +3。' },
  guijia: { name: '龟甲', rarity: 'common', desc: '每场战斗开始时获得 6 点格挡。' },
  rigui: { name: '日晷残片', rarity: 'boss', desc: '晷针虽断，余温尚在。每第 3 回合抽牌 +1。' },
  daobi: { name: '刀币', rarity: 'common', desc: '战斗金币奖励 +25%。' },
  hunpo: { name: '魂珀', rarity: 'uncommon', desc: '每场战斗首次生命归零时，保留 1 点生命。' },
  yinlu: { name: '引路灯', rarity: 'common', desc: '事件中的坏结果略微减轻。' },
  gushao: { name: '骨哨', rarity: 'uncommon', desc: '普通战斗首回合，全体敌人获得 1 层虚弱。' },
  tiequan: { name: '铁券', rarity: 'uncommon', desc: '每场战斗首次受到的攻击伤害减半。' },
  mingjing: { name: '明镜', rarity: 'uncommon', desc: '每回合第一次抽牌时，额外抽 1 张。' },
  yehuo: { name: '业火盏', rarity: 'boss', desc: '业债在手中燃烧：每张诅咒使你造成的伤害 +2。' },
  zhenzhi: { name: '镇纸', rarity: 'common', desc: '每场战斗打出的首张技能牌格挡 +4。' },
  shalou: { name: '沙漏', rarity: 'uncommon', desc: '第 3 回合起，每回合抽牌 +1。' },
  xingpan: { name: '星盘', rarity: 'boss', desc: '篝火升级时，可选择的牌 +1。' },
  canfu: { name: '残符', rarity: 'common', desc: '篝火回复量 +10%。' },
}
const FALLBACK_RELIC_POOL = Object.keys(FALLBACK_RELICS)

interface FallbackPotion { name: string; desc: string }
const FALLBACK_POTIONS: Record<string, FallbackPotion> = {
  jinchuang: { name: '金创药', desc: '回复 12 点生命。' },
  lishi: { name: '厉石散', desc: '获得 2 层力量。' },
  qingfeng: { name: '青锋酿', desc: '获得 2 层敏捷。' },
  duwu: { name: '毒雾瓶', desc: '对一名敌人施加 6 层中毒。' },
  hanshi: { name: '寒石散', desc: '对一名敌人施加 3 层虚弱。' },
  huoyou: { name: '火油瓶', desc: '对一名敌人施加 5 层燃烧。' },
}
const FALLBACK_POTION_POOL = Object.keys(FALLBACK_POTIONS)

const FALLBACK_ENEMY_NAMES: Record<string, string> = {
  zhiren: '纸人', dashou: '搭手', shanxiao: '山魈', daoshu: '盗鼠',
  youhun: '游魂', kuilei: '傀儡', shadao: '沙盗', zhuyao: '蛛妖',
  panguan: '判官', cike: '刺客', aoshou: '獒兽',
  taowu: '梼杌', qianmian: '千面', zhongyan: '终焉守望者',
}

/* ── glob 动态解析（文件缺席 → 空对象，构建安全） ─────────────────────────── */
const cardMods = import.meta.glob('../data/spire/cards.ts')
const enemyMods = import.meta.glob('../data/spire/enemies.ts')
const relicMods = import.meta.glob('../data/spire/relics.ts')
const potionMods = import.meta.glob('../data/spire/potions.ts')

/** 从模块导出中找第一个数组（兼容 CARDS / cards / default 等导出形态） */
function firstArray<T>(mod: unknown): T[] | null {
  if (!mod || typeof mod !== 'object') return null
  for (const v of Object.values(mod as Record<string, unknown>)) {
    if (Array.isArray(v)) return v as T[]
  }
  return null
}

async function loadFirst<T>(loaders: Record<string, () => Promise<unknown>>): Promise<T[] | null> {
  const loader = Object.values(loaders)[0]
  if (!loader) return null
  try {
    return firstArray<T>(await loader())
  } catch {
    return null
  }
}

interface SpireData {
  cards: Record<string, CardDef>
  relics: Record<string, RelicDef>
  potions: Record<string, PotionDef>
  enemies: Record<string, EnemyDef>
}

let cache: SpireData | null = null
let started = false
const listeners = new Set<() => void>()

const toMap = <T extends { id: string }>(arr: T[] | null): Record<string, T> =>
  Object.fromEntries((arr ?? []).map((x) => [x.id, x]))

async function ensureLoaded(): Promise<void> {
  if (started) return
  started = true
  const [cards, relics, potions, enemies] = await Promise.all([
    loadFirst<CardDef>(cardMods),
    loadFirst<RelicDef>(relicMods),
    loadFirst<PotionDef>(potionMods),
    loadFirst<EnemyDef>(enemyMods),
  ])
  cache = { cards: toMap(cards), relics: toMap(relics), potions: toMap(potions), enemies: toMap(enemies) }
  listeners.forEach((l) => l())
}

/** React 绑定：解析完成后触发一次重渲染（此前全部走兜底） */
export function useSpireDataReady(): boolean {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(bump)
    void ensureLoaded()
    return () => {
      listeners.delete(bump)
    }
  }, [])
  return cache !== null
}

/* ── 查询视图（同步，永远有兜底） ─────────────────────────────────────────── */
export interface CardView {
  id: string
  name: string
  cost: number
  type: CardType
  rarity: CardRarity
  desc: string
  art: string
  upgraded: boolean
}

/** 牌组条目（可能带 '+' 升级前缀）→ 展示视图 */
export function cardView(deckEntry: string): CardView {
  const upgraded = deckEntry.startsWith('+')
  const id = upgraded ? deckEntry.slice(1) : deckEntry
  const s1 = cache?.cards[id]
  if (s1) {
    return {
      id,
      name: upgraded ? `${s1.name}+` : s1.name,
      cost: upgraded ? (s1.upgraded.cost ?? s1.cost) : s1.cost,
      type: s1.type,
      rarity: s1.rarity,
      desc: upgraded ? s1.upgraded.desc : s1.desc,
      art: s1.art,
      upgraded,
    }
  }
  const fb = FALLBACK_CARDS[id]
  return {
    id,
    name: fb ? (upgraded ? `${fb.name}+` : fb.name) : id,
    cost: fb?.cost ?? 0,
    type: fb?.type ?? 'skill',
    rarity: fb?.rarity ?? 'common',
    desc: fb?.desc ?? '',
    art: '',
    upgraded,
  }
}

export interface RelicView { id: string; name: string; rarity: RelicRarity; desc: string }
export function relicView(id: string): RelicView {
  const s1 = cache?.relics[id]
  if (s1) return { id, name: s1.name, rarity: s1.rarity, desc: s1.desc }
  const fb = FALLBACK_RELICS[id]
  return { id, name: fb?.name ?? id, rarity: fb?.rarity ?? 'common', desc: fb?.desc ?? '' }
}

export interface PotionView { id: string; name: string; desc: string }
export function potionView(id: string): PotionView {
  const s1 = cache?.potions[id]
  if (s1) return { id, name: s1.name, desc: s1.desc }
  const fb = FALLBACK_POTIONS[id]
  return { id, name: fb?.name ?? id, desc: fb?.desc ?? '' }
}

export interface EnemyView { id: string; name: string; tier: 'normal' | 'elite' | 'boss'; art: string }
export function enemyView(id: string): EnemyView {
  const s1 = cache?.enemies[id]
  if (s1) return { id, name: s1.name, tier: s1.tier, art: s1.art }
  const tier: EnemyView['tier'] = (FLOOR_BOSSES as readonly string[]).includes(id)
    ? 'boss'
    : (ELITE_ENEMIES as readonly string[]).includes(id)
      ? 'elite'
      : 'normal'
  return { id, name: FALLBACK_ENEMY_NAMES[id] ?? id, tier, art: '' }
}

/* ── 随机池（S1 数据在 → 用 S1 全表；不在 → 兜底池） ─────────────────────── */
export function cardPool(): string[] {
  const data = cache
  const ids = data ? Object.keys(data.cards).filter((id) => data.cards[id]?.rarity !== 'curse') : []
  return ids.length > 0 ? ids : FALLBACK_CARD_POOL
}
export function relicPool(): string[] {
  const ids = cache ? Object.keys(cache.relics) : []
  return ids.length > 0 ? ids : FALLBACK_RELIC_POOL
}
export function potionPool(): string[] {
  const ids = cache ? Object.keys(cache.potions) : []
  return ids.length > 0 ? ids : FALLBACK_POTION_POOL
}

/** 事件/宝箱随机奖励兜底：refId 留空时由本池随机补齐 */
export function randomCardId(rng: () => number = Math.random): string {
  const pool = cardPool()
  return pool[Math.floor(rng() * pool.length)] ?? 'moren'
}
export function randomRelicId(owned: string[] = [], rng: () => number = Math.random): string {
  const pool = relicPool().filter((id) => !owned.includes(id))
  const src = pool.length > 0 ? pool : relicPool()
  return src[Math.floor(rng() * src.length)] ?? 'hunpo'
}
export function randomPotionId(rng: () => number = Math.random): string {
  const pool = potionPool()
  return pool[Math.floor(rng() * pool.length)] ?? 'jinchuang'
}

/* ── 抽敌逻辑（普通 1–2 敌；精英 1 精英 + 概率 1 小怪；Boss 单只） ─────────── */
export function pickBattleEnemies(floor: number, rng: () => number = Math.random): string[] {
  // 普通池按层加权：第 1 层只抽前 5 种（较弱），第 2 层起全池
  const pool = floor <= 1 ? NORMAL_ENEMIES.slice(0, 5) : NORMAL_ENEMIES
  const first = pool[Math.floor(rng() * pool.length)]
  if (rng() < 0.45) {
    const rest = pool.filter((e) => e !== first)
    return [first, rest[Math.floor(rng() * rest.length)]]
  }
  return [first]
}
export function pickEliteEnemies(floor: number, rng: () => number = Math.random): string[] {
  const elite = ELITE_ENEMIES[Math.floor(rng() * ELITE_ENEMIES.length)]
  if (rng() < 0.4) {
    const pool = floor <= 1 ? NORMAL_ENEMIES.slice(0, 5) : NORMAL_ENEMIES
    return [elite, pool[Math.floor(rng() * pool.length)]]
  }
  return [elite]
}
export function floorBoss(floor: number): string {
  return FLOOR_BOSSES[Math.min(Math.max(floor, 1), 3) - 1]
}

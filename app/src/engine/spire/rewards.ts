/**
 * 碎境爬塔 · 战斗奖励 roll（spire-combat.md §2）
 * 普通战：金币 20–35 + ♦碎片 4；精英：金币 45–65 + 碎片 8 + 遗物；
 * Boss：金币 80 + 碎片 20 + Boss 遗物三选一。
 * 卡牌三选一稀有度权重：普通 70% / 罕见 25% / 稀有 5%。
 */
import type { NodeType } from '@/data/spire/types'
import { CARD_POOL_BY_RARITY } from '@/data/spire/cards'
import { BOSS_RELIC_IDS, COMMON_RELIC_IDS, UNCOMMON_RELIC_IDS } from '@/data/spire/relics'

export type Rand = () => number

function randInt(rand: Rand, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

function pick<T>(rand: Rand, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

/** 战斗金币（聚宝盆 +25% 由调用方自行乘算或传入 hasCornucopia） */
export function rollGold(rand: Rand, nodeType: NodeType, hasCornucopia: boolean): number {
  let base: number
  if (nodeType === 'boss') base = 80
  else if (nodeType === 'elite') base = randInt(rand, 45, 65)
  else base = randInt(rand, 20, 35)
  return hasCornucopia ? Math.floor(base * 1.25) : base
}

/** 战斗碎片（♦ 金壤） */
export function fragmentsFor(nodeType: NodeType): number {
  if (nodeType === 'boss') return 20
  if (nodeType === 'elite') return 8
  return 4
}

/** 三选一卡牌：普通 70% / 罕见 25% / 稀有 5% */
export function rollCardChoices(rand: Rand, count = 3): string[] {
  const out: string[] = []
  let guard = 0
  while (out.length < count && guard++ < 100) {
    const roll = rand()
    const pool =
      roll < 0.7 ? CARD_POOL_BY_RARITY.common : roll < 0.95 ? CARD_POOL_BY_RARITY.uncommon : CARD_POOL_BY_RARITY.rare
    const id = pick(rand, pool)
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** 精英遗物（普通+罕见，未持有优先），Boss 遗物三选一（仅 Boss 稀有度，未持有优先） */
export function rollRelicChoices(rand: Rand, owned: string[], nodeType: NodeType, count: number): string[] {
  const pool =
    nodeType === 'boss' ? [...BOSS_RELIC_IDS] : [...COMMON_RELIC_IDS, ...UNCOMMON_RELIC_IDS]
  const unowned = pool.filter((id) => !owned.includes(id))
  const source = unowned.length > 0 ? unowned : pool
  const out: string[] = []
  let guard = 0
  while (out.length < Math.min(count, source.length) && guard++ < 100) {
    const id = pick(rand, source)
    if (!out.includes(id)) out.push(id)
  }
  return out
}

export interface RewardBundle {
  gold: number
  fragments: number
  cardChoices: string[]
  /** 精英 1 件 / Boss 3 选 1；普通战为空 */
  relicChoices: string[]
  isBoss: boolean
  isElite: boolean
}

export function rollRewards(rand: Rand, nodeType: NodeType, ownedRelics: string[]): RewardBundle {
  const isBoss = nodeType === 'boss'
  const isElite = nodeType === 'elite'
  return {
    gold: rollGold(rand, nodeType, ownedRelics.includes('cornucopia')),
    fragments: fragmentsFor(nodeType),
    cardChoices: rollCardChoices(rand, 3),
    relicChoices: isBoss ? rollRelicChoices(rand, ownedRelics, 'boss', 3) : isElite ? rollRelicChoices(rand, ownedRelics, 'elite', 1) : [],
    isBoss,
    isElite,
  }
}

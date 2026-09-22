/**
 * 碎境爬塔 共享类型契约（S1 战斗组 / S2 地图组共同依赖，冻结）
 */

export type CardType = 'attack' | 'skill' | 'power'
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'curse'

export type StatusId = 'strength' | 'dexterity' | 'vulnerable' | 'weak' | 'poison' | 'burn'

export interface Effect {
  kind:
    | 'damage'
    | 'damageAll'
    | 'randomMultiDamage'
    | 'block'
    | 'blockNextTurn'
    | 'draw'
    | 'gainEnergy'
    | 'applyStatus'
    | 'heal'
    | 'selfDamage'
    | 'reduceEnemyStrength'
    | 'invulnerable'
    | 'doubleNextAttack'
    | 'discardHandDraw'
    | 'executeThreshold'
  value: number
  status?: StatusId
  times?: number
}

export interface CardDef {
  id: string
  name: string
  cost: number
  type: CardType
  rarity: CardRarity
  target: 'enemy' | 'self' | 'none' | 'allEnemies'
  effects: Effect[]
  exhaust?: boolean
  art: string
  desc: string
  upgraded: { cost?: number; effects: Effect[]; desc: string }
}

export type RelicRarity = 'common' | 'uncommon' | 'boss'
export interface RelicDef {
  id: string
  name: string
  rarity: RelicRarity
  icon: string
  desc: string
}

export interface PotionDef {
  id: string
  name: string
  icon: string
  desc: string
  effects: Effect[]
}

export interface EnemyMove {
  kind: 'attack' | 'attackMulti' | 'block' | 'buff' | 'debuff' | 'summon'
  value: number
  times?: number
  status?: StatusId
  statusValue?: number
  summonId?: string
  weight: number
  label: string
}

export interface EnemyDef {
  id: string
  name: string
  art: string
  hp: [min: number, max: number]
  tier: 'normal' | 'elite' | 'boss'
  floors: number[]
  pattern: 'cycle' | 'weighted'
  moves: EnemyMove[]
  quote: string
  phaseTwo?: { threshold: number; moves: EnemyMove[]; quote: string }
}

export type NodeType = 'battle' | 'elite' | 'event' | 'rest' | 'shop' | 'treasure' | 'boss'
export interface MapNode {
  id: string
  row: number
  col: number
  type: NodeType
  next: string[]
  done: boolean
  enemyId?: string
}

export type DeckStyle = 'blade' | 'bulwark' | 'trick'

export interface EventEffect {
  kind: 'hp' | 'maxHp' | 'gold' | 'fragments' | 'card' | 'relic' | 'potion' | 'curse' | 'removeCard'
  value: number
  refId?: string
}
export interface EventOption {
  text: string
  result: string
  effects: EventEffect[]
}
export interface EventDef {
  id: string
  title: string
  art: string
  text: string
  options: EventOption[]
}

export const CURSE_CARD_ID = 'yezhai'

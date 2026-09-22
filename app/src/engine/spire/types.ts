/**
 * 碎境爬塔 · 战斗引擎内部类型（纯 TS，无 React 依赖）。
 * 引擎函数直接原地修改传入的 BattleState（调用方负责 structuredClone），
 * 并返回 BattleEvent[] 供 UI 做飘字/抖动/演出；endPlayerTurn 返回分步 Step[]。
 */
import type { EnemyDef, EnemyMove, NodeType, StatusId } from '@/data/spire/types'

export interface CardInstance {
  uid: number
  id: string
  upgraded: boolean
}

export type StatusMap = Partial<Record<StatusId, number>>

export interface PlayerCombat {
  hp: number
  maxHp: number
  block: number
  energy: number
  maxEnergy: number
  statuses: StatusMap
}

export interface Combatant {
  /** 实例 key（'e0'/'e1'…，召唤物递增） */
  key: string
  def: EnemyDef
  hp: number
  maxHp: number
  block: number
  statuses: StatusMap
  intent: EnemyMove | null
  /** cycle 游标 */
  moveCursor: number
  /** weighted 近两次出招 label（同一招不连续 3 次） */
  recentMoves: string[]
  phaseTwoActive: boolean
  /** 已行动回合数（千面狐每 3 回合换面） */
  turnsTaken: number
  /** 换面后下一玩家回合镜像反伤 */
  mirrored: boolean
  /** 釜底抽薪：下个自身回合开始时归还的力量 */
  pendingStrengthRestore: number
  alive: boolean
  summoned: boolean
}

export interface BattleCounters {
  /** 本回合打出牌数（算盘） */
  playedThisTurn: number
  /** 本回合打出技能牌数（残卷：第一张费用 -1） */
  skillsPlayedThisTurn: number
  blockNextTurn: number
  invulnerable: boolean
  doubleNextAttack: number
  firstHitHalvedUsed: boolean
  paperDollUsed: boolean
  /** 是否仍处于首回合（日晷残片 / 青铜铃） */
  firstTurn: boolean
}

export type BattlePhase = 'player' | 'enemy' | 'won' | 'lost'

export type BattleEvent =
  | { kind: 'turn'; turn: number }
  | { kind: 'draw'; count: number }
  | { kind: 'shuffle' }
  | { kind: 'play'; uid: number; cardId: string; targetKey?: string }
  | { kind: 'potion'; potionId: string; targetKey?: string }
  | { kind: 'damage'; target: 'player' | string; amount: number; blocked: number; attack: boolean }
  | { kind: 'block'; target: 'player' | string; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'status'; target: 'player' | string; status: StatusId; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'enemyAction'; enemy: string; label: string; moveKind: EnemyMove['kind'] }
  | { kind: 'death'; enemy: string }
  | { kind: 'phase'; enemy: string; quote: string }
  | { kind: 'summon'; enemy: string; name: string }
  | { kind: 'relic'; relicId: string; text: string }
  | { kind: 'deathSave'; text: string }
  | { kind: 'exhaust'; uid: number }
  | { kind: 'endTurn' }
  | { kind: 'win' }
  | { kind: 'lose' }

export interface BattleState {
  /** mulberry32 内部状态（确定性回放用） */
  rngState: number
  turn: number
  phase: BattlePhase
  nodeType: NodeType
  floor: number
  player: PlayerCombat
  enemies: Combatant[]
  drawPile: CardInstance[]
  hand: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]
  powers: string[]
  relics: string[]
  potions: string[]
  counters: BattleCounters
  uidCounter: number
  enemyKeyCounter: number
  kills: number
}

export interface Step {
  state: BattleState
  events: BattleEvent[]
}

export interface IntentDisplay {
  icon: 'attack' | 'block' | 'buff' | 'debuff' | 'unknown'
  label: string
  /** 攻击意图：预判每段伤害（含力量/虚弱/易伤） */
  damage?: number
  times?: number
  /** 防御意图：格挡值 */
  value?: number
  /** 烽火台：精英意图详情 */
  detail?: string
}

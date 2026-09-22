/**
 * 碎境爬塔 · 战斗引擎核心（spire-combat.md §1.1 / §1.2 精确实现）
 *
 * - 能量 3、每回合抽 5、格挡回合末清空（实现为：在持有者下个回合开始时清空，
 *   等价于"不能带入下一回合"，且保证格挡能在敌方阶段生效）。
 * - 四大牌堆：抽牌堆（耗尽洗入弃牌堆）/ 手牌 / 弃牌堆 / 消耗堆。
 * - 六种状态层：strength / dexterity / vulnerable / weak / poison / burn。
 * - 意图系统：cycle 循环 / weighted 权重（同一招不连续 3 次），开战即 roll 第一条。
 * - 效果结算器覆盖 types.ts Effect 全部 15 种 kind。
 * - 遗物 hook 按 id 结算（战斗内有效者）；Boss 半血 phaseTwo；梼杌 summon；
 *   千面狐每 3 回合换面 + 镜像反伤 1 回合（按 id 特判）。
 *
 * 所有函数原地修改传入 state（调用方先 structuredClone），返回 BattleEvent[]。
 */
import type { CardDef, EnemyMove, StatusId } from '@/data/spire/types'
import { getCard } from '@/data/spire/cards'
import { getEnemy } from '@/data/spire/enemies'
import { getPotion, potionNeedsTarget } from '@/data/spire/potions'
import { nextRandom, randInt, shuffle, weightedPick } from '@/engine/spire/rng'
import type {
  BattleEvent,
  BattleState,
  CardInstance,
  Combatant,
  IntentDisplay,
  Step,
} from '@/engine/spire/types'

export const BASE_ENERGY = 3
export const DRAW_PER_TURN = 5
export const MAX_ENEMIES = 3

/** 读取当前阶段（避免 TS 在同作用域赋值后对 phase 做错误窄化） */
function ph(s: BattleState): BattleState['phase'] {
  return s.phase
}

export interface CreateBattleOptions {
  enemyIds: string[]
  deck: string[]
  relics: string[]
  potions: string[]
  hp: number
  maxHp: number
  nodeType: BattleState['nodeType']
  floor: number
  seed?: number
}

// ============================================================ 初始化

export function createBattle(opts: CreateBattleOptions): BattleState {
  const s: BattleState = {
    rngState: (opts.seed ?? Date.now()) | 0,
    turn: 0,
    phase: 'player',
    nodeType: opts.nodeType,
    floor: opts.floor,
    player: {
      hp: opts.hp,
      maxHp: opts.maxHp,
      block: 0,
      energy: 0,
      maxEnergy: BASE_ENERGY,
      statuses: {},
    },
    enemies: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    powers: [],
    relics: [...opts.relics],
    potions: [...opts.potions],
    counters: {
      playedThisTurn: 0,
      skillsPlayedThisTurn: 0,
      blockNextTurn: 0,
      invulnerable: false,
      doubleNextAttack: 0,
      firstHitHalvedUsed: false,
      paperDollUsed: false,
      firstTurn: true,
    },
    uidCounter: 0,
    enemyKeyCounter: 0,
    kills: 0,
  }

  // 牌库 → 抽牌堆（随机牌序）
  for (const deckId of opts.deck) {
    const id = deckId.startsWith('+') ? deckId.slice(1) : deckId
    s.drawPile.push({ uid: s.uidCounter++, id, upgraded: deckId.startsWith('+') })
  }
  shuffle(s, s.drawPile)

  // 敌人（HP 区间内随机），开战即 roll 第一条意图
  for (const enemyId of opts.enemyIds.slice(0, MAX_ENEMIES)) {
    const c = spawnEnemy(s, enemyId, false)
    s.enemies.push(c)
  }
  for (const c of s.enemies) rollIntent(s, c)

  // 龟甲：战斗开始格挡 +8（经 blockNextTurn 在首回合开始时生效，避免被清空）
  if (s.relics.includes('tortoise-shell')) s.counters.blockNextTurn += 8

  return s
}

function spawnEnemy(s: BattleState, enemyId: string, summoned: boolean): Combatant {
  const def = getEnemy(enemyId)
  const maxHp = randInt(s, def.hp[0], def.hp[1])
  return {
    key: `e${s.enemyKeyCounter++}`,
    def,
    hp: maxHp,
    maxHp,
    block: 0,
    statuses: {},
    intent: null,
    moveCursor: 0,
    recentMoves: [],
    phaseTwoActive: false,
    turnsTaken: 0,
    mirrored: false,
    pendingStrengthRestore: 0,
    alive: true,
    summoned,
  }
}

// ============================================================ 状态层

export function statusOf(m: { statuses: BattleState['player']['statuses'] }, id: StatusId): number {
  return m.statuses[id] ?? 0
}

function addStatus(
  s: BattleState,
  target: 'player' | Combatant,
  status: StatusId,
  layers: number,
  events: BattleEvent[],
): void {
  const holder = target === 'player' ? s.player : target
  holder.statuses[status] = (holder.statuses[status] ?? 0) + layers
  if (holder.statuses[status] === 0 && status !== 'strength' && status !== 'dexterity') {
    delete holder.statuses[status]
  }
  events.push({
    kind: 'status',
    target: target === 'player' ? 'player' : target.key,
    status,
    amount: layers,
  })
}

/** 易伤 / 虚弱每回合 -1 层（持有者回合结束时） */
function decayTimedStatuses(holder: { statuses: BattleState['player']['statuses'] }): void {
  for (const id of ['vulnerable', 'weak'] as const) {
    const v = holder.statuses[id]
    if (v !== undefined) {
      if (v <= 1) delete holder.statuses[id]
      else holder.statuses[id] = v - 1
    }
  }
}

// ============================================================ 伤害结算

/** 玩家攻击牌单段基础伤害（力量 + 朱砂印 + 虚弱） */
function playerAttackBase(s: BattleState, value: number): number {
  let dmg = value + statusOf(s.player, 'strength')
  if (s.relics.includes('cinnabar-seal')) dmg += 2
  if (statusOf(s.player, 'weak') > 0) dmg = Math.floor(dmg * 0.75)
  return Math.max(0, dmg)
}

/** 敌人攻击单段伤害（力量 + 虚弱） */
function enemyAttackBase(c: Combatant, value: number): number {
  let dmg = value + statusOf(c, 'strength')
  if (statusOf(c, 'weak') > 0) dmg = Math.floor(dmg * 0.75)
  return Math.max(0, dmg)
}

/** 对敌人造成伤害（isAttack：吃易伤 / 触发千面狐镜像反伤） */
function damageEnemy(
  s: BattleState,
  c: Combatant,
  rawDmg: number,
  isAttack: boolean,
  events: BattleEvent[],
): void {
  if (!c.alive || s.phase === 'won' || s.phase === 'lost') return
  let dmg = rawDmg
  if (isAttack && statusOf(c, 'vulnerable') > 0) dmg = Math.floor(dmg * 1.5)
  dmg = Math.max(0, dmg)
  const blocked = Math.min(c.block, dmg)
  c.block -= blocked
  const hpDmg = dmg - blocked
  c.hp = Math.max(0, c.hp - hpDmg)
  events.push({ kind: 'damage', target: c.key, amount: hpDmg, blocked, attack: isAttack })
  // 千面狐镜像反伤：反弹一半（至少 1）
  if (isAttack && c.mirrored && hpDmg > 0) {
    const reflect = Math.max(1, Math.floor(hpDmg / 2))
    dealDamageToPlayer(s, reflect, false, true, events)
    events.push({ kind: 'relic', relicId: 'mirror', text: '镜像反伤！' })
  }
  if (c.hp <= 0) killEnemy(s, c, events)
}

/** 对玩家造成伤害。pierce=true 时无视格挡（中毒/灼烧/自损）。 */
function dealDamageToPlayer(
  s: BattleState,
  rawDmg: number,
  isAttack: boolean,
  pierce: boolean,
  events: BattleEvent[],
): void {
  if (s.phase === 'won' || s.phase === 'lost') return
  if (isAttack && s.counters.invulnerable) {
    events.push({ kind: 'damage', target: 'player', amount: 0, blocked: rawDmg, attack: true })
    return
  }
  let dmg = rawDmg
  if (isAttack && statusOf(s.player, 'vulnerable') > 0) dmg = Math.floor(dmg * 1.5)
  // 护心镜：每场战斗第一次受击伤害减半
  if (isAttack && dmg > 0 && !s.counters.firstHitHalvedUsed && s.relics.includes('heart-mirror')) {
    dmg = Math.floor(dmg / 2)
    s.counters.firstHitHalvedUsed = true
    events.push({ kind: 'relic', relicId: 'heart-mirror', text: '护心镜：受击伤害减半' })
  }
  dmg = Math.max(0, dmg)
  let blocked = 0
  if (!pierce) {
    blocked = Math.min(s.player.block, dmg)
    s.player.block -= blocked
  }
  const hpDmg = dmg - blocked
  s.player.hp = Math.max(0, s.player.hp - hpDmg)
  events.push({ kind: 'damage', target: 'player', amount: hpDmg, blocked, attack: isAttack })
  if (s.player.hp <= 0) handlePlayerDeath(s, events)
}

function handlePlayerDeath(s: BattleState, events: BattleEvent[]): void {
  // 替身纸人：每场战斗免死一次（Boss 战禁用）
  if (s.relics.includes('paper-doll') && !s.counters.paperDollUsed && s.nodeType !== 'boss') {
    s.counters.paperDollUsed = true
    s.player.hp = 1
    events.push({ kind: 'deathSave', text: '替身纸人碎裂——你以 1 点生命活了下来' })
    return
  }
  s.phase = 'lost'
  events.push({ kind: 'lose' })
}

function killEnemy(s: BattleState, c: Combatant, events: BattleEvent[]): void {
  if (!c.alive) return
  c.alive = false
  c.hp = 0
  c.block = 0
  s.kills += 1
  events.push({ kind: 'death', enemy: c.key })
  if (s.enemies.every((e) => !e.alive)) {
    s.phase = 'won'
    events.push({ kind: 'win' })
  }
}

function gainBlock(
  s: BattleState,
  target: 'player' | Combatant,
  value: number,
  events: BattleEvent[],
): void {
  const holder = target === 'player' ? s.player : target
  const amount = Math.max(0, value + statusOf(holder, 'dexterity'))
  holder.block += amount
  events.push({ kind: 'block', target: target === 'player' ? 'player' : target.key, amount })
}

function healPlayer(s: BattleState, value: number, events: BattleEvent[]): void {
  const before = s.player.hp
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + value)
  const healed = s.player.hp - before
  if (healed > 0) events.push({ kind: 'heal', amount: healed })
}

// ============================================================ 抽牌 / 牌堆

function drawCards(s: BattleState, n: number, events: BattleEvent[]): void {
  let drawn = 0
  for (let i = 0; i < n; i++) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) break
      s.drawPile = shuffle(s, s.discardPile)
      s.discardPile = []
      events.push({ kind: 'shuffle' })
    }
    const card = s.drawPile.pop()
    if (!card) break
    s.hand.push(card)
    drawn += 1
  }
  if (drawn > 0) events.push({ kind: 'draw', count: drawn })
}

// ============================================================ 意图 AI

function moveTable(c: Combatant): EnemyMove[] {
  return c.phaseTwoActive && c.def.phaseTwo ? c.def.phaseTwo.moves : c.def.moves
}

function rollIntent(s: BattleState, c: Combatant): void {
  if (!c.alive) return
  const table = moveTable(c)
  let mv: EnemyMove
  if (c.def.pattern === 'cycle') {
    mv = table[c.moveCursor % table.length]
    c.moveCursor += 1
  } else {
    // weighted：同一招不连续 3 次
    const [a, b] = c.recentMoves
    let pool = table
    if (a !== undefined && a === b) {
      const filtered = table.filter((m) => m.label !== a)
      if (filtered.length > 0) pool = filtered
    }
    mv = weightedPick(s, pool, (m) => m.weight)
    c.recentMoves.push(mv.label)
    if (c.recentMoves.length > 2) c.recentMoves.shift()
  }
  c.intent = mv
}

/** 意图徽章显示数据 */
export function getIntentDisplay(s: BattleState, c: Combatant): IntentDisplay {
  const mv = c.intent
  if (!mv || !c.alive) return { icon: 'unknown', label: '?' }
  const detailOn = c.def.tier !== 'elite' || s.relics.includes('beacon-tower')
  switch (mv.kind) {
    case 'attack':
    case 'attackMulti': {
      let perHit = enemyAttackBase(c, mv.value)
      if (statusOf(s.player, 'vulnerable') > 0) perHit = Math.floor(perHit * 1.5)
      perHit = Math.max(0, perHit)
      const times = mv.kind === 'attackMulti' ? (mv.times ?? 1) : 1
      return {
        icon: 'attack',
        label: mv.label,
        damage: perHit,
        times,
        detail: detailOn
          ? `${mv.label}：攻击 ${perHit}${times > 1 ? ` × ${times}` : ''}${mv.status ? `，并施加${mv.status === 'poison' ? '中毒' : mv.status === 'burn' ? '灼烧' : '虚弱'} ${mv.statusValue ?? 0} 层` : ''}`
          : mv.label,
      }
    }
    case 'block':
      return { icon: 'block', label: mv.label, value: mv.value, detail: detailOn ? `${mv.label}：格挡 ${mv.value}` : mv.label }
    case 'buff':
      return { icon: 'buff', label: mv.label, detail: detailOn ? `${mv.label}：力量 +${mv.statusValue ?? 0}` : mv.label }
    case 'debuff':
      return {
        icon: 'debuff',
        label: mv.label,
        detail: detailOn
          ? `${mv.label}：施加${mv.status === 'weak' ? '虚弱' : '易伤'} ${mv.statusValue ?? 0} 层`
          : mv.label,
      }
    case 'summon':
      return { icon: 'unknown', label: mv.label, detail: detailOn ? `${mv.label}：召唤援军` : mv.label }
  }
}

// ============================================================ 出牌

export function resolveCard(inst: CardInstance): { def: CardDef; cost: number; effects: CardDef['effects']; desc: string } {
  const def = getCard(inst.id)
  if (inst.upgraded) {
    return { def, cost: def.upgraded.cost ?? def.cost, effects: def.upgraded.effects, desc: def.upgraded.desc }
  }
  return { def, cost: def.cost, effects: def.effects, desc: def.desc }
}

/** 残卷：每回合第一张技能牌费用 -1（最低 0） */
export function cardCost(s: BattleState, inst: CardInstance): number {
  const { def, cost } = resolveCard(inst)
  let c = cost
  if (
    def.type === 'skill' &&
    s.relics.includes('fragment-scroll') &&
    s.counters.skillsPlayedThisTurn === 0
  ) {
    c = Math.max(0, c - 1)
  }
  return c
}

export function canPlayCard(s: BattleState, uid: number): { ok: boolean; reason?: string } {
  if (s.phase !== 'player') return { ok: false, reason: '非玩家回合' }
  const inst = s.hand.find((c) => c.uid === uid)
  if (!inst) return { ok: false, reason: '手牌不存在' }
  if (inst.id === 'yezhai') return { ok: false, reason: '诅咒牌无法打出' }
  if (cardCost(s, inst) > s.player.energy) return { ok: false, reason: '能量不足' }
  return { ok: true }
}

export function cardNeedsTarget(s: BattleState, uid: number): boolean {
  const inst = s.hand.find((c) => c.uid === uid)
  if (!inst) return false
  return getCard(inst.id).target === 'enemy'
}

export function playCard(s: BattleState, uid: number, targetKey?: string): BattleEvent[] {
  const check = canPlayCard(s, uid)
  if (!check.ok) throw new Error(`cannot play card ${uid}: ${check.reason}`)
  const events: BattleEvent[] = []
  const handIdx = s.hand.findIndex((c) => c.uid === uid)
  const inst = s.hand[handIdx]
  const { def, effects } = resolveCard(inst)

  if (def.target === 'enemy' && !s.enemies.some((e) => e.alive && e.key === targetKey)) {
    throw new Error(`card ${def.id} requires a living enemy target`)
  }

  // 支付费用、移出手牌
  s.player.energy -= cardCost(s, inst)
  s.hand.splice(handIdx, 1)
  s.counters.playedThisTurn += 1
  if (def.type === 'skill') s.counters.skillsPlayedThisTurn += 1
  events.push({ kind: 'play', uid, cardId: def.id, targetKey })

  // 连环计：下一张攻击牌结算两次
  let times = 1
  if (def.type === 'attack' && s.counters.doubleNextAttack > 0) {
    times = 2
    s.counters.doubleNextAttack -= 1
  }

  for (let r = 0; r < times; r++) {
    for (const eff of effects) {
      resolveEffect(s, def, eff, targetKey, events)
      if (s.phase === 'won' || s.phase === 'lost') break
    }
    if (s.phase === 'won' || s.phase === 'lost') break
  }

  // 能力牌常驻；消耗牌入消耗堆；其余入弃牌堆
  if (def.type === 'power') {
    s.powers.push(def.id)
  } else if (def.exhaust) {
    s.exhaustPile.push(inst)
    events.push({ kind: 'exhaust', uid })
  } else {
    s.discardPile.push(inst)
  }

  // 算盘：每打出 3 张牌抽 1
  if (s.relics.includes('abacus') && s.counters.playedThisTurn % 3 === 0) {
    events.push({ kind: 'relic', relicId: 'abacus', text: '算盘：打出 3 张牌，抽 1 张' })
    drawCards(s, 1, events)
  }

  return events
}

/** 目标敌人（缺省取第一个存活敌人，供 allEnemies/随机用） */
function findTarget(s: BattleState, targetKey?: string): Combatant | undefined {
  if (targetKey) {
    const t = s.enemies.find((e) => e.key === targetKey && e.alive)
    if (t) return t
  }
  return s.enemies.find((e) => e.alive)
}

/** 敌人当前攻击总值（借刀杀人 / 李代桃僵用）：意图为攻击时含段数，否则取其最强攻击招 */
export function enemyAttackTotal(c: Combatant): number {
  const mv = c.intent
  if (mv && (mv.kind === 'attack' || mv.kind === 'attackMulti')) {
    const perHit = enemyAttackBase(c, mv.value)
    return perHit * (mv.kind === 'attackMulti' ? (mv.times ?? 1) : 1)
  }
  let best = 0
  for (const m of moveTable(c)) {
    if (m.kind === 'attack' || m.kind === 'attackMulti') {
      best = Math.max(best, enemyAttackBase(c, m.value) * (m.kind === 'attackMulti' ? (m.times ?? 1) : 1))
    }
  }
  return best
}

function resolveEffect(
  s: BattleState,
  def: CardDef,
  eff: CardDef['effects'][number],
  targetKey: string | undefined,
  events: BattleEvent[],
): void {
  switch (eff.kind) {
    case 'damage': {
      const target = findTarget(s, targetKey)
      if (!target) return
      let base: number
      if (def.id === 'jieli') {
        // 借力打力：打 = 自身格挡值（仍吃力量/朱砂印等攻击修正）
        base = playerAttackBase(s, s.player.block)
      } else if (def.id === 'jiedao') {
        // 借刀杀人：敌以其自身攻击值的 N% 攻击自己（吃目标易伤，不吃玩家力量）
        base = Math.max(1, Math.floor((enemyAttackTotal(target) * eff.value) / 100))
      } else {
        base = playerAttackBase(s, eff.value)
      }
      const hits = eff.times ?? 1
      for (let i = 0; i < hits; i++) {
        if (!target.alive) break
        damageEnemy(s, target, base, true, events)
      }
      return
    }
    case 'damageAll': {
      const base = playerAttackBase(s, eff.value)
      for (const c of s.enemies) {
        if (c.alive) damageEnemy(s, c, base, true, events)
      }
      return
    }
    case 'randomMultiDamage': {
      const hits = eff.times ?? 1
      for (let i = 0; i < hits; i++) {
        const alive = s.enemies.filter((e) => e.alive)
        if (alive.length === 0) return
        const target = alive[Math.floor(nextRandom(s) * alive.length)]
        damageEnemy(s, target, playerAttackBase(s, eff.value), true, events)
      }
      return
    }
    case 'block': {
      let value = eff.value
      if (def.id === 'lidaitaojiang') {
        // 李代桃僵：挡 = 敌下回合攻击值
        const target = findTarget(s, targetKey)
        value = target ? enemyAttackTotal(target) : 0
      }
      gainBlock(s, 'player', value, events)
      return
    }
    case 'blockNextTurn':
      s.counters.blockNextTurn += eff.value
      events.push({ kind: 'block', target: 'player', amount: 0 })
      return
    case 'draw':
      drawCards(s, eff.value, events)
      return
    case 'gainEnergy':
      s.player.energy += eff.value
      events.push({ kind: 'energy', amount: eff.value })
      return
    case 'applyStatus': {
      if (!eff.status) return
      if (def.target === 'enemy') {
        const target = findTarget(s, targetKey)
        if (target) addStatus(s, target, eff.status, eff.value, events)
      } else if (def.target === 'allEnemies') {
        for (const c of s.enemies) if (c.alive) addStatus(s, c, eff.status, eff.value, events)
      } else {
        addStatus(s, 'player', eff.status, eff.value, events)
      }
      return
    }
    case 'heal':
      healPlayer(s, eff.value, events)
      return
    case 'selfDamage':
      dealDamageToPlayer(s, eff.value, false, true, events)
      return
    case 'reduceEnemyStrength': {
      const target = findTarget(s, targetKey)
      if (!target) return
      addStatus(s, target, 'strength', -eff.value, events)
      target.pendingStrengthRestore += eff.value
      return
    }
    case 'invulnerable':
      s.counters.invulnerable = true
      events.push({ kind: 'relic', relicId: 'kongcheng', text: '空城计：本回合无敌' })
      return
    case 'doubleNextAttack':
      s.counters.doubleNextAttack += 1
      events.push({ kind: 'relic', relicId: 'lianhuanji', text: '连环计：下一张攻击牌结算两次' })
      return
    case 'discardHandDraw': {
      const n = s.hand.length
      while (s.hand.length > 0) s.discardPile.push(s.hand.pop()!)
      drawCards(s, n, events)
      return
    }
    case 'executeThreshold': {
      const target = findTarget(s, targetKey)
      if (!target) return
      if (target.hp < target.maxHp / 2) {
        damageEnemy(s, target, playerAttackBase(s, eff.value), true, events)
      }
      return
    }
  }
}

// ============================================================ 药水

export function applyPotion(s: BattleState, potionId: string, targetKey?: string): BattleEvent[] {
  if (s.phase !== 'player') throw new Error('非玩家回合，无法使用药水')
  const idx = s.potions.indexOf(potionId)
  if (idx < 0) throw new Error(`potion not held: ${potionId}`)
  if (potionNeedsTarget(potionId) && !s.enemies.some((e) => e.alive && e.key === targetKey)) {
    throw new Error(`potion ${potionId} requires a living enemy target`)
  }
  const events: BattleEvent[] = []
  s.potions.splice(idx, 1)
  events.push({ kind: 'potion', potionId, targetKey })
  const def = getPotion(potionId)
  for (const eff of def.effects) {
    switch (eff.kind) {
      case 'heal':
        healPlayer(s, eff.value, events)
        break
      case 'block':
        gainBlock(s, 'player', eff.value, events)
        break
      case 'draw':
        drawCards(s, eff.value, events)
        break
      case 'gainEnergy':
        s.player.energy += eff.value
        events.push({ kind: 'energy', amount: eff.value })
        break
      case 'applyStatus': {
        if (!eff.status) break
        if (eff.status === 'strength' || eff.status === 'dexterity') {
          addStatus(s, 'player', eff.status, eff.value, events)
        } else {
          const target = findTarget(s, targetKey)
          if (target) addStatus(s, target, eff.status, eff.value, events)
        }
        break
      }
      default:
        break
    }
  }
  return events
}

// ============================================================ 回合流程

/** 玩家回合开始：清格挡 → 回响盾 → 能量回满 → 中毒 → 能力牌 → 燃香 → 抽牌 */
export function startPlayerTurn(s: BattleState): BattleEvent[] {
  const events: BattleEvent[] = []
  if (s.phase === 'won' || s.phase === 'lost') return events
  s.turn += 1
  s.phase = 'player'
  events.push({ kind: 'turn', turn: s.turn })

  s.player.block = 0
  if (s.counters.blockNextTurn > 0) {
    gainBlock(s, 'player', s.counters.blockNextTurn, events)
    s.counters.blockNextTurn = 0
  }
  s.counters.invulnerable = false
  s.counters.playedThisTurn = 0
  s.counters.skillsPlayedThisTurn = 0

  // 能量回满（日晷残片：首回合 +1）
  s.player.energy = s.player.maxEnergy + (s.counters.firstTurn && s.relics.includes('sundial-shard') ? 1 : 0)
  events.push({ kind: 'energy', amount: s.player.energy })

  // 中毒：回合开始受 N 伤，层数 -1
  const poison = statusOf(s.player, 'poison')
  if (poison > 0) {
    dealDamageToPlayer(s, poison, false, true, events)
    addStatus(s, 'player', 'poison', -1, events)
    if (ph(s) === 'lost') return events
  }

  // 能力牌
  for (const p of s.powers) {
    if (p === 'zhanyi') addStatus(s, 'player', 'strength', 1, events)
    else if (p === 'guixi') gainBlock(s, 'player', 4, events)
  }

  // 燃香：回合开始灼烧全体敌 1 层
  if (s.relics.includes('incense')) {
    for (const c of s.enemies) {
      if (c.alive) addStatus(s, c, 'burn', 1, events)
    }
  }

  // 抽牌（青铜铃首回合 +2，星盘 +1）
  let drawCount = DRAW_PER_TURN
  if (s.counters.firstTurn && s.relics.includes('bronze-bell')) drawCount += 2
  if (s.powers.includes('xingpan')) drawCount += 1
  drawCards(s, drawCount, events)

  s.counters.firstTurn = false
  return events
}

/**
 * 结束回合 → 敌人按意图逐个行动（分步返回供 UI 演出）。
 * 步骤：A 玩家回合末（灼烧/弃手牌/清镜像）→ B_i 每个存活敌人一整个行动 → C 终检。
 */
export function endPlayerTurn(s: BattleState): Step[] {
  const steps: Step[] = []
  if (s.phase !== 'player') return steps
  s.phase = 'enemy'
  const snap = (events: BattleEvent[]): Step => ({ state: structuredClone(s), events })

  // ---- Step A：玩家回合末 ----
  {
    const events: BattleEvent[] = [{ kind: 'endTurn' }]
    const burn = statusOf(s.player, 'burn')
    if (burn > 0) {
      dealDamageToPlayer(s, 2, false, true, events)
      addStatus(s, 'player', 'burn', -1, events)
    }
    decayTimedStatuses(s.player)
    // 千面狐镜像反伤只持续一个玩家回合
    for (const c of s.enemies) c.mirrored = false
    while (s.hand.length > 0) s.discardPile.push(s.hand.pop()!)
    steps.push(snap(events))
    if (ph(s) === 'lost') return steps
  }

  // ---- Step B：敌人逐个行动 ----
  for (const c of s.enemies) {
    if (!c.alive) continue
    const events: BattleEvent[] = []

    // 自身回合开始：清空格挡（格挡回合末清空的等价实现）
    c.block = 0
    // 中毒
    const poison = statusOf(c, 'poison')
    if (poison > 0) {
      c.hp = Math.max(0, c.hp - poison)
      events.push({ kind: 'damage', target: c.key, amount: poison, blocked: 0, attack: false })
      addStatus(s, c, 'poison', -1, events)
      if (c.hp <= 0) {
        killEnemy(s, c, events)
        steps.push(snap(events))
        if (ph(s) === 'won') return steps
        continue
      }
    }
    // 釜底抽薪：力量归还
    if (c.pendingStrengthRestore !== 0) {
      addStatus(s, c, 'strength', c.pendingStrengthRestore, events)
      c.pendingStrengthRestore = 0
    }
    // Boss 半血转阶段（千面狐 threshold=0，不走 HP 触发）
    if (
      c.def.tier === 'boss' &&
      c.def.phaseTwo &&
      c.def.phaseTwo.threshold > 0 &&
      !c.phaseTwoActive &&
      c.hp <= c.maxHp * c.def.phaseTwo.threshold
    ) {
      c.phaseTwoActive = true
      c.moveCursor = 0
      c.recentMoves = []
      events.push({ kind: 'phase', enemy: c.key, quote: c.def.phaseTwo.quote })
      rollIntent(s, c)
      // 转阶段当回合不行动（演出回合）
      steps.push(snap(events))
      continue
    }

    // 执行意图
    const mv = c.intent
    if (mv) {
      events.push({ kind: 'enemyAction', enemy: c.key, label: mv.label, moveKind: mv.kind })
      executeEnemyMove(s, c, mv, events)
      c.turnsTaken += 1
      if (ph(s) === 'lost') {
        steps.push(snap(events))
        return steps
      }
    }

    // 千面狐：每 3 回合换面 + 镜像反伤 1 回合
    if (c.alive && c.def.id === 'qianmian' && c.def.phaseTwo && c.turnsTaken % 3 === 0) {
      c.phaseTwoActive = !c.phaseTwoActive
      c.mirrored = true
      c.recentMoves = []
      events.push({ kind: 'phase', enemy: c.key, quote: c.def.phaseTwo.quote })
    }

    // 自身回合末：灼烧、易伤/虚弱衰减
    if (c.alive) {
      const burn = statusOf(c, 'burn')
      if (burn > 0) {
        c.hp = Math.max(0, c.hp - 2)
        events.push({ kind: 'damage', target: c.key, amount: 2, blocked: 0, attack: false })
        addStatus(s, c, 'burn', -1, events)
        if (c.hp <= 0) killEnemy(s, c, events)
      }
      if (c.alive) {
        decayTimedStatuses(c)
        rollIntent(s, c)
      }
    }
    steps.push(snap(events))
    if (ph(s) === 'won') return steps
  }

  // ---- Step C：终检（全部灼烧/中毒结算后可能胜利） ----
  if (s.enemies.every((e) => !e.alive) && ph(s) !== 'won') {
    s.phase = 'won'
    steps.push({ state: structuredClone(s), events: [{ kind: 'win' }] })
  }
  return steps
}

function executeEnemyMove(s: BattleState, c: Combatant, mv: EnemyMove, events: BattleEvent[]): void {
  switch (mv.kind) {
    case 'attack': {
      const dmg = enemyAttackBase(c, mv.value)
      dealDamageToPlayer(s, dmg, true, false, events)
      if (mv.status && ph(s) !== 'lost') {
        if (mv.status === 'poison' || mv.status === 'burn' || mv.status === 'weak' || mv.status === 'vulnerable') {
          addStatus(s, 'player', mv.status, mv.statusValue ?? 1, events)
        }
      }
      return
    }
    case 'attackMulti': {
      const hits = mv.times ?? 1
      for (let i = 0; i < hits; i++) {
        if (ph(s) === 'lost') return
        dealDamageToPlayer(s, enemyAttackBase(c, mv.value), true, false, events)
      }
      return
    }
    case 'block':
      gainBlock(s, c, mv.value, events)
      return
    case 'buff':
      addStatus(s, c, mv.status ?? 'strength', mv.statusValue ?? mv.value, events)
      return
    case 'debuff':
      if (mv.status) addStatus(s, 'player', mv.status, mv.statusValue ?? 1, events)
      return
    case 'summon': {
      // 梼杌：召唤小伥鬼（场上存活敌人不超过 3）
      const aliveCount = s.enemies.filter((e) => e.alive).length
      const room = MAX_ENEMIES - aliveCount
      const count = Math.min(mv.value, room)
      for (let i = 0; i < count; i++) {
        const minion = spawnEnemy(s, mv.summonId ?? 'xiaochang', true)
        rollIntent(s, minion)
        s.enemies.push(minion)
        events.push({ kind: 'summon', enemy: minion.key, name: minion.def.name })
      }
      if (count <= 0) {
        // 满场则改为自我强化
        addStatus(s, c, 'strength', 2, events)
      }
      return
    }
  }
}

// ============================================================ 查询辅助

export function aliveEnemies(s: BattleState): Combatant[] {
  return s.enemies.filter((e) => e.alive)
}

/** 牌数守恒校验（冒烟脚本用）：四堆 + 能力牌 = 初始牌组 - 本场消耗之外的恒等式 */
export function pileTotals(s: BattleState): { piles: number; powers: number; total: number } {
  const piles = s.drawPile.length + s.hand.length + s.discardPile.length + s.exhaustPile.length
  return { piles, powers: s.powers.length, total: piles + s.powers.length }
}

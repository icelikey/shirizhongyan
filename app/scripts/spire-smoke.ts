/**
 * 碎境爬塔 · 引擎冒烟（esbuild 打包后由 node 运行，见 scripts/run-spire-smoke.mjs）
 * - 20 局全随机 AI 模拟：无死循环（回合数封顶）、牌数守恒、HP/能量边界。
 * - 定向断言：伤害 / 格挡 / 易伤 / 虚弱 / 中毒 / 灼烧 / 消耗堆 / 升级 / weighted 不三连。
 */
import { getCard, STARTER_DECKS } from '@/data/spire/cards'
import { STARTER_RELICS, RELICS } from '@/data/spire/relics'
import { POTIONS, potionNeedsTarget } from '@/data/spire/potions'
import type { DeckStyle } from '@/data/spire/types'
import {
  aliveEnemies,
  canPlayCard,
  cardNeedsTarget,
  createBattle,
  endPlayerTurn,
  pileTotals,
  playCard,
  startPlayerTurn,
  applyPotion,
} from '@/engine/spire/engine'
import { rngFromSeed } from '@/engine/spire/rng'
import type { BattleState } from '@/engine/spire/types'

let failures = 0
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failures += 1
    console.error(`  ✗ ASSERT: ${msg}`)
  }
}

// ============================================================ 定向断言

function targetedChecks(): void {
  console.log('— 定向断言 —')

  // 伤害 / 格挡 / 能量 / 抽牌
  {
    const s = createBattle({
      enemyIds: ['zhiren'], deck: STARTER_DECKS.blade, relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 42,
    })
    startPlayerTurn(s)
    assert(s.turn === 1, '回合数=1')
    assert(s.player.energy === 3, `基础能量 3（得 ${s.player.energy}）`)
    assert(s.hand.length === 5, `抽 5 张（得 ${s.hand.length}）`)
    assert(pileTotals(s).total === 10, '牌数守恒 10')
    const enemyHpBefore = s.enemies[0].hp
    const atk = s.hand.find((c) => c.id === 'moye')
    if (atk) {
      playCard(s, atk.uid, s.enemies[0].key)
      assert(enemyHpBefore - s.enemies[0].hp >= 6, `墨刃至少打 6（实际 ${enemyHpBefore - s.enemies[0].hp}）`)
      assert(s.player.energy === 2, `打出 1 费后能量 2（得 ${s.player.energy}）`)
    }
    const def = s.hand.find((c) => c.id === 'jinzhong')
    if (def) {
      playCard(s, def.uid)
      assert(s.player.block >= 5, `金钟罩挡 5（得 ${s.player.block}）`)
    }
    // 结束回合 → 敌人行动 → 下回合开始格挡清空
    endPlayerTurn(s)
    startPlayerTurn(s)
    assert(s.player.block === 0, `格挡回合末清空（得 ${s.player.block}）`)
    assert(s.player.energy === 3, '新回合能量回满')
  }

  // 日晷残片 + 青铜铃 + 龟甲（首回合）
  {
    const s = createBattle({
      enemyIds: ['zhiren'], deck: STARTER_DECKS.trick, relics: ['sundial-shard', 'bronze-bell', 'tortoise-shell'],
      potions: [], hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 7,
    })
    startPlayerTurn(s)
    assert(s.player.energy === 4, `日晷首回合能量 4（得 ${s.player.energy}）`)
    assert(s.hand.length === 7, `青铜铃首回合抽 7（得 ${s.hand.length}）`)
    assert(s.player.block === 8, `龟甲开战格挡 8（得 ${s.player.block}）`)
    endPlayerTurn(s)
    startPlayerTurn(s)
    assert(s.player.energy === 3, `第二回合能量回 3（得 ${s.player.energy}）`)
    assert(s.player.block === 0, `第二回合龟甲格挡清空（得 ${s.player.block}）`)
  }

  // 易伤 +50% / 虚弱 -25%
  {
    const s = createBattle({
      enemyIds: ['zhiren'], deck: ['moye'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 1,
    })
    startPlayerTurn(s)
    const e = s.enemies[0]
    e.statuses.vulnerable = 2
    const hp0 = e.hp
    playCard(s, s.hand[0].uid, e.key)
    assert(hp0 - e.hp === 9, `易伤：6×1.5=9（实际 ${hp0 - e.hp}）`)

    const s2 = createBattle({
      enemyIds: ['zhiren'], deck: ['moye'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 1,
    })
    startPlayerTurn(s2)
    s2.player.statuses.weak = 1
    const hp1 = s2.enemies[0].hp
    playCard(s2, s2.hand[0].uid, s2.enemies[0].key)
    assert(hp1 - s2.enemies[0].hp === 4, `虚弱：⌊6×0.75⌋=4（实际 ${hp1 - s2.enemies[0].hp}）`)
  }

  // 中毒（敌方回合开始） / 灼烧（敌方回合末）
  {
    const s = createBattle({
      enemyIds: ['dashou'], deck: ['jinzhong'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 3,
    })
    startPlayerTurn(s)
    const e = s.enemies[0]
    e.statuses.poison = 3
    e.statuses.burn = 1
    const hp0 = e.hp
    endPlayerTurn(s)
    assert(e.hp === hp0 - 3 - 2 || !e.alive, `毒 3 + 灼 2（实际掉 ${hp0 - e.hp}）`)
    assert((e.statuses.poison ?? 0) === 2, `中毒层数 -1 → 2（得 ${e.statuses.poison}）`)
    assert(e.statuses.burn === undefined, `灼烧层数 -1 → 移除（得 ${e.statuses.burn}）`)
  }

  // 消耗堆（空城计）与无敌
  {
    const s = createBattle({
      enemyIds: ['dashou'], deck: ['kongcheng', 'moye'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 5,
    })
    startPlayerTurn(s)
    const kc = s.hand.find((c) => c.id === 'kongcheng')!
    playCard(s, kc.uid)
    assert(s.exhaustPile.length === 1, '空城计入消耗堆')
    assert(s.counters.invulnerable, '空城计无敌生效')
    const hp0 = s.player.hp
    endPlayerTurn(s) // dashou 攻击被无敌挡
    assert(s.player.hp === hp0, `无敌挡下全部伤害（掉 ${hp0 - s.player.hp}）`)
    startPlayerTurn(s)
    assert(!s.counters.invulnerable, '无敌在新回合清除')
  }

  // 升级版（+moye 打 9）
  {
    const s = createBattle({
      enemyIds: ['zhiren'], deck: ['+moye'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 9,
    })
    startPlayerTurn(s)
    const hp0 = s.enemies[0].hp
    playCard(s, s.hand[0].uid, s.enemies[0].key)
    assert(hp0 - s.enemies[0].hp === 9, `升级墨刃打 9（实际 ${hp0 - s.enemies[0].hp}）`)
  }

  // 朱砂印 +2 / 借力打力 / 终结式处决线
  {
    const s = createBattle({
      enemyIds: ['aoshou'], deck: ['moye'], relics: ['cinnabar-seal'], potions: [],
      hp: 72, maxHp: 72, nodeType: 'elite', floor: 2, seed: 11,
    })
    startPlayerTurn(s)
    const hp0 = s.enemies[0].hp
    playCard(s, s.hand[0].uid, s.enemies[0].key)
    assert(hp0 - s.enemies[0].hp === 8, `朱砂印：6+2=8（实际 ${hp0 - s.enemies[0].hp}）`)

    const s2 = createBattle({
      enemyIds: ['zhiren'], deck: ['jieli', 'jinzhong'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 13,
    })
    startPlayerTurn(s2)
    playCard(s2, s2.hand.find((c) => c.id === 'jinzhong')!.uid)
    const before = s2.enemies[0].hp
    playCard(s2, s2.hand.find((c) => c.id === 'jieli')!.uid, s2.enemies[0].key)
    assert(before - s2.enemies[0].hp >= 5, `借力打力 ≥ 格挡 5（实际 ${before - s2.enemies[0].hp}）`)

    const s3 = createBattle({
      enemyIds: ['aoshou'], deck: ['zhongjie'], relics: [], potions: [],
      hp: 72, maxHp: 72, nodeType: 'elite', floor: 2, seed: 15,
    })
    startPlayerTurn(s3)
    const boss = s3.enemies[0]
    boss.hp = Math.floor(boss.maxHp / 2) - 1 // 低于 50%
    const hb = boss.hp
    playCard(s3, s3.hand[0].uid, boss.key)
    assert(hb - boss.hp === 18, `终结式处决：10+8=18（实际 ${hb - boss.hp}）`)
  }

  // 梼杌召唤（上限 3）
  {
    const s = createBattle({
      enemyIds: ['taowu'], deck: ['jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong'], relics: [],
      potions: [], hp: 72, maxHp: 72, nodeType: 'boss', floor: 1, seed: 21,
    })
    startPlayerTurn(s)
    // taowu cycle: attack12 → summon → 8×2；两轮后应有召唤物
    endPlayerTurn(s)
    startPlayerTurn(s)
    endPlayerTurn(s)
    assert(s.enemies.some((e) => e.summoned), '梼杌召唤小伥鬼')
    assert(s.enemies.filter((e) => e.alive).length <= 3, '场上敌人 ≤ 3')
  }

  // weighted 不连续 3 次：shanxiao 长局采样意图序列
  {
    const s = createBattle({
      enemyIds: ['shanxiao'], deck: ['jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong'],
      relics: [], potions: [], hp: 72, maxHp: 72, nodeType: 'battle', floor: 1, seed: 77,
    })
    const seq: string[] = []
    startPlayerTurn(s)
    for (let t = 0; t < 12 && s.phase !== 'lost' && s.enemies[0].alive; t++) {
      if (s.enemies[0].intent) seq.push(s.enemies[0].intent.label)
      for (const c of [...s.hand]) {
        if (canPlayCard(s, c.uid).ok) playCard(s, c.uid)
      }
      s.player.hp = s.player.maxHp // 测试续命
      endPlayerTurn(s)
      if (s.phase === 'lost') break
      startPlayerTurn(s)
    }
    let triple = false
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] === seq[i - 1] && seq[i - 1] === seq[i - 2]) triple = true
    }
    assert(!triple, `weighted 同一招不连续 3 次（序列 ${seq.join(',')}）`)
  }
}

// ============================================================ 随机 AI 模拟

const SCENARIOS: { enemyIds: string[]; nodeType: 'battle' | 'elite' | 'boss'; floor: number }[] = [
  { enemyIds: ['zhiren'], nodeType: 'battle', floor: 1 },
  { enemyIds: ['dashou', 'daoshu'], nodeType: 'battle', floor: 1 },
  { enemyIds: ['shanxiao'], nodeType: 'battle', floor: 1 },
  { enemyIds: ['youhun', 'zhuyao'], nodeType: 'battle', floor: 2 },
  { enemyIds: ['kuilei', 'shadao', 'daoshu'], nodeType: 'battle', floor: 2 },
  { enemyIds: ['panguan'], nodeType: 'elite', floor: 1 },
  { enemyIds: ['cike'], nodeType: 'elite', floor: 2 },
  { enemyIds: ['aoshou'], nodeType: 'elite', floor: 3 },
  { enemyIds: ['taowu'], nodeType: 'boss', floor: 1 },
  { enemyIds: ['qianmian'], nodeType: 'boss', floor: 2 },
  { enemyIds: ['zhongyan'], nodeType: 'boss', floor: 3 },
]

const CARD_POOL = [
  'moye', 'lianhuan', 'pojia', 'jieli', 'xueji', 'zhongjie', 'luanpifeng', 'xuanfeng',
  'jinzhong', 'tiebu', 'shouwei', 'panshi', 'huixiang', 'yufeng',
  'guanxing', 'xipai', 'jiedao', 'lianhuanji', 'fudi', 'duji', 'huogong', 'kongcheng',
  'zouweishang', 'lidaitaojiang', 'zhisang', 'andu', 'fanjian',
  'zhanyi', 'guixi', 'xingpan', 'yezhai',
]

function simulate(gameIdx: number): { result: string; turns: number; hpLeft: number } {
  const rand = rngFromSeed(gameIdx * 7919 + 17)
  const styles: DeckStyle[] = ['blade', 'bulwark', 'trick']
  const style = styles[Math.floor(rand() * 3)]
  const scenario = SCENARIOS[gameIdx % SCENARIOS.length]
  // 随机额外遗物 0–3 / 药水 0–3
  const relicIds = [STARTER_RELICS[style]]
  const relicPool = RELICS.map((r) => r.id).filter((id) => !relicIds.includes(id))
  const extraRelics = Math.floor(rand() * 4)
  for (let i = 0; i < extraRelics; i++) {
    const id = relicPool[Math.floor(rand() * relicPool.length)]
    if (!relicIds.includes(id)) relicIds.push(id)
  }
  const potionIds: string[] = []
  const potionCount = Math.floor(rand() * 4)
  for (let i = 0; i < potionCount; i++) potionIds.push(POTIONS[Math.floor(rand() * POTIONS.length)].id)
  // 牌组：起始牌 + 随机 0–6 张（含升级与诅咒）
  const deck = [...STARTER_DECKS[style]]
  const extraCards = Math.floor(rand() * 7)
  for (let i = 0; i < extraCards; i++) {
    let id = CARD_POOL[Math.floor(rand() * CARD_POOL.length)]
    if (rand() < 0.3 && id !== 'yezhai') id = `+${id}`
    deck.push(id)
  }
  for (const id of deck) getCard(id) // 数据完整性

  const s: BattleState = createBattle({
    enemyIds: scenario.enemyIds,
    deck,
    relics: relicIds,
    potions: potionIds,
    hp: 72,
    maxHp: 72,
    nodeType: scenario.nodeType,
    floor: scenario.floor,
    seed: gameIdx * 131 + 1,
  })

  const deckSize = deck.length
  startPlayerTurn(s)

  let guard = 0
  while (s.phase !== 'won' && s.phase !== 'lost' && guard++ < 200) {
    // 随机出牌
    let actions = 0
    while (s.phase === 'player' && actions++ < 40) {
      // 偶尔用药水
      if (s.potions.length > 0 && rand() < 0.25) {
        const pid = s.potions[Math.floor(rand() * s.potions.length)]
        const target = potionNeedsTarget(pid) ? aliveEnemies(s)[0]?.key : undefined
        if (!potionNeedsTarget(pid) || target) applyPotion(s, pid, target)
        continue
      }
      const playable = s.hand.filter((c) => canPlayCard(s, c.uid).ok)
      if (playable.length === 0) break
      const card = playable[Math.floor(rand() * playable.length)]
      const target = cardNeedsTarget(s, card.uid)
        ? aliveEnemies(s)[Math.floor(rand() * aliveEnemies(s).length)]?.key
        : undefined
      playCard(s, card.uid, target)
    }
    if (s.phase !== 'player') break
    endPlayerTurn(s)
    if (s.phase === 'won' || s.phase === 'lost') break
    startPlayerTurn(s)
  }

  // —— 校验 ——
  assert(guard < 200, `局 ${gameIdx}: 200 回合内分出胜负（无死循环）`)
  assert(s.phase === 'won' || s.phase === 'lost', `局 ${gameIdx}: 战斗有结局（phase=${s.phase}）`)
  assert(s.player.hp >= 0 && s.player.hp <= s.player.maxHp, `局 ${gameIdx}: 玩家 HP 边界（${s.player.hp}）`)
  assert(s.player.energy >= 0, `局 ${gameIdx}: 能量非负（${s.player.energy}）`)
  assert(s.player.block >= 0, `局 ${gameIdx}: 格挡非负（${s.player.block}）`)
  for (const e of s.enemies) {
    assert(e.hp >= 0 && e.hp <= e.maxHp, `局 ${gameIdx}: 敌人 HP 边界（${e.def.id} ${e.hp}）`)
    assert(e.block >= 0, `局 ${gameIdx}: 敌人格挡非负（${e.def.id}）`)
  }
  const piles = pileTotals(s)
  assert(piles.total === deckSize, `局 ${gameIdx}: 牌数守恒 ${piles.total} == ${deckSize}`)
  assert(s.enemies.filter((e) => e.alive).length <= 3, `局 ${gameIdx}: 存活敌人 ≤ 3`)

  return { result: s.phase, turns: s.turn, hpLeft: s.player.hp }
}

// ============================================================ main

console.log('碎境爬塔 · 引擎冒烟开始')
targetedChecks()
console.log('— 20 局随机 AI 模拟 —')
let wins = 0
for (let g = 0; g < 20; g++) {
  const sc = SCENARIOS[g % SCENARIOS.length]
  const r = simulate(g)
  if (r.result === 'won') wins += 1
  console.log(
    `  局 ${String(g).padStart(2)} [${sc.nodeType} ${sc.enemyIds.join('+')}] → ${r.result === 'won' ? '胜' : '负'}，${r.turns} 回合，余 HP ${r.hpLeft}`,
  )
}
console.log(`随机 AI 胜 ${wins}/20（随机 AI 仅供校验）`)
if (failures > 0) {
  console.error(`✗ 冒烟失败：${failures} 处断言未通过`)
  process.exit(1)
}
console.log('✓ 冒烟通过：无死循环，伤害/格挡/状态/消耗/升级/AI 结算正确')

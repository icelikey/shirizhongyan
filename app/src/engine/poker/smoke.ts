/**
 * 丹丘牌楼 · 引擎冒烟脚本（node/tsx 直跑，不经 vite）：
 *   NODE_PATH 无须配置——以相对路径 import，tsx src/engine/poker/smoke.ts
 * 1) 牌型评估器断言（A2345 顺子、皇家同花顺、葫芦优先于两对、四条、同花顺等）
 * 2) 100 局随机爬塔模拟：无死循环、数值边界（HP/压注区间/手牌上限/伤害非负）正确
 */
import { Rng } from '../rng'
import type { DeckCard, DuelState } from './types'
import { buildInitialDeck, cardValue } from './cards'
import { evaluateHand } from './evaluator'
import { actualBetRange, discardCards, initDuel, playCards, HAND_SIZE } from './duel'
import { opponentHp, OPPONENTS } from '../../data/poker/opponents'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}
function card(suit: 'spade' | 'heart' | 'club' | 'diamond', rank: number) {
  return { suit, rank }
}

// ── 1. 评估器断言 ─────────────────────────────
console.log('[1] evaluator assertions')
{
  // A2345 顺子
  const wheel = evaluateHand([card('spade', 14), card('heart', 2), card('club', 3), card('diamond', 4), card('spade', 5)])
  assert(wheel.type === 'straight', `A2345 should be straight, got ${wheel.type}`)
  // 皇家同花顺
  const royal = evaluateHand([card('heart', 10), card('heart', 11), card('heart', 12), card('heart', 13), card('heart', 14)])
  assert(royal.type === 'royalFlush', `10JQKA suited should be royalFlush, got ${royal.type}`)
  assert(royal.chips === 120 && royal.mult === 10, 'royal score 120x10')
  // 同花顺（非皇家）
  const sf = evaluateHand([card('club', 5), card('club', 6), card('club', 7), card('club', 8), card('club', 9)])
  assert(sf.type === 'straightFlush', `5-9 suited should be straightFlush, got ${sf.type}`)
  // 葫芦优先于两对/三条
  const fh = evaluateHand([card('spade', 8), card('heart', 8), card('club', 8), card('diamond', 2), card('spade', 2)])
  assert(fh.type === 'fullHouse', `88822 should be fullHouse, got ${fh.type}`)
  assert(fh.pairValues.length === 1 && fh.pairValues[0] === 2, 'fullHouse pairValues = [2]')
  // 四条优先于两对
  const quads = evaluateHand([card('spade', 9), card('heart', 9), card('club', 9), card('diamond', 9), card('spade', 3)])
  assert(quads.type === 'quads', `9999x should be quads, got ${quads.type}`)
  // 同花 > 顺子（同花顺已覆盖非同花的顺）
  const fl = evaluateHand([card('diamond', 2), card('diamond', 5), card('diamond', 7), card('diamond', 11), card('diamond', 13)])
  assert(fl.type === 'flush', `flush expected, got ${fl.type}`)
  // 两对
  const tp = evaluateHand([card('spade', 4), card('heart', 4), card('club', 7), card('diamond', 7), card('spade', 14)])
  assert(tp.type === 'twoPair' && tp.pairValues.length === 2, 'twoPair with 2 pair values')
  // 三条
  const trips = evaluateHand([card('spade', 6), card('heart', 6), card('club', 6), card('diamond', 10), card('spade', 2)])
  assert(trips.type === 'trips', 'trips')
  // 一对 / 高牌 / 4 张不同花不成顺
  assert(evaluateHand([card('spade', 4), card('heart', 4), card('club', 9)]).type === 'pair', 'pair 3 cards')
  assert(evaluateHand([card('spade', 14)]).type === 'high', 'single ace = high')
  assert(evaluateHand([card('spade', 4), card('heart', 5), card('club', 6), card('diamond', 7)]).type === 'high', '4-card run is not straight')
  // 面值入筹
  assert(cardValue(11) === 10 && cardValue(12) === 10 && cardValue(13) === 10 && cardValue(14) === 11 && cardValue(9) === 9, 'card values JQK=10 A=11')
  // 对手 HP 表
  assert(opponentHp(1) === 30, 'floor1 hp 30')
  assert(opponentHp(4) === Math.round((30 + 45) * 1.5), 'floor4 elite ×1.5')
  assert(opponentHp(12) === 400, 'boss hp 400')
  // 压注区间 clamp 3–15
  for (let f = 1; f <= 12; f++) {
    const [lo, hi] = actualBetRange(f)
    assert(lo >= 3 && hi <= 15 && lo <= hi, `bet range floor ${f} in [3,15], got ${lo}-${hi}`)
  }
}

// ── 2. 100 局随机爬塔冒烟 ─────────────────────
console.log('[2] 100-run smoke simulation')
{
  const rng = new Rng(20250101)
  const next = () => rng.next()
  let wins = 0
  let floorsSum = 0
  let totalDamage = 0
  let totalPlays = 0

  /** 从手牌枚举若干候选（全组合 2^8 太多，抽样 + 常见牌型），选伤害期望最高的 1–5 张 */
  function bestPlay(st: DuelState): string[] {
    const hand = st.hand
    let best: { ids: string[]; dmg: number } | null = null
    const consider = (ids: string[]) => {
      const cards = hand.filter((c) => ids.includes(c.id))
      const ev = evaluateHand(cards)
      const dmg = (ev.chips + cards.reduce((s, c) => s + cardValue(c.rank), 0)) * ev.mult
      if (!best || dmg > best.dmg) best = { ids, dmg }
    }
    // 全子集（8 张 → 247 个非空且 ≤5 的组合，可承受）
    const n = hand.length
    for (let mask = 1; mask < 1 << n; mask++) {
      let bits = 0
      for (let b = mask; b; b &= b - 1) bits++
      if (bits > 5) continue
      const ids: string[] = []
      for (let i = 0; i < n; i++) if (mask & (1 << i)) ids.push(hand[i].id)
      consider(ids)
    }
    return best!.ids
  }

  for (let run = 0; run < 100; run++) {
    const deck: DeckCard[] = buildInitialDeck(next)
    assert(deck.length === 52, `deck 52 cards, got ${deck.length}`)
    assert(new Set(deck.map((c) => c.id)).size === 52, 'deck ids unique')
    assert(deck.every((c) => c.affixes.length <= 1), 'initial deck 0-1 affix per card')
    let hp = 40
    let floorReached = 0
    for (let floor = 1; floor <= 12; floor++) {
      let st = initDuel(deck, floor, hp, next)
      let guard = 0
      while (st.phase === 'playing') {
        guard++
        assert(guard < 60, `no infinite loop (run ${run} floor ${floor})`)
        if (guard >= 60) break
        // 偶发弃牌：换掉面值最低的 3 张
        if (st.discardsLeft > 0 && next() < 0.25) {
          const worst = [...st.hand].sort((a, b) => cardValue(a.rank) - cardValue(b.rank)).slice(0, 3).map((c) => c.id)
          st = discardCards(st, worst, next).state
          continue
        }
        const ids = bestPlay(st)
        const r = playCards(st, ids, next)
        totalPlays++
        totalDamage += r.damage
        assert(r.damage >= 0 && Number.isFinite(r.damage), 'damage non-negative finite')
        assert(r.betDamage >= 0 && r.betDamage <= 15, `bet ≤ 15, got ${r.betDamage}`)
        assert(r.state.hand.length <= HAND_SIZE + 5, `hand bounded, got ${r.state.hand.length}`)
        assert(r.state.playerHp >= 0 && r.state.oppHp >= 0, 'hp non-negative')
        st = r.state
      }
      hp = st.playerHp
      if (st.phase !== 'won') break
      floorReached = floor
    }
    floorsSum += floorReached
    if (floorReached === 12) wins++
  }
  console.log(`  runs=100 summit=${wins} avgFloor=${(floorsSum / 100).toFixed(2)} avgDmg=${(totalDamage / Math.max(1, totalPlays)).toFixed(1)} plays=${totalPlays}`)
  assert(failures === 0, 'smoke assertions')
  assert(OPPONENTS.length === 12, '12 opponents')
  assert(Object.keys(OPPONENTS[11]).length > 0, 'boss exists')
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} assertion(s)`)
  process.exit(1)
}
console.log('\nOK: all assertions passed, 100 runs completed')

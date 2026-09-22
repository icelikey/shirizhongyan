/**
 * 丹丘牌楼 · 对决状态机（poker.md §1.2）。
 * 纯函数：state 不可变更新，返回新 state + 事件流（UI 演出用）。
 *
 * 流程：每场 4 次出牌 + 2 次弃牌；每次出牌后手牌补至 8；对手在每次出牌后
 * 压注反击（实际区间随层数 clamp 3–15；精英/楼主显示区间伪装加宽 ±2）。
 * 词条结算分三步：计分修正（打出时）→ 打出后效果 → 对手压注（在手牌时词条介入）。
 */
import type { DeckCard, DuelEvent, DuelState } from './types'
import { getAffix } from '@/data/poker/affixes'
import { OPPONENTS, opponentHp } from '@/data/poker/opponents'
import { cardValue, shuffle } from './cards'
import { evaluateHand, HAND_SCORE } from './evaluator'

export const PLAYER_MAX_HP = 40
export const HAND_SIZE = 8
export const BASE_PLAYS = 4
export const BASE_DISCARDS = 2

/** 实际压注区间：对手基准随层数上浮，clamp 至 3–15 */
export function actualBetRange(floor: number): [number, number] {
  const opp = OPPONENTS[floor - 1]
  const [lo, hi] = opp.bet
  const shift = Math.floor((floor - 1) * 0.75)
  const a = Math.min(15, Math.max(3, lo + shift))
  const b = Math.min(15, Math.max(a, hi + shift))
  return [a, b]
}

/** 显示区间：精英/楼主伪装加宽（读心机制的「面具」） */
export function shownBetRange(floor: number): [number, number] {
  const opp = OPPONENTS[floor - 1]
  const [a, b] = actualBetRange(floor)
  if (opp.elite || opp.boss) return [Math.max(1, a - 2), Math.min(18, b + 2)]
  return [a, b]
}

export interface InitDuelOpts {
  extraPlays?: number   // 茶馆道具：本场 +1 出牌
  extraDiscards?: number
}

export function initDuel(deck: DeckCard[], floor: number, playerHp: number, rng: () => number, opts: InitDuelOpts = {}): DuelState {
  const opp = OPPONENTS[floor - 1]
  const pile = shuffle(deck.map((c) => ({ ...c, affixes: [...c.affixes] })), rng)
  const hand = pile.slice(0, HAND_SIZE)
  const st: DuelState = {
    floor,
    oppId: opp.id,
    playerHp,
    oppHp: opponentHp(floor),
    oppMaxHp: opponentHp(floor),
    drawPile: pile.slice(HAND_SIZE),
    hand,
    discardPile: [],
    playsLeft: BASE_PLAYS + (opts.extraPlays ?? 0),
    discardsLeft: BASE_DISCARDS + (opts.extraDiscards ?? 0),
    betRange: actualBetRange(floor),
    shownBetRange: shownBetRange(floor),
    ward: 0,
    halveNextBet: false,
    immuneBigBetUsed: false,
    extraPlayGranted: false,
    firstPlayDone: false,
    discardUsedThisDuel: false,
    nullifyThisBet: false,
    tempBuffs: {},
    coinsEarned: 0,
    phase: 'playing',
  }
  return applyInHandPassives(st, [])[0]
}

/** 从抽牌堆抽 n 张；抽空则将弃牌堆洗回 */
function drawCards(st: DuelState, n: number, rng: () => number): DuelState {
  let drawPile = [...st.drawPile]
  let discardPile = [...st.discardPile]
  const hand = [...st.hand]
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break
      drawPile = shuffle(discardPile, rng)
      discardPile = []
    }
    const c = drawPile.shift()
    if (!c) break
    hand.push(c)
  }
  return { ...st, drawPile, discardPile, hand }
}

/** 在手牌时持续型词条：出牌数+1（一局一次） */
function applyInHandPassives(st: DuelState, events: DuelEvent[]): [DuelState, DuelEvent[]] {
  if (!st.extraPlayGranted && st.hand.some((c) => c.affixes.some((id) => getAffix(id).effect === 'extra_play_inhand'))) {
    const card = st.hand.find((c) => c.affixes.some((id) => getAffix(id).effect === 'extra_play_inhand'))!
    const affixId = card.affixes.find((id) => getAffix(id).effect === 'extra_play_inhand')!
    events.push({ type: 'affix', affixId, cardId: card.id, note: `「${getAffix(affixId).name}」出牌次数 +1` })
    return [{ ...st, playsLeft: st.playsLeft + 1, extraPlayGranted: true }, events]
  }
  return [st, events]
}

export interface PlayResult {
  state: DuelState
  events: DuelEvent[]
  /** 本次伤害（词条加成后进位取整） */
  damage: number
  /** 本次对手压注（结算后实际受伤） */
  betDamage: number
}

/** 打出 1–5 张牌 */
export function playCards(st: DuelState, cardIds: string[], rng: () => number): PlayResult {
  if (st.phase !== 'playing') throw new Error('duel not in playing phase')
  if (cardIds.length < 1 || cardIds.length > 5) throw new Error('must play 1-5 cards')
  const played = st.hand.filter((c) => cardIds.includes(c.id))
  if (played.length !== cardIds.length) throw new Error('card not in hand')

  const events: DuelEvent[] = []
  const ev = evaluateHand(played)

  // ── 1. 计分修正 ─────────────────────────────
  let chips = ev.chips + played.reduce((s, c) => s + cardValue(c.rank), 0)
  let mult = ev.mult
  const pairUp = ev.type !== 'high' // 对子以上
  const isFlush = ev.type === 'flush' || ev.type === 'straightFlush' || ev.type === 'royalFlush'
  const isStraight = ev.type === 'straight' || ev.type === 'straightFlush' || ev.type === 'royalFlush'

  for (const card of played) {
    // 临时加成（点金）优先消耗
    const temp = st.tempBuffs[card.id]
    if (temp) {
      chips += temp
      events.push({ type: 'affix', cardId: card.id, note: `临时加成 +${temp} 筹码`, affixId: 'lck-buffhand' })
    }
    for (const id of card.affixes) {
      const a = getAffix(id)
      if (a.trigger !== 'onPlay') continue
      switch (a.effect) {
        case 'chips_flat':
          chips += a.value
          events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」筹码 +${a.value}` })
          break
        case 'mult_if_spade':
          if (card.suit === 'spade') { mult += a.value / 10; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」倍率 +${a.value / 10}` }) }
          break
        case 'chips_if_pair_up':
          if (pairUp) { chips += a.value; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」筹码 +${a.value}` }) }
          break
        case 'mult_if_face':
          if (card.rank >= 11 && card.rank <= 13) { mult += a.value / 10; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」倍率 +${a.value / 10}` }) }
          break
        case 'mult_if_flush':
          if (isFlush) { mult += a.value / 10; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」倍率 +${a.value / 10}` }) }
          break
        case 'chips_if_straight':
          if (isStraight) { chips += a.value; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」筹码 +${a.value}` }) }
          break
        case 'chips_mul_if_ace':
          if (ev.hasAce) { chips = Math.round(chips * (a.value / 100)); events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」筹码 ×${a.value / 100}` }) }
          break
        case 'pair_value_double': {
          if (ev.pairValues.length > 0) {
            const add = ev.pairValues.reduce((s, r) => s + cardValue(r), 0)
            chips += add
            events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」对子面值翻倍 +${add}` })
          }
          break
        }
        case 'first_play_chips':
          if (!st.firstPlayDone) { chips += a.value; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」筹码 +${a.value}` }) }
          break
        case 'mult_if_no_discard':
          if (!st.discardUsedThisDuel) { mult += a.value / 10; events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」倍率 +${a.value / 10}` }) }
          break
        default:
          break // 打出后效果在第二步
      }
    }
  }

  // 词条加成后进位取整
  const damage = Math.ceil(chips * mult)
  let next: DuelState = {
    ...st,
    oppHp: Math.max(0, st.oppHp - damage),
    firstPlayDone: true,
    nullifyThisBet: false,
    tempBuffs: Object.fromEntries(Object.entries(st.tempBuffs).filter(([id]) => !cardIds.includes(id))),
  }
  events.push({
    type: 'score', handType: ev.type, chips, mult, damage,
    note: `${HAND_SCORE[ev.type].name} · ${chips} × ${mult} = ${damage}`,
  })

  // ── 2. 打出后效果 ────────────────────────────
  let extraDraw = 0
  let heal = 0
  let ward = next.ward
  let coins = 0
  let halveNextBet = next.halveNextBet
  let handAfter = next.hand.filter((c) => !cardIds.includes(c.id))
  let tempBuffs = { ...next.tempBuffs }

  for (const card of played) {
    for (const id of card.affixes) {
      const a = getAffix(id)
      if (a.trigger !== 'onPlay') continue
      switch (a.effect) {
        case 'draw_on_play':
          extraDraw += a.value
          events.push({ type: 'draw', count: a.value, affixId: id, cardId: card.id, note: `「${a.name}」抽 ${a.value} 张` })
          break
        case 'draw_if_five':
          if (played.length === 5) { extraDraw += a.value; events.push({ type: 'draw', count: a.value, affixId: id, cardId: card.id, note: `「${a.name}」满势抽 ${a.value} 张` }) }
          break
        case 'ward_on_play':
          ward += a.value
          events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」本场减伤 +${a.value}` })
          break
        case 'heal_on_play':
          heal += a.value
          break
        case 'halve_next_bet':
          halveNextBet = true
          events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」对手下次压注减半` })
          break
        case 'copy_on_play':
          if (rng() * 100 < a.value && handAfter.length < HAND_SIZE + 3) {
            handAfter = [...handAfter, { ...card }]
            events.push({ type: 'copy', cardId: card.id, affixId: id, note: `「${a.name}」${card.id} 复制回手` })
          }
          break
        case 'coins_on_play':
          if (rng() * 100 < a.value) {
            coins += 5
            events.push({ type: 'coins', amount: 5, affixId: id, cardId: card.id, note: `「${a.name}」+5 人心币` })
          }
          break
        case 'nullify_bet':
          if (rng() * 100 < a.value) {
            next = { ...next, nullifyThisBet: true }
            events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」免疫本次压注` })
          }
          break
        case 'buff_random_hand':
          if (handAfter.length > 0) {
            const t = handAfter[Math.floor(rng() * handAfter.length)]
            tempBuffs[t.id] = (tempBuffs[t.id] ?? 0) + a.value
            events.push({ type: 'affix', affixId: id, cardId: t.id, note: `「${a.name}」${t.id} 临时 +${a.value} 筹码` })
          }
          break
        default:
          break
      }
    }
  }

  // 打出的牌入弃牌堆，随后补牌（含词条额外抽牌）
  next = {
    ...next,
    hand: handAfter,
    discardPile: [...next.discardPile, ...played.map((c) => ({ ...c }))],
    ward,
    halveNextBet,
    coinsEarned: next.coinsEarned + coins,
    tempBuffs,
  }
  if (heal > 0) {
    const real = Math.min(heal, PLAYER_MAX_HP - next.playerHp)
    if (real > 0) events.push({ type: 'heal', amount: real, note: `回复 ${real} HP` })
    next = { ...next, playerHp: Math.min(PLAYER_MAX_HP, next.playerHp + heal) }
  }
  next = drawCards(next, HAND_SIZE - next.hand.length + extraDraw, rng)

  // ── 3. 胜负与对手压注 ────────────────────────
  let betDamage = 0
  if (next.oppHp <= 0) {
    next = { ...next, phase: 'won' }
    events.push({ type: 'win', note: '对手倒地' })
  } else {
    next = { ...next, playsLeft: next.playsLeft - 1 }
    // 压注反击
    const [lo, hi] = next.betRange
    const raw = lo + Math.floor(rng() * (hi - lo + 1))
    let bet = raw
    let note = `对手压注 ${raw}`
    if (next.nullifyThisBet) {
      bet = 0
      note = `压注 ${raw} 被「空门」化解`
    } else {
      // 在手牌时：免疫一次大额压注（≥10）
      if (!next.immuneBigBetUsed && raw >= 10) {
        const guard = next.hand.find((c) => c.affixes.some((id) => getAffix(id).effect === 'immune_big_bet'))
        if (guard) {
          const affixId = guard.affixes.find((id) => getAffix(id).effect === 'immune_big_bet')!
          bet = 0
          next = { ...next, immuneBigBetUsed: true }
          events.push({ type: 'affix', affixId, cardId: guard.id, note: `「${getAffix(affixId).name}」免疫大额压注 ${raw}` })
        }
      }
      if (bet > 0) {
        // 示弱：在手牌时压注 -1 可叠
        const reduce = next.hand.reduce((s, c) => s + c.affixes.filter((id) => getAffix(id).effect === 'bet_reduce_inhand').length, 0)
        if (reduce > 0) { bet = Math.max(0, bet - reduce); note += `，示弱 -${reduce}` }
        if (next.halveNextBet) { bet = Math.floor(bet / 2); note += '，攻心减半' }
        if (next.ward > 0) { const w = Math.min(next.ward, bet); bet -= w; note += `，结界挡 ${w}` }
      }
    }
    betDamage = bet
    next = { ...next, halveNextBet: false, nullifyThisBet: false, playerHp: Math.max(0, next.playerHp - bet) }
    events.push({ type: 'bet', amount: bet, raw, note: `${note} → 受 ${bet} 点` })

    const [s2, ev2] = applyInHandPassives(next, [])
    next = s2
    events.push(...ev2)

    if (next.playerHp <= 0) {
      next = { ...next, phase: 'lost' }
      events.push({ type: 'lose', note: 'HP 归零' })
    } else if (next.playsLeft <= 0) {
      next = { ...next, phase: 'lost' }
      events.push({ type: 'lose', note: '出牌次数耗尽' })
    }
  }

  return { state: next, events, damage, betDamage }
}

export interface DiscardResult {
  state: DuelState
  events: DuelEvent[]
}

/** 弃任意张补等量；「回袖」词条退还弃牌次数 */
export function discardCards(st: DuelState, cardIds: string[], rng: () => number): DiscardResult {
  if (st.phase !== 'playing') throw new Error('duel not in playing phase')
  if (st.discardsLeft <= 0) throw new Error('no discards left')
  if (cardIds.length < 1) throw new Error('must discard ≥1')
  const tossed = st.hand.filter((c) => cardIds.includes(c.id))
  if (tossed.length !== cardIds.length) throw new Error('card not in hand')

  const events: DuelEvent[] = []
  let refund = 0
  for (const card of tossed) {
    for (const id of card.affixes) {
      const a = getAffix(id)
      if (a.trigger === 'onDiscard' && a.effect === 'refund_discard') {
        refund += a.value
        events.push({ type: 'affix', affixId: id, cardId: card.id, note: `「${a.name}」弃牌次数 +${a.value}` })
      }
    }
  }

  let next: DuelState = {
    ...st,
    hand: st.hand.filter((c) => !cardIds.includes(c.id)),
    discardPile: [...st.discardPile, ...tossed.map((c) => ({ ...c }))],
    discardsLeft: st.discardsLeft - 1 + refund,
    discardUsedThisDuel: true,
  }
  next = drawCards(next, tossed.length, rng)
  const [s2, ev2] = applyInHandPassives(next, [])
  return { state: s2, events: [...events, ...ev2] }
}

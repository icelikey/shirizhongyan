/**
 * 丹丘牌楼 · 牌型评估器（poker.md §1.2，Balatro 式 筹码×倍率）。
 * 高牌 5×1 / 一对 10×2 / 两对 20×2 / 三条 30×3 / 顺子 30×4 / 同花 35×4 /
 * 葫芦 40×4 / 四条 60×7 / 同花顺 100×8 / 皇家同花顺 120×10。
 * 顺子含 A2345（轮子）；皇家同花顺 = 10-J-Q-K-A 同花。
 */
import type { DeckCard, HandEval, HandType } from './types'

export const HAND_SCORE: Record<HandType, { chips: number; mult: number; name: string }> = {
  high:          { chips: 5,   mult: 1,  name: '高牌' },
  pair:          { chips: 10,  mult: 2,  name: '一对' },
  twoPair:       { chips: 20,  mult: 2,  name: '两对' },
  trips:         { chips: 30,  mult: 3,  name: '三条' },
  straight:      { chips: 30,  mult: 4,  name: '顺子' },
  flush:         { chips: 35,  mult: 4,  name: '同花' },
  fullHouse:     { chips: 40,  mult: 4,  name: '葫芦' },
  quads:         { chips: 60,  mult: 7,  name: '四条' },
  straightFlush: { chips: 100, mult: 8,  name: '同花顺' },
  royalFlush:    { chips: 120, mult: 10, name: '皇家同花顺' },
}

export const HAND_ORDER: HandType[] = [
  'high', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush', 'royalFlush',
]

/** 判定 5 张是否顺子（含 A2345），返回是否顺子与是否 Broadway(10-A) */
function straightInfo(ranks: number[]): { is: boolean; broadway: boolean } {
  const uniq = [...new Set(ranks)].sort((a, b) => a - b)
  if (uniq.length !== 5) return { is: false, broadway: false }
  // A2345 轮子
  if (uniq.join(',') === '2,3,4,5,14') return { is: true, broadway: false }
  if (uniq[4] - uniq[0] === 4) return { is: true, broadway: uniq[0] === 10 }
  return { is: false, broadway: false }
}

/**
 * 评估 1–5 张牌的牌型。
 * 约定：顺子/同花/同花顺/皇家 需要 5 张；葫芦优先于两对，同花顺优先于同花/顺子。
 */
export function evaluateHand(cards: Pick<DeckCard, 'suit' | 'rank'>[]): HandEval {
  if (cards.length === 0) throw new Error('evaluateHand: empty')
  const ranks = cards.map((c) => c.rank)
  const hasAce = ranks.includes(14)

  const countByRank = new Map<number, number>()
  for (const r of ranks) countByRank.set(r, (countByRank.get(r) ?? 0) + 1)
  const counts = [...countByRank.values()].sort((a, b) => b - a)

  const isFlush = cards.length === 5 && cards.every((c) => c.suit === cards[0].suit)
  const st = cards.length === 5 ? straightInfo(ranks) : { is: false, broadway: false }

  let type: HandType = 'high'
  if (isFlush && st.is && st.broadway) type = 'royalFlush'
  else if (isFlush && st.is) type = 'straightFlush'
  else if (counts[0] === 4) type = 'quads'
  else if (counts[0] === 3 && counts[1] === 2) type = 'fullHouse'
  else if (isFlush) type = 'flush'
  else if (st.is) type = 'straight'
  else if (counts[0] === 3) type = 'trips'
  else if (counts[0] === 2 && counts[1] === 2) type = 'twoPair'
  else if (counts[0] === 2) type = 'pair'

  // 对子面值（供「对影」词条 ×2 计）：取成对的对子面值
  const pairValues: number[] = []
  if (type === 'pair' || type === 'twoPair' || type === 'fullHouse') {
    for (const [r, c] of countByRank) {
      if (c === 2) pairValues.push(r)
      else if (c === 4) pairValues.push(r, r) // 四条视为两对的面值来源（防御性，不会触发）
    }
    if (type === 'fullHouse') {
      // 葫芦只算那个对子
      pairValues.length = 0
      for (const [r, c] of countByRank) if (c === 2) pairValues.push(r)
    }
  }

  return { type, chips: HAND_SCORE[type].chips, mult: HAND_SCORE[type].mult, hasAce, pairValues }
}

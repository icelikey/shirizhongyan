/**
 * 丹丘牌楼 · 52 张标准牌与牌面工具。
 */
import type { Suit } from '@/data/echoes'
import { SUITS } from '@/data/echoes'
import type { DeckCard } from './types'
import { randomAffixId } from '@/data/poker/affixes'

export const SUIT_INITIAL: Record<Suit, string> = { spade: 'S', heart: 'H', club: 'C', diamond: 'D' }
export const SUIT_SYMBOL: Record<Suit, string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' }

export const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}

/** 牌面值入筹：2–10 面值，J/Q/K=10，A=11 */
export function cardValue(rank: number): number {
  if (rank >= 14) return 11
  return Math.min(rank, 10)
}

export function cardId(suit: Suit, rank: number): string {
  return `${SUIT_INITIAL[suit]}${rank}`
}

/** 构建初始 52 张牌组：每张随机 0–1 条词条 */
export function buildInitialDeck(rng: () => number): DeckCard[] {
  const deck: DeckCard[] = []
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      const affixes = rng() < 0.5 ? [randomAffixId(rng)] : []
      deck.push({ id: cardId(suit, rank), suit, rank, affixes })
    }
  }
  return deck
}

/** Fisher–Yates */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

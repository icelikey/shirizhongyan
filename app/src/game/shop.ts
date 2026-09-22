/**
 * 碎境爬塔 · 商店库存生成（spire-map.md §3.2 商店节点）。
 * 6 商品：3 卡（30–80 金，按稀有度分档）+ 1 遗物（120–180，未持有优先）+ 2 药水（40–60）。
 * 「撤牌」服务定价常量同置于此（75 金 / 每店一次，交互在 ShopModal）。
 */
import { cardPool, cardView, potionPool, relicPool } from '@/game/spire-data'

export const REMOVE_PRICE = 75

export interface ShopStock {
  cards: { id: string; price: number }[]
  relic: { id: string; price: number } | null
  potions: { id: string; price: number }[]
}

const between = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

function cardPrice(id: string, rng: () => number): number {
  switch (cardView(id).rarity) {
    case 'uncommon':
      return between(rng, 45, 65)
    case 'rare':
      return between(rng, 60, 80)
    default:
      return between(rng, 30, 45)
  }
}

const pickN = (pool: string[], n: number, rng: () => number): string[] => {
  const src = [...pool]
  const out: string[] = []
  while (out.length < n && src.length > 0) {
    out.push(src.splice(Math.floor(rng() * src.length), 1)[0])
  }
  return out
}

/** 生成一店库存（进节点时调用一次） */
export function genShopStock(ownedRelics: string[], rng: () => number = Math.random): ShopStock {
  const unowned = relicPool().filter((id) => !ownedRelics.includes(id))
  const relicSrc = unowned.length > 0 ? unowned : relicPool()
  const relicId = relicSrc[Math.floor(rng() * relicSrc.length)]
  return {
    cards: pickN(cardPool(), 3, rng).map((id) => ({ id, price: cardPrice(id, rng) })),
    relic: relicId ? { id: relicId, price: between(rng, 120, 180) } : null,
    potions: pickN(potionPool(), 2, rng).map((id) => ({ id, price: between(rng, 40, 60) })),
  }
}

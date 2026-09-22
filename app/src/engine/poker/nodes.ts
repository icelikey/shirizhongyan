/**
 * 丹丘牌楼 · 层间节点（poker.md §1.3）。
 * 每过一层三选一：洗心祭坛 / 丹丘茶馆 / 千面奇遇（3 个固定事件轮换）。
 */
import type { DeckCard } from './types'
import { AFFIXES, randomAffixId } from '@/data/poker/affixes'

export type NodeKind = 'altar' | 'teahouse' | 'encounter'

export const NODE_META: Record<NodeKind, { name: string; desc: string }> = {
  altar:    { name: '洗心祭坛', desc: '重摇一张牌的一条词条（首次免费，之后 20 币）；或注灵：三选一打上词条（30 币，每牌至多 2 条）' },
  teahouse: { name: '丹丘茶馆', desc: '免费回 10 HP；或购人心道具（30 币：下一场 +1 出牌 / 40 币：+1 弃牌）' },
  encounter:{ name: '千面奇遇', desc: '面具之下，福祸相倚——随机事件' },
}

export const REROLL_COST = 20
export const INFUSE_COST = 30
export const TEAPOT_PLAY_COST = 30
export const TEAPOT_DISCARD_COST = 40
export const TEA_HEAL = 10

/** 重摇：随机换掉该牌的一条词条（返回新 affixes） */
export function rerollAffix(card: DeckCard, slot: number, rng: () => number): string[] {
  const others = card.affixes.filter((_, i) => i !== slot)
  const next = randomAffixId(rng, others)
  const out = [...card.affixes]
  if (out.length === 0) return [next]
  out[Math.min(slot, out.length - 1)] = next
  return out
}

/** 注灵：从词条池抽 3 条不重复候选（排除该牌已有） */
export function infuseCandidates(card: DeckCard, rng: () => number): string[] {
  const pool = AFFIXES.filter((a) => !card.affixes.includes(a.id)).map((a) => a.id)
  const out: string[] = []
  const p = [...pool]
  while (out.length < 3 && p.length > 0) {
    const i = Math.floor(rng() * p.length)
    out.push(p.splice(i, 1)[0])
  }
  return out
}

export interface EncounterEvent {
  id: string
  name: string
  text: string
  /** 结算为数值补丁：HP 增减 / 币增减 / 词条祝福(给随机牌加词条) / 词条诅咒(随机牌减词条) */
  effect: { hp?: number; coins?: number; bless?: boolean; curse?: boolean }
  resultText: string
}

export const ENCOUNTERS: EncounterEvent[] = [
  {
    id: 'mirror-lake',
    name: '心湖照影',
    text: '湖面浮起一面铜镜，照出你最怕输的那张牌。镜面忽然碎了。',
    effect: { hp: -8, bless: true },
    resultText: '碎镜伤人：HP -8；但镜片凝成祝福——随机一张牌获得一条新词条（若有余位）。',
  },
  {
    id: 'lantern-merchant',
    name: '灯笼小贩',
    text: '戴狐面的小贩拦住你：「客官，买盏灯吧？丹丘的夜路，黑得很。」',
    effect: { coins: 25, hp: -5 },
    resultText: '你接过灯笼，掌心被烛火燎了一下：人心币 +25，HP -5。',
  },
  {
    id: 'silent-toast',
    name: '无声对酌',
    text: '茶棚里一位无面人朝你举杯。你饮下那盏茶，喉间回甘。',
    effect: { hp: 12, curse: true },
    resultText: '回甘入腑：HP +12；但茶里泡着咒语——随机一张牌剥落一条词条。',
  },
]

/** 奇遇轮换：本局第 n 次奇遇取第 n%3 个事件 */
export function encounterFor(index: number): EncounterEvent {
  return ENCOUNTERS[index % ENCOUNTERS.length]
}

/** 词条祝福：给随机一张未满 2 条的牌加词条；返回新牌组 */
export function applyBless(deck: DeckCard[], rng: () => number): DeckCard[] {
  const candidates = deck.filter((c) => c.affixes.length < 2)
  if (candidates.length === 0) return deck
  const t = candidates[Math.floor(rng() * candidates.length)]
  return deck.map((c) => (c.id === t.id ? { ...c, affixes: [...c.affixes, randomAffixId(rng, c.affixes)] } : c))
}

/** 词条诅咒：随机一张有词条的牌剥落一条 */
export function applyCurse(deck: DeckCard[], rng: () => number): DeckCard[] {
  const candidates = deck.filter((c) => c.affixes.length > 0)
  if (candidates.length === 0) return deck
  const t = candidates[Math.floor(rng() * candidates.length)]
  const keep = t.affixes.filter((_, i) => i !== Math.floor(rng() * t.affixes.length))
  return deck.map((c) => (c.id === t.id ? { ...c, affixes: keep } : c))
}

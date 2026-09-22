/**
 * 丹丘牌楼 · 引擎共用类型。
 */
import type { Suit } from '@/data/echoes'

/** 牌组中的一张牌（永久资产，词条跨局保留）。id 形如 'S14'（♠A） */
export interface DeckCard {
  id: string
  suit: Suit
  /** 2–14（11=J 12=Q 13=K 14=A） */
  rank: number
  /** 词条 id 列表，0–2 条 */
  affixes: string[]
}

export type HandType =
  | 'high' | 'pair' | 'twoPair' | 'trips' | 'straight'
  | 'flush' | 'fullHouse' | 'quads' | 'straightFlush' | 'royalFlush'

export interface HandEval {
  type: HandType
  /** 牌型基础筹码（未含牌面值） */
  chips: number
  /** 牌型基础倍率 */
  mult: number
  /** 含 A */
  hasAce: boolean
  /** 含对子结构（pair/twoPair/fullHouse）时的对子面值和 */
  pairValues: number[]
}

export type DuelPhase = 'playing' | 'won' | 'lost'

export interface DuelEvent {
  type:
    | 'score'        // 牌型结算 { handType, chips, mult, damage }
    | 'affix'        // 词条触发 { affixId, cardId, note }
    | 'bet'          // 对手压注 { amount, raw, note }
    | 'heal'         // 回血 { amount }
    | 'coins'        // 人心币 { amount }
    | 'draw'         // 额外抽牌 { count }
    | 'copy'         // 复制回手 { cardId }
    | 'win' | 'lose'
  note: string
  handType?: HandType
  chips?: number
  mult?: number
  damage?: number
  amount?: number
  raw?: number
  affixId?: string
  cardId?: string
  count?: number
}

export interface DuelState {
  floor: number
  oppId: string
  playerHp: number
  oppHp: number
  oppMaxHp: number
  drawPile: DeckCard[]
  hand: DeckCard[]
  discardPile: DeckCard[]
  playsLeft: number
  discardsLeft: number
  /** 实际压注区间 */
  betRange: [number, number]
  /** 显示给玩家的压注区间（精英/楼主伪装加宽） */
  shownBetRange: [number, number]
  /** 本场减伤（结界叠加） */
  ward: number
  halveNextBet: boolean
  immuneBigBetUsed: boolean
  extraPlayGranted: boolean
  firstPlayDone: boolean
  discardUsedThisDuel: boolean
  /** 本打出结算内免压注（空门 10%） */
  nullifyThisBet: boolean
  /** 临时筹码加成 cardId → chips（点金） */
  tempBuffs: Record<string, number>
  /** 本场词条获得的人心币 */
  coinsEarned: number
  phase: DuelPhase
}

/**
 * ============================================================================
 * 丹丘牌楼 · pokerStore（zustand + persist，key: ten-days-gambit-poker）
 * ============================================================================
 * 永久保留：52 张牌组的词条配置（跨局）、元进度（最高层/登顶/总局数）。
 * Run 状态也持久化——刷新/离开后可「继续牌局」。
 *
 * 【经济结算方案说明】（poker.md §1.4 + 任务约束）
 * 采用「run 内累积、终局统一结算」：
 *  - 门票 10♥ 在 startRun 时立即 spendFragments 扣除（不足禁止开局）。
 *  - 每层胜 +2♥、精英 +10♥、登顶 +40♥ 一律先累积进 run.pendingFragments，
 *    不实时入账（避免败北时无法回退一半）。
 *  - 登顶：pendingFragments 全额 addFragments('heart') 入账。
 *  - 败北/弃局：入账 ceil(pendingFragments / 2)（保留一半，向上取整）。
 *  - 精英击杀的 addWin('heart')（生肖胜场）即时入账——生肖进度不是碎片，无需回退。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeckCard, DuelState } from '@/engine/poker/types'
import { buildInitialDeck } from '@/engine/poker/cards'
import { initDuel, playCards as enginePlay, discardCards as engineDiscard, PLAYER_MAX_HP } from '@/engine/poker/duel'
import type { DuelEvent } from '@/engine/poker/types'
import { OPPONENTS } from '@/data/poker/opponents'
import {
  applyBless, applyCurse, encounterFor, infuseCandidates, rerollAffix,
  INFUSE_COST, REROLL_COST, TEAPOT_DISCARD_COST, TEAPOT_PLAY_COST, TEA_HEAL,
} from '@/engine/poker/nodes'
import { useProfile } from '@/store/profile'

export const TICKET_COST = 10
export const FRAG_PER_FLOOR = 2
export const FRAG_ELITE = 10
export const FRAG_SUMMIT = 40
export const COINS_PER_FLOOR = 15
export const COINS_ELITE = 40
export const FINAL_FLOOR = 12

export type RunPhase = 'duel' | 'node' | 'won' | 'lost'

export interface PokerRun {
  floor: number
  phase: RunPhase
  hp: number
  /** 人心币（局内货币） */
  coins: number
  /** 本局已累积待结算 ♥ 碎片 */
  pendingFragments: number
  altarFreeUsed: boolean
  encounterCount: number
  /** 茶馆道具：下一场对决 +1 出牌 / +1 弃牌 */
  itemExtraPlay: number
  itemExtraDiscard: number
  duel: DuelState | null
  /** 终局已入账的碎片（结算展示） */
  settled: number | null
}

export interface PokerStats {
  runs: number
  summits: number
  bestFloor: number
}

interface PokerState {
  deck: DeckCard[]
  deckReady: boolean
  stats: PokerStats
  run: PokerRun | null

  ensureDeck: () => void
  /** 门票 10♥，不足返回 false */
  startRun: () => boolean
  /** 进入当前层对决（生成 duel） */
  startDuel: () => void
  playCards: (ids: string[]) => { events: DuelEvent[]; damage: number; betDamage: number } | null
  discard: (ids: string[]) => DuelEvent[] | null
  /** 层间节点行动 */
  altarReroll: (cardId: string, slot: number) => boolean
  altarInfuseOptions: (cardId: string) => string[]
  altarInfuse: (cardId: string, affixId: string) => boolean
  teahouseHeal: () => boolean
  teahouseBuy: (kind: 'play' | 'discard') => boolean
  applyEncounter: () => { text: string; resultText: string }
  /** 层间节点完成 → 下一层 */
  nextFloor: () => void
  abandonRun: () => void
  /** 词条名录/牌组展示辅助 */
  deckAffixCount: () => number
}

const rng = () => Math.random()

export const usePoker = create<PokerState>()(
  persist(
    (set, get) => {
      /** 终局统一结算：victory 全额 / defeat 一半（向上取整） */
      const settle = (victory: boolean) => {
        const run = get().run
        if (!run || run.settled !== null) return
        const total = run.pendingFragments + (victory ? FRAG_SUMMIT : 0)
        const gain = victory ? total : Math.ceil(total / 2)
        if (gain > 0) useProfile.getState().addFragments('heart', gain)
        set((s) => ({
          run: s.run ? { ...s.run, phase: victory ? 'won' : 'lost', settled: gain, duel: null } : null,
          stats: {
            ...s.stats,
            summits: s.stats.summits + (victory ? 1 : 0),
            bestFloor: Math.max(s.stats.bestFloor, run.floor),
          },
        }))
      }

      return {
        deck: [],
        deckReady: false,
        stats: { runs: 0, summits: 0, bestFloor: 0 },
        run: null,

        ensureDeck: () => {
          if (get().deckReady && get().deck.length === 52) return
          set({ deck: buildInitialDeck(rng), deckReady: true })
        },

        startRun: () => {
          get().ensureDeck()
          const profile = useProfile.getState()
          if (!profile.spendFragments('heart', TICKET_COST)) return false
          set((s) => ({
            run: {
              floor: 1, phase: 'duel', hp: PLAYER_MAX_HP, coins: 0,
              pendingFragments: 0, altarFreeUsed: false, encounterCount: 0,
              itemExtraPlay: 0, itemExtraDiscard: 0, duel: null, settled: null,
            },
            stats: { ...s.stats, runs: s.stats.runs + 1 },
          }))
          get().startDuel()
          return true
        },

        startDuel: () => {
          const { run, deck } = get()
          if (!run || run.phase !== 'duel') return
          const duel = initDuel(deck, run.floor, run.hp, rng, {
            extraPlays: run.itemExtraPlay,
            extraDiscards: run.itemExtraDiscard,
          })
          set((s) => ({
            run: s.run
              ? { ...s.run, duel, itemExtraPlay: 0, itemExtraDiscard: 0 }
              : null,
          }))
        },

        playCards: (ids) => {
          const { run } = get()
          if (!run?.duel || run.phase !== 'duel') return null
          const r = enginePlay(run.duel, ids, rng)
          let nextRun: PokerRun = { ...run, duel: r.state, hp: r.state.playerHp, coins: run.coins + r.state.coinsEarned }
          nextRun.duel = { ...r.state, coinsEarned: 0 }
          if (r.state.phase === 'won') {
            const opp = OPPONENTS[run.floor - 1]
            nextRun.pendingFragments += opp.elite ? FRAG_ELITE : FRAG_PER_FLOOR
            nextRun.coins += opp.elite ? COINS_ELITE : COINS_PER_FLOOR
            if (opp.elite) useProfile.getState().addWin('heart') // 精英击杀即时记生肖胜场
            if (run.floor >= FINAL_FLOOR) {
              set({ run: nextRun })
              settle(true)
              return { events: r.events, damage: r.damage, betDamage: r.betDamage }
            }
            nextRun.phase = 'node'
          } else if (r.state.phase === 'lost') {
            set({ run: nextRun })
            settle(false)
            return { events: r.events, damage: r.damage, betDamage: r.betDamage }
          }
          set({ run: nextRun })
          return { events: r.events, damage: r.damage, betDamage: r.betDamage }
        },

        discard: (ids) => {
          const { run } = get()
          if (!run?.duel || run.phase !== 'duel') return null
          const r = engineDiscard(run.duel, ids, rng)
          set({ run: { ...run, duel: r.state } })
          return r.events
        },

        // ── 洗心祭坛 ────────────────────────────
        altarReroll: (cardId, slot) => {
          const { run, deck } = get()
          if (!run || run.phase !== 'node') return false
          const free = !run.altarFreeUsed
          if (!free && run.coins < REROLL_COST) return false
          const card = deck.find((c) => c.id === cardId)
          if (!card || card.affixes.length === 0) return false
          set({
            deck: deck.map((c) => (c.id === cardId ? { ...c, affixes: rerollAffix(c, slot, rng) } : c)),
            run: { ...run, altarFreeUsed: true, coins: free ? run.coins : run.coins - REROLL_COST },
          })
          return true
        },

        altarInfuseOptions: (cardId) => {
          const card = get().deck.find((c) => c.id === cardId)
          if (!card || card.affixes.length >= 2) return []
          return infuseCandidates(card, rng)
        },

        altarInfuse: (cardId, affixId) => {
          const { run, deck } = get()
          if (!run || run.phase !== 'node' || run.coins < INFUSE_COST) return false
          const card = deck.find((c) => c.id === cardId)
          if (!card || card.affixes.length >= 2 || card.affixes.includes(affixId)) return false
          set({
            deck: deck.map((c) => (c.id === cardId ? { ...c, affixes: [...c.affixes, affixId] } : c)),
            run: { ...run, coins: run.coins - INFUSE_COST },
          })
          return true
        },

        // ── 丹丘茶馆 ────────────────────────────
        teahouseHeal: () => {
          const { run } = get()
          if (!run || run.phase !== 'node' || run.hp >= PLAYER_MAX_HP) return false
          set({ run: { ...run, hp: Math.min(PLAYER_MAX_HP, run.hp + TEA_HEAL) } })
          return true
        },

        teahouseBuy: (kind) => {
          const { run } = get()
          const cost = kind === 'play' ? TEAPOT_PLAY_COST : TEAPOT_DISCARD_COST
          if (!run || run.phase !== 'node' || run.coins < cost) return false
          set({
            run: {
              ...run,
              coins: run.coins - cost,
              itemExtraPlay: run.itemExtraPlay + (kind === 'play' ? 1 : 0),
              itemExtraDiscard: run.itemExtraDiscard + (kind === 'discard' ? 1 : 0),
            },
          })
          return true
        },

        // ── 千面奇遇 ────────────────────────────
        applyEncounter: () => {
          const { run, deck } = get()
          if (!run || run.phase !== 'node') return { text: '', resultText: '' }
          const ev = encounterFor(run.encounterCount)
          let nextDeck = deck
          if (ev.effect.bless) nextDeck = applyBless(deck, rng)
          if (ev.effect.curse) nextDeck = applyCurse(deck, rng)
          set({
            deck: nextDeck,
            run: {
              ...run,
              encounterCount: run.encounterCount + 1,
              hp: Math.max(1, Math.min(PLAYER_MAX_HP, run.hp + (ev.effect.hp ?? 0))),
              coins: Math.max(0, run.coins + (ev.effect.coins ?? 0)),
            },
          })
          return { text: ev.text, resultText: ev.resultText }
        },

        nextFloor: () => {
          const { run } = get()
          if (!run || run.phase !== 'node') return
          const floor = run.floor + 1
          set((s) => ({
            run: s.run ? { ...s.run, floor, phase: 'duel', duel: null } : null,
            stats: { ...s.stats, bestFloor: Math.max(s.stats.bestFloor, run.floor) },
          }))
          get().startDuel()
        },

        abandonRun: () => {
          const { run } = get()
          if (!run) return
          settle(false) // 弃局按败北结算：已累积碎片入账一半
          set({ run: null })
        },

        deckAffixCount: () => get().deck.reduce((s, c) => s + c.affixes.length, 0),
      }
    },
    { name: 'ten-days-gambit-poker' },
  ),
)

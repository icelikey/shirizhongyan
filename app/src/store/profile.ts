/**
 * ============================================================================
 * 《十日牌局》玩家档案 Store —— 全游戏的档案 / 经济 / 养成唯一数据源
 * ============================================================================
 *
 * zustand + persist(localStorage)，key: `ten-days-gambit-profile`。
 *
 * 各页面代理使用指南：
 *
 * 【会话】
 * - `session: { nickname, companionEchoId, createdAt } | null`
 *     createdAt 为登录时间戳，是「十日倒计时」的锚点（见 src/lib/countdown.ts）。
 * - `login(nickname, echoId)`  登录（契约仪式完成时调用）。
 *     ⚠️ login 会重置全部游戏进度（碎片/战绩/生肖/位阶/影从记忆/残章），
 *     视为「新一局十日」开始；同时建立 companion 并记录与初始影从的相遇。
 * - `logout()`  仅清除 session（保留进度，便于调试）；回到 `/` 由 LoginGuard 处理。
 * - `rename(nickname)`  修改昵称（TopHUD 用户抽屉「改名」，2-12 字）。
 *
 * 【碎片经济】
 * - `fragments: Record<Suit, number>`  四花色碎片（♠♥♣♦），来源：对局结算奖励。
 * - `addFragments(suit, n)`  增加（奖励结算用）。
 * - `spendFragments(suit, n): boolean`  余额充足则扣减并返回 true，否则不变返回 false
 *    （门票/建房/记忆槽扩容等先调用它判断能否支付）。
 *
 * 【战绩】
 * - `records: { guess: {played,won}, werewolf: {played,won} }`  两个内置游戏的场次/胜场。
 * - `recordResult(game, won, mvp?)`  对局结束调用一次；mvp=true 时额外累计 `mvps[game]`。
 *
 * 【生肖段位】（design.md §8）
 * - `zodiac: Record<Suit, number[]>`  每花色大陆已点亮的生肖索引（0-11，对应 鼠..猪）。
 * - `winsTowardZodiac: Record<Suit, number>`  距下一枚生肖的胜场进度（每 3 胜点亮 1 枚）。
 * - `addWin(suit): boolean`  该花色大陆胜场 +1；满 3 胜自动点亮下一枚未点亮生肖并清零进度，
 *    返回「是否本次新点亮」（用于触发点亮演出）。12 枚全亮后仅累计胜场。
 *
 * 【位阶】（天地玄黄）
 * - `tier: 'huang' | 'xuan' | 'di' | 'tian'`  初始黄阶。
 * - `tryPromote(): boolean`  四花色大陆各满 12 生肖时晋升下一阶（黄→玄→地→天），
 *    晋升后生肖进度重置开启新一轮；成功返回 true（用于升阶仪式演出）。
 *
 * 【契约影从】
 * - `companion: { echoId, customName, style, memorySlots, bond } | null`
 *    style 为对话风格倾向（'calm'|'sharp'|'warm'|'balanced'），memorySlots 记忆槽位数，
 *    bond 羁绊值（对局/互动增长，0-100）。
 * - `updateCompanion(patch: Partial<Companion>)`  合并更新（改名/调风格/扩槽/加羁绊）。
 *
 * 【影从记忆】
 * - `echoMemories: Record<string, EchoMemory>`  与 8 位影从的交手记录：
 *    `{ met: boolean, wonAgainst: number, lostTo: number, note: string[] }`。
 * - `touchEcho(echoId, result, note?)`  result: 'met' | 'win' | 'lose'。
 *    任何结果都会标记 met；win/lose 分别累计胜/负；note 追加到记忆（去重，最多 20 条）。
 *
 * 【残章】
 * - `unlockedLore: number[]`  已解锁残章 id（1-10）。
 * - `unlockLore(id): boolean`  解锁并返回是否「新解锁」（重复调用返回 false）。
 * ============================================================================
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Suit } from '@/data/echoes'
import { SUITS, getEcho } from '@/data/echoes'
import { WINS_PER_ZODIAC } from '@/data/zodiac'
import type { Tier } from '@/data/tiers'
import { TIER_ORDER, ZODIAC_PER_SUIT_FOR_PROMOTE } from '@/data/tiers'

export interface Session {
  nickname: string
  companionEchoId: string
  createdAt: number
}

export type GameId = 'guess' | 'werewolf'

export interface GameRecord {
  played: number
  won: number
}

export interface Companion {
  echoId: string
  customName: string
  style: 'calm' | 'sharp' | 'warm' | 'balanced'
  memorySlots: number
  bond: number
}

export interface EchoMemory {
  met: boolean
  wonAgainst: number
  lostTo: number
  note: string[]
}

export type TouchResult = 'met' | 'win' | 'lose'

export interface ProfileState {
  session: Session | null
  fragments: Record<Suit, number>
  records: Record<GameId, GameRecord>
  /** 各游戏 MVP 次数（recordResult 的 mvp 参数累计） */
  mvps: Record<GameId, number>
  zodiac: Record<Suit, number[]>
  winsTowardZodiac: Record<Suit, number>
  tier: Tier
  companion: Companion | null
  echoMemories: Record<string, EchoMemory>
  unlockedLore: number[]

  login: (nickname: string, echoId: string) => void
  logout: () => void
  rename: (nickname: string) => void
  addFragments: (suit: Suit, n: number) => void
  spendFragments: (suit: Suit, n: number) => boolean
  recordResult: (game: GameId, won: boolean, mvp?: boolean) => void
  addWin: (suit: Suit) => boolean
  tryPromote: () => boolean
  updateCompanion: (patch: Partial<Companion>) => void
  touchEcho: (echoId: string, result: TouchResult, note?: string) => void
  unlockLore: (id: number) => boolean
}

// 开局补给：新旅人立契时由「牌局之间」发放，保证首日可付门票入场。
const starterFragments = (): Record<Suit, number> => ({ spade: 60, heart: 30, club: 60, diamond: 30 })
const emptyZodiac = (): Record<Suit, number[]> => ({ spade: [], heart: [], club: [], diamond: [] })
const emptyWins = (): Record<Suit, number> => ({ spade: 0, heart: 0, club: 0, diamond: 0 })

const initialProgress = () => ({
  fragments: starterFragments(),
  records: { guess: { played: 0, won: 0 }, werewolf: { played: 0, won: 0 } } as Record<GameId, GameRecord>,
  mvps: { guess: 0, werewolf: 0 } as Record<GameId, number>,
  zodiac: emptyZodiac(),
  winsTowardZodiac: emptyWins(),
  tier: 'huang' as Tier,
  companion: null as Companion | null,
  echoMemories: {} as Record<string, EchoMemory>,
  unlockedLore: [] as number[],
})

export const useProfile = create<ProfileState>()(
  persist(
    (set, get) => ({
      session: null,
      ...initialProgress(),

      login: (nickname, echoId) => {
        const echo = getEcho(echoId)
        // 新的十日：重置全部进度
        set({
          ...initialProgress(),
          session: { nickname, companionEchoId: echoId, createdAt: Date.now() },
          companion: {
            echoId,
            customName: echo?.name ?? '影从',
            style: 'balanced',
            memorySlots: 3,
            bond: 1,
          },
        })
        get().touchEcho(echoId, 'met', `第 1 日 · 与${echo?.name ?? '影从'}立契`)
      },

      logout: () => set({ session: null }),

      rename: (nickname) =>
        set((s) => (s.session ? { session: { ...s.session, nickname } } : s)),

      addFragments: (suit, n) =>
        set((s) => ({ fragments: { ...s.fragments, [suit]: Math.max(0, s.fragments[suit] + n) } })),

      spendFragments: (suit, n) => {
        const cur = get().fragments[suit]
        if (cur < n) return false
        set((s) => ({ fragments: { ...s.fragments, [suit]: cur - n } }))
        return true
      },

      recordResult: (game, won, mvp) =>
        set((s) => ({
          records: {
            ...s.records,
            [game]: { played: s.records[game].played + 1, won: s.records[game].won + (won ? 1 : 0) },
          },
          mvps: mvp ? { ...s.mvps, [game]: s.mvps[game] + 1 } : s.mvps,
        })),

      addWin: (suit) => {
        const { zodiac, winsTowardZodiac } = get()
        if (zodiac[suit].length >= 12) return false // 已满，仅算胜场累计在外层
        const wins = winsTowardZodiac[suit] + 1
        if (wins < WINS_PER_ZODIAC) {
          set((s) => ({ winsTowardZodiac: { ...s.winsTowardZodiac, [suit]: wins } }))
          return false
        }
        // 点亮下一枚未点亮生肖（按 0-11 顺序）
        const lit = zodiac[suit]
        let next = -1
        for (let i = 0; i < 12; i++) if (!lit.includes(i)) { next = i; break }
        if (next === -1) return false
        set((s) => ({
          zodiac: { ...s.zodiac, [suit]: [...lit, next].sort((a, b) => a - b) },
          winsTowardZodiac: { ...s.winsTowardZodiac, [suit]: 0 },
        }))
        return true
      },

      tryPromote: () => {
        const { zodiac, tier } = get()
        const ready = SUITS.every((suit) => zodiac[suit].length >= ZODIAC_PER_SUIT_FOR_PROMOTE)
        if (!ready) return false
        const idx = TIER_ORDER.indexOf(tier)
        if (idx >= TIER_ORDER.length - 1) return false
        set({
          tier: TIER_ORDER[idx + 1],
          zodiac: emptyZodiac(),
          winsTowardZodiac: emptyWins(),
        })
        return true
      },

      updateCompanion: (patch) =>
        set((s) => (s.companion ? { companion: { ...s.companion, ...patch } } : s)),

      touchEcho: (echoId, result, note) =>
        set((s) => {
          const prev: EchoMemory = s.echoMemories[echoId] ?? { met: false, wonAgainst: 0, lostTo: 0, note: [] }
          const notes = note && !prev.note.includes(note) ? [...prev.note, note].slice(-20) : prev.note
          return {
            echoMemories: {
              ...s.echoMemories,
              [echoId]: {
                met: true,
                wonAgainst: prev.wonAgainst + (result === 'win' ? 1 : 0),
                lostTo: prev.lostTo + (result === 'lose' ? 1 : 0),
                note: notes,
              },
            },
          }
        }),

      unlockLore: (id) => {
        const { unlockedLore } = get()
        if (unlockedLore.includes(id)) return false
        set({ unlockedLore: [...unlockedLore, id].sort((a, b) => a - b) })
        return true
      },
    }),
    { name: 'ten-days-gambit-profile' },
  ),
)

/** 便捷选择器 */
export const selectIsLoggedIn = (s: ProfileState) => s.session !== null

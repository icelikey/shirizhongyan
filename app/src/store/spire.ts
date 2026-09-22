/**
 * 碎境爬塔 · Run 状态 store（zustand + persist，冻结契约）
 * 战斗组（S1）与地图组（S2）共同依赖。
 *
 * 用法约定：
 * - SpireHub：startRun(style) 开新局；继续牌局 = 直接渲染已持久化的 run。
 * - SpireMap：initFloorMap(nodes) 写入生成的层地图；enterNode / completeNode 推进；
 *   战斗类节点 setCombat({enemyIds,nodeType,nodeId}) 后 navigate 战斗页。
 * - SpireCombat：读 combat/deck/relics/potions/hp 初始化本地战斗态，
 *   结束后 endCombat({win,hp,...}) 回写；Boss 胜利由地图页 proceedFloor() 或 endRun(true)。
 * - 碎片奖励一律在各自页面即时调用 profile store 的 addFragments('diamond', n)。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DeckStyle, EventEffect, MapNode, NodeType } from '@/data/spire/types'

export interface SpireStats {
  runs: number
  victories: number
  bestFloor: number
  kills: number
}

export interface CombatRef {
  enemyIds: string[]
  nodeType: NodeType
  nodeId: string
}

interface SpireState {
  phase: 'idle' | 'map' | 'combat' | 'gameover' | 'victory'
  runId: string
  style: DeckStyle | null
  floor: number // 1-3
  hp: number
  maxHp: number
  gold: number
  deck: string[] // 卡牌 id；升级版以 '+id' 存储
  relics: string[]
  potions: string[]
  curseCount: number
  map: MapNode[]
  currentNodeId: string | null
  combat: CombatRef | null
  kills: number
  stats: SpireStats

  startRun: (style: DeckStyle, startDeck: string[], startRelic: string) => void
  abandonRun: () => void
  initFloorMap: (nodes: MapNode[]) => void
  enterNode: (nodeId: string) => void
  completeNode: (nodeId: string) => void
  reachableNodeIds: () => string[]
  setCombat: (c: CombatRef | null) => void
  endCombat: (r: { win: boolean; hp: number; gold: number; kills: number }) => void
  proceedFloor: (nodes: MapNode[]) => void
  endRun: (win: boolean) => void
  addCard: (id: string) => void
  removeCard: (id: string) => void
  upgradeCard: (id: string) => void
  addRelic: (id: string) => void
  addPotion: (id: string) => boolean // 栏满返回 false
  consumePotion: (id: string) => void
  heal: (n: number) => void
  damage: (n: number) => void
  addGold: (n: number) => void
  spendGold: (n: number) => boolean
  applyEventEffects: (effects: EventEffect[]) => void
}

const STARTER_GOLD = 99
const MAX_POTIONS = 3

export const useSpire = create<SpireState>()(
  persist(
    (set, get) => ({
      phase: 'idle',
      runId: '',
      style: null,
      floor: 1,
      hp: 72,
      maxHp: 72,
      gold: STARTER_GOLD,
      deck: [],
      relics: [],
      potions: [],
      curseCount: 0,
      map: [],
      currentNodeId: null,
      combat: null,
      kills: 0,
      stats: { runs: 0, victories: 0, bestFloor: 0, kills: 0 },

      startRun: (style, startDeck, startRelic) =>
        set((s) => ({
          phase: 'map',
          runId: `run-${Date.now()}`,
          style,
          floor: 1,
          hp: 72,
          maxHp: 72,
          gold: STARTER_GOLD,
          deck: startDeck,
          relics: [startRelic],
          potions: [],
          curseCount: 0,
          map: [],
          currentNodeId: null,
          combat: null,
          kills: 0,
          stats: { ...s.stats, runs: s.stats.runs + 1 },
        })),

      abandonRun: () =>
        set({ phase: 'idle', map: [], combat: null, currentNodeId: null, style: null }),

      initFloorMap: (nodes) => set({ map: nodes }),

      enterNode: (nodeId) => set({ currentNodeId: nodeId }),

      completeNode: (nodeId) =>
        set((s) => ({
          map: s.map.map((n) => (n.id === nodeId ? { ...n, done: true } : n)),
        })),

      reachableNodeIds: () => {
        const { map, currentNodeId } = get()
        if (map.length === 0) return []
        if (!currentNodeId) return map.filter((n) => n.row === 0).map((n) => n.id)
        const cur = map.find((n) => n.id === currentNodeId)
        return cur ? cur.next : []
      },

      setCombat: (c) => set({ combat: c, phase: c ? 'combat' : get().phase }),

      endCombat: ({ win, hp, gold, kills }) =>
        set((s) => ({
          phase: win ? 'map' : 'gameover',
          hp: Math.max(0, hp),
          gold: s.gold + gold,
          kills: s.kills + kills,
          combat: null,
          stats: { ...s.stats, kills: s.stats.kills + kills, bestFloor: Math.max(s.stats.bestFloor, s.floor) },
        })),

      proceedFloor: (nodes) =>
        set((s) => ({
          floor: s.floor + 1,
          map: nodes,
          currentNodeId: null,
          stats: { ...s.stats, bestFloor: Math.max(s.stats.bestFloor, s.floor) },
        })),

      endRun: (win) =>
        set((s) => ({
          phase: win ? 'victory' : 'gameover',
          combat: null,
          stats: {
            ...s.stats,
            victories: s.stats.victories + (win ? 1 : 0),
            bestFloor: Math.max(s.stats.bestFloor, win ? 3 : s.floor),
          },
        })),

      addCard: (id) => set((s) => ({ deck: [...s.deck, id] })),

      removeCard: (id) =>
        set((s) => {
          const i = s.deck.indexOf(id)
          if (i < 0) return s
          const deck = [...s.deck]
          deck.splice(i, 1)
          return { deck }
        }),

      upgradeCard: (id) =>
        set((s) => {
          const i = s.deck.indexOf(id)
          if (i < 0) return s
          const deck = [...s.deck]
          deck[i] = `+${id}`
          return { deck }
        }),

      addRelic: (id) => set((s) => ({ relics: [...s.relics, id] })),

      addPotion: (id) => {
        const s = get()
        if (s.potions.length >= MAX_POTIONS) return false
        set({ potions: [...s.potions, id] })
        return true
      },

      consumePotion: (id) =>
        set((s) => {
          const i = s.potions.indexOf(id)
          if (i < 0) return s
          const potions = [...s.potions]
          potions.splice(i, 1)
          return { potions }
        }),

      heal: (n) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + n) })),
      damage: (n) => set((s) => ({ hp: Math.max(0, s.hp - n) })),
      addGold: (n) => set((s) => ({ gold: Math.max(0, s.gold + n) })),

      spendGold: (n) => {
        const s = get()
        if (s.gold < n) return false
        set({ gold: s.gold - n })
        return true
      },

      applyEventEffects: (effects) => {
        const g = get()
        for (const e of effects) {
          switch (e.kind) {
            case 'hp':
              e.value >= 0 ? g.heal(e.value) : g.damage(-e.value)
              break
            case 'maxHp':
              set((s) => ({ maxHp: Math.max(1, s.maxHp + e.value) }))
              if (e.value > 0) g.heal(e.value)
              break
            case 'gold':
              g.addGold(e.value)
              break
            case 'card':
            case 'curse':
              if (e.refId) g.addCard(e.refId)
              if (e.kind === 'curse') set((s) => ({ curseCount: s.curseCount + 1 }))
              break
            case 'relic':
              if (e.refId) g.addRelic(e.refId)
              break
            case 'potion':
              if (e.refId) g.addPotion(e.refId)
              break
            case 'removeCard':
              break // 由页面交互选牌后调用 removeCard
          }
        }
      },
    }),
    {
      name: 'ten-days-gambit-spire',
      partialize: (s) => ({
        phase: s.phase,
        runId: s.runId,
        style: s.style,
        floor: s.floor,
        hp: s.hp,
        maxHp: s.maxHp,
        gold: s.gold,
        deck: s.deck,
        relics: s.relics,
        potions: s.potions,
        curseCount: s.curseCount,
        map: s.map,
        currentNodeId: s.currentNodeId,
        combat: s.combat,
        kills: s.kills,
        stats: s.stats,
      }),
    },
  ),
)

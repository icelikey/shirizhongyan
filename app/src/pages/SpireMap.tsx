/**
 * ============================================================================
 * 碎境爬塔 · 分支地图页 `/game/spire/map`（spire-map.md §3，S2）
 * ============================================================================
 * - 无地图时按 runId 种子生成并 initFloorMap；战斗节点 setCombat → 战斗页；
 *   篝火/宝箱/商店/事件弹层；节点完成回写 completeNode。
 * - 战斗胜利回流（phase combat → map，当前战斗节点未 done）：
 *   普通/精英 → completeNode；Boss → + completeNode + addWin('diamond')，
 *   第 3 层 → endRun(true) + addFragments('diamond',60) + 通关演出，
 *   否则 proceedFloor(新层图)。
 * - 顶栏：HP/金币/层数/牌组抽屉/遗物栏/药水栏。
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useSpire } from '@/store/spire'
import { useProfile } from '@/store/profile'
import type { EventDef, MapNode } from '@/data/spire/types'
import { generateFloor } from '@/game/mapgen'
import {
  floorBoss, pickBattleEnemies, pickEliteEnemies, randomRelicId, useSpireDataReady,
} from '@/game/spire-data'
import { pickEvent } from '@/data/spire/events'
import SpireTopBar from '@/components/spire/SpireTopBar'
import SpireMapCanvas from '@/components/spire/SpireMapCanvas'
import type { TravelState } from '@/components/spire/SpireMapCanvas'
import DeckDrawer from '@/components/spire/DeckDrawer'
import RestModal from '@/components/spire/RestModal'
import TreasureModal from '@/components/spire/TreasureModal'
import ShopModal from '@/components/spire/ShopModal'
import { genShopStock } from '@/game/shop'
import type { ShopStock } from '@/game/shop'
import EventModal from '@/components/spire/EventModal'
import { GameOverOverlay, VictoryOverlay } from '@/components/spire/RunEndOverlay'

type ModalState =
  | { kind: 'rest'; nodeId: string }
  | { kind: 'treasure'; nodeId: string; gold: number; relicId: string | null }
  | { kind: 'shop'; nodeId: string; stock: ShopStock }
  | { kind: 'event'; nodeId: string; event: EventDef }

const COMBAT_TYPES = new Set(['battle', 'elite', 'boss'])

export default function SpireMap() {
  const navigate = useNavigate()
  useSpireDataReady()

  const phase = useSpire((s) => s.phase)
  const runId = useSpire((s) => s.runId)
  const floor = useSpire((s) => s.floor)
  const map = useSpire((s) => s.map)
  const currentNodeId = useSpire((s) => s.currentNodeId)
  const deck = useSpire((s) => s.deck)
  const relics = useSpire((s) => s.relics)
  const initFloorMap = useSpire((s) => s.initFloorMap)
  const enterNode = useSpire((s) => s.enterNode)
  const completeNode = useSpire((s) => s.completeNode)
  const setCombat = useSpire((s) => s.setCombat)
  const proceedFloor = useSpire((s) => s.proceedFloor)
  const endRun = useSpire((s) => s.endRun)
  const abandonRun = useSpire((s) => s.abandonRun)
  const addFragments = useProfile((s) => s.addFragments)

  const [travel, setTravel] = useState<TravelState | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [deckOpen, setDeckOpen] = useState(false)
  const lastEventRef = useRef<string | undefined>(undefined)

  /* 路由守卫：无局 → 门厅；战斗中 → 战斗页 */
  useEffect(() => {
    if (phase === 'idle') navigate('/game/spire', { replace: true })
    else if (phase === 'combat') navigate('/game/spire/combat', { replace: true })
  }, [phase, navigate])

  /* 地图生成（同 run 同层恒定，存 store） */
  useEffect(() => {
    if (phase === 'map' && runId && map.length === 0) {
      initFloorMap(generateFloor(runId, floor))
    }
  }, [phase, runId, floor, map.length, initFloorMap])

  /* 战斗胜利回流：phase 'combat'→'map' 后，当前战斗节点未 done → 结算 */
  useEffect(() => {
    if (phase !== 'map' || !currentNodeId) return
    const node = map.find((n) => n.id === currentNodeId)
    if (!node || node.done || !COMBAT_TYPES.has(node.type)) return
    if (useSpire.getState().combat) return // 刚出发进战斗（批处理极端兜底）
    completeNode(node.id)
    if (node.type === 'boss') {
      // 注：addWin('diamond') 已在战斗页 Boss 奖励结算时调用，此处不再重复计数
      if (floor >= 3) {
        addFragments('diamond', 60)
        endRun(true)
      } else {
        proceedFloor(generateFloor(runId, floor + 1))
      }
    }
  }, [phase, map, currentNodeId, floor, runId, completeNode, proceedFloor, endRun, addFragments])

  // travel 中保持可达光晕（点击由画布 travel 守卫拦截）；弹层打开时熄灭
  const reachable = useMemo(
    () => (phase === 'map' && !modal ? useSpire.getState().reachableNodeIds() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, map, currentNodeId, modal],
  )

  /* 抵达节点 → 触发节点逻辑 */
  const arrive = (node: MapNode) => {
    enterNode(node.id)
    switch (node.type) {
      case 'battle':
        setCombat({ enemyIds: pickBattleEnemies(floor), nodeType: 'battle', nodeId: node.id })
        navigate('/game/spire/combat')
        break
      case 'elite':
        setCombat({ enemyIds: pickEliteEnemies(floor), nodeType: 'elite', nodeId: node.id })
        navigate('/game/spire/combat')
        break
      case 'boss':
        setCombat({ enemyIds: [floorBoss(floor)], nodeType: 'boss', nodeId: node.id })
        navigate('/game/spire/combat')
        break
      case 'rest':
        setModal({ kind: 'rest', nodeId: node.id })
        break
      case 'treasure':
        setModal({
          kind: 'treasure',
          nodeId: node.id,
          gold: 25 + Math.floor(Math.random() * 26),
          relicId: Math.random() < 0.3 ? randomRelicId(relics) : null,
        })
        break
      case 'shop':
        setModal({ kind: 'shop', nodeId: node.id, stock: genShopStock(relics) })
        break
      case 'event': {
        const ev = pickEvent(Math.random, lastEventRef.current)
        lastEventRef.current = ev.id
        setModal({ kind: 'event', nodeId: node.id, event: ev })
        break
      }
    }
  }

  const pickNode = (node: MapNode) => {
    if (travel || modal) return
    setTravel({ fromId: currentNodeId, toId: node.id })
  }

  const closeModal = () => {
    if (modal) completeNode(modal.nodeId)
    setModal(null)
  }

  const leaveRun = () => {
    abandonRun()
    navigate('/game/spire')
  }

  return (
    <div className="-mt-16 flex h-[100dvh] flex-col pt-16">
      <SpireTopBar onOpenDeck={() => setDeckOpen(true)} />

      {/* 地图画布 */}
      {map.length > 0 && (
        <SpireMapCanvas
          nodes={map}
          reachable={reachable}
          currentNodeId={currentNodeId}
          travel={travel}
          onArrive={() => {
            const target = travel ? map.find((n) => n.id === travel.toId) : null
            setTravel(null)
            if (target) arrive(target)
          }}
          onPickNode={pickNode}
        />
      )}

      {/* 牌组抽屉 */}
      <DeckDrawer open={deckOpen} deck={deck} onClose={() => setDeckOpen(false)} />

      {/* 节点弹层 */}
      <AnimatePresence>
        {modal?.kind === 'rest' && <RestModal key="rest" onDone={closeModal} />}
        {modal?.kind === 'treasure' && <TreasureModal key="treasure" gold={modal.gold} relicId={modal.relicId} onDone={closeModal} />}
        {modal?.kind === 'shop' && <ShopModal key="shop" stock={modal.stock} onLeave={closeModal} />}
        {modal?.kind === 'event' && <EventModal key="event" event={modal.event} onDone={closeModal} />}
      </AnimatePresence>

      {/* 终局演出 */}
      <AnimatePresence>
        {phase === 'victory' && <VictoryOverlay key="victory" onLeave={leaveRun} />}
        {phase === 'gameover' && <GameOverOverlay key="gameover" onLeave={leaveRun} />}
      </AnimatePresence>
    </div>
  )
}

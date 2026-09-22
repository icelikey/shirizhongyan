/**
 * ============================================================================
 * 碎境爬塔 · 分支地图画布（spire-map.md §3.2）
 * ============================================================================
 * - 竖向滚动画布：底 spire-map-bg.png 视差（0.18 速率），15 行节点自下而上。
 * - 节点 = 56px 圆形玺印（Boss 72px）：已走=金色点亮 / 可达=呼吸金光+点击涟漪
 *   / 其余=线稿暗态+迷雾。
 * - 旅人棋子（avatar-traveler）沿路径移动动画，抵达回调触发节点逻辑。
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { MapNode } from '@/data/spire/types'
import { layoutNodes } from '@/game/mapgen'
import type { NodePos } from '@/game/mapgen'
import { NodeGlyph } from '@/components/spire/icons'
import { cn } from '@/lib/utils'

const ROW_H = 118
const PAD_Y = 90
const NODE = 56
const BOSS_NODE = 76
const PARALLAX = 0.18
const BG_BLEED = 340

export interface TravelState {
  fromId: string | null
  toId: string
}

export interface SpireMapCanvasProps {
  nodes: MapNode[]
  reachable: string[]
  currentNodeId: string | null
  /** 非空 = 棋子移动中（抵达后回调 onArrive） */
  travel: TravelState | null
  onArrive: () => void
  onPickNode: (node: MapNode) => void
}

export default function SpireMapCanvas({ nodes, reachable, currentNodeId, travel, onArrive, onPickNode }: SpireMapCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(960)
  const [scrollY, setScrollY] = useState(0)
  const [ripple, setRipple] = useState<{ id: string; key: number } | null>(null)

  const contentH = PAD_Y * 2 + ROW_H * 14

  /* 容器宽度测量 */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  /* 归一化坐标 → px（y 自下而上） */
  const posMap = useMemo(() => layoutNodes(nodes), [nodes])
  const px = useCallback(
    (p: NodePos): NodePos => ({
      x: p.x * width,
      y: contentH - (PAD_Y + p.y * (contentH - PAD_Y * 2)),
    }),
    [width, contentH],
  )
  const posOf = useCallback(
    (id: string): NodePos | null => {
      const p = posMap.get(id)
      return p ? px(p) : null
    },
    [posMap, px],
  )

  const doneSet = useMemo(() => new Set(nodes.filter((n) => n.done).map((n) => n.id)), [nodes])

  /* 滚动定位：换层（新地图）→ 底部起点；落子（null → 节点）→ 居中该节点 */
  const mapKey = nodes[0]?.id ?? ''
  useEffect(() => {
    const el = scrollRef.current
    if (!el || nodes.length === 0) return
    const cur = currentNodeId ? posOf(currentNodeId) : null
    const target = cur ? cur.y - el.clientHeight / 2 : el.scrollHeight
    el.scrollTo({ top: target, behavior: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey, currentNodeId === null])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) setScrollY(el.scrollTop)
  }

  /* 棋子坐标（层初无当前节点 → 停在起点行下方） */
  const startPos: NodePos = { x: width / 2, y: contentH - PAD_Y + 46 }
  const pawnHome = currentNodeId ? posOf(currentNodeId) : startPos
  const travelFrom = travel?.fromId ? posOf(travel.fromId) : pawnHome
  const travelTo = travel ? posOf(travel.toId) : null
  const pawnPos = travel ? (travelTo ?? travelFrom) : pawnHome

  const pick = (node: MapNode) => {
    if (travel) return
    if (!reachable.includes(node.id)) return
    setRipple({ id: node.id, key: Date.now() })
    onPickNode(node)
  }

  return (
    <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div className="relative mx-auto" style={{ height: contentH, maxWidth: 1100 }}>
        {/* 视差底图 */}
        <div
          className="pointer-events-none absolute inset-x-0 will-change-transform"
          style={{ top: -BG_BLEED, bottom: -BG_BLEED, transform: `translateY(${scrollY * PARALLAX}px)` }}
        >
          <img src="/spire-map-bg.png" alt="" draggable={false} className="h-full w-full object-cover opacity-75" />
          <div className="absolute inset-0 bg-gradient-to-b from-abyss/85 via-abyss/35 to-abyss/85" />
          <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_45%,transparent_30%,rgba(7,6,11,.72)_100%)]" />
        </div>

        {/* 连线 */}
        <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
          {nodes.flatMap((n) =>
            n.next.map((tid) => {
              const a = posOf(n.id)
              const b = posOf(tid)
              if (!a || !b) return null
              const walked = doneSet.has(n.id)
              const lit = walked && doneSet.has(tid)
              return (
                <line
                  key={`${n.id}->${tid}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={lit ? 'rgba(242,169,59,.85)' : walked || reachable.includes(n.id) ? 'rgba(227,194,124,.4)' : 'rgba(227,194,124,.14)'}
                  strokeWidth={lit ? 2.4 : 1.4}
                  strokeDasharray={lit ? undefined : '5 6'}
                />
              )
            }),
          )}
        </svg>

        {/* 节点 */}
        {nodes.map((n) => {
          const p = posOf(n.id)
          if (!p) return null
          const isBoss = n.type === 'boss'
          const size = isBoss ? BOSS_NODE : NODE
          const done = n.done
          const canGo = reachable.includes(n.id) && !travel
          const isCurrent = n.id === currentNodeId
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => pick(n)}
              disabled={!canGo}
              title={isBoss ? '层主' : undefined}
              className={cn('group absolute z-10', canGo ? 'cursor-pointer' : 'cursor-default')}
              style={{ left: p.x - size / 2, top: p.y - size / 2, width: size, height: size }}
            >
              {/* 点击涟漪 */}
              {ripple?.id === n.id && (
                <motion.span
                  key={ripple.key}
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border-2 border-suit-diamond"
                />
              )}
              {/* 呼吸金光（可达） */}
              {canGo && (
                <span className="animate-breathe absolute -inset-2 rounded-full border border-suit-diamond/70" style={{ boxShadow: '0 0 22px rgba(242,169,59,.45)' }} />
              )}
              {/* 当前位置环 */}
              {isCurrent && <span className="absolute -inset-1.5 rounded-full border-2 border-gold-100/80" style={{ boxShadow: '0 0 14px rgba(248,233,192,.5)' }} />}
              {/* 玺印本体 */}
              <span
                className={cn(
                  'relative flex h-full w-full items-center justify-center rounded-full border transition-all duration-200',
                  isBoss && 'rounded-[16px]',
                  done
                    ? 'border-gold-100 text-[#2A1E0C]'
                    : canGo
                      ? 'border-suit-diamond bg-ink/90 text-suit-diamond group-hover:scale-110 group-hover:bg-suit-diamond/15'
                      : 'border-[rgba(227,194,124,.2)] bg-ink/70 text-faint',
                )}
                style={
                  done
                    ? {
                        background: 'linear-gradient(180deg,#F1D9A2 0%,#E3C27C 45%,#B9904A 100%)',
                        boxShadow: '0 0 18px rgba(227,194,124,.45), inset 0 1px 0 rgba(255,246,220,.7)',
                      }
                    : !canGo
                      ? { filter: 'saturate(.35) brightness(.75)' }
                      : { boxShadow: '0 0 14px rgba(242,169,59,.3)' }
                }
              >
                <NodeGlyph type={n.type} size={isBoss ? 38 : 24} />
              </span>
              {/* 迷雾罩（未达区域） */}
              {!done && !canGo && <span className="absolute -inset-3 rounded-full bg-abyss/35 blur-[6px]" style={{ zIndex: -1 }} />}
            </button>
          )
        })}

        {/* 旅人棋子 */}
        {pawnPos && (
          <motion.div
            className="pointer-events-none absolute z-20"
            initial={travel && travelFrom ? { x: travelFrom.x - 17, y: travelFrom.y - 66 } : { x: pawnPos.x - 17, y: pawnPos.y - 66 }}
            animate={{ x: pawnPos.x - 17, y: pawnPos.y - 66 }}
            transition={travel ? { duration: 0.68, ease: [0.22, 1, 0.36, 1] } : { duration: 0.2 }}
            onAnimationComplete={() => {
              if (travel) onArrive()
            }}
          >
            <div
              className="h-[34px] w-[34px] overflow-hidden rounded-full border-2 border-gold-300"
              style={{ boxShadow: '0 0 16px rgba(242,169,59,.65), 0 4px 10px rgba(0,0,0,.6)' }}
            >
              <img src="/avatar-traveler.png" alt="旅人" className="h-full w-full object-cover" draggable={false} />
            </div>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
              className="absolute -bottom-1 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full bg-suit-diamond/50 blur-[3px]"
            />
          </motion.div>
        )}
      </div>
    </div>
  )
}

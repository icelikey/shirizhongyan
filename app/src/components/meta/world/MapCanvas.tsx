/**
 * <MapCanvas> 世界地图画布（world.md §地图画布）。
 * map-sea.png 底图（1600×1000 内容层），拖拽平移 + 滚轮缩放（0.8–1.6，围绕光标），
 * 星桥航线（虚线 + 流动光点）、金色星尘 canvas（≤80 粒）、中央十日轮、四大陆浮岛。
 * 点击大陆：镜头推近（zoom → 1.35，600ms）并回调 onSelectContinent。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Compass, Minus, Plus } from 'lucide-react'
import { useProfile } from '@/store/profile'
import CountdownRing from '@/components/CountdownRing'
import ContinentIsland from '@/components/meta/world/ContinentIsland'
import type { ContinentMeta } from '@/components/meta/world/continents'
import { CONTINENTS, HUB, MAP_H, MAP_W } from '@/components/meta/world/continents'

interface View {
  x: number
  y: number
  k: number
}

const K_MIN = 0.8
const K_MAX = 1.6

const clampView = (v: View, cw: number, ch: number): View => {
  const w = MAP_W * v.k
  const h = MAP_H * v.k
  const x = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, v.x))
  const y = h <= ch ? (ch - h) / 2 : Math.min(0, Math.max(ch - h, v.y))
  return { ...v, x, y }
}

/** 星桥：中枢 → 大陆的弧线 path */
const bridgePath = (cx: number, cy: number): string => {
  const mx = (HUB.cx + cx) / 2
  const my = (HUB.cy + cy) / 2
  const dx = cx - HUB.cx
  const dy = cy - HUB.cy
  const len = Math.hypot(dx, dy) || 1
  // 垂直偏移 60px 营造弧线
  const nx = (-dy / len) * 60
  const ny = (dx / len) * 60
  return `M ${HUB.cx} ${HUB.cy} Q ${mx + nx} ${my + ny} ${cx} ${cy}`
}

export interface MapCanvasProps {
  onSelectContinent: (meta: ContinentMeta) => void
  onOpenJournal: () => void
  onGoLobby: () => void
}

export default function MapCanvas({ onSelectContinent, onOpenJournal, onGoLobby }: MapCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const dustRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 0.85 })
  const [smooth, setSmooth] = useState(true) // 聚焦/复位时 600ms 过渡；拖拽缩放时即时
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null)
  const totalLit = useProfile((s) => s.zodiac.spade.length + s.zodiac.heart.length + s.zodiac.club.length + s.zodiac.diamond.length)

  /* 初始居中 */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    setView((v) =>
      clampView(
        { ...v, x: (el.clientWidth - MAP_W * v.k) / 2, y: (el.clientHeight - MAP_H * v.k) / 2 },
        el.clientWidth,
        el.clientHeight,
      ),
    )
  }, [])

  /* 滚轮缩放（围绕光标）—— 需要 passive:false 才能 preventDefault */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setSmooth(false)
      setView((v) => {
        const k2 = Math.min(K_MAX, Math.max(K_MIN, v.k * (e.deltaY < 0 ? 1.12 : 0.89)))
        const r = k2 / v.k
        return clampView({ k: k2, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r }, el.clientWidth, el.clientHeight)
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* 金色星尘（≤80 粒，缓慢漂移） */
  useEffect(() => {
    const canvas = dustRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let w = 0
    let h = 0
    const resize = () => {
      w = wrap.clientWidth
      h = wrap.clientHeight
      canvas.width = w
      canvas.height = h
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const dots = Array.from({ length: 80 }).map(() => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.5 + Math.random() * 1.1,
      vx: (Math.random() - 0.5) * 0.00012,
      vy: (Math.random() - 0.5) * 0.00008,
      p: Math.random() * Math.PI * 2,
    }))
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        d.x = (d.x + d.vx + 1) % 1
        d.y = (d.y + d.vy + 1) % 1
        const a = 0.18 + 0.3 * (0.5 + 0.5 * Math.sin(t / 1400 + d.p))
        ctx.beginPath()
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(227,194,124,${a.toFixed(3)})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  /* 拖拽平移 */
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-island], button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }
    setSmooth(false)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    const el = wrapRef.current
    if (!d || !el) return
    setView((v) => clampView({ ...v, x: d.vx + (e.clientX - d.px), y: d.vy + (e.clientY - d.py) }, el.clientWidth, el.clientHeight))
  }
  const onPointerUp = () => {
    drag.current = null
  }

  const focusContinent = useCallback((meta: ContinentMeta) => {
    const el = wrapRef.current
    if (!el) return
    setSmooth(true)
    setView(() => {
      const k = 1.35
      return clampView({ k, x: el.clientWidth / 2 - meta.cx * k, y: el.clientHeight / 2 - meta.cy * k }, el.clientWidth, el.clientHeight)
    })
  }, [])

  const resetView = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    setSmooth(true)
    setView(() => {
      const k = 0.85
      return clampView(
        { k, x: (el.clientWidth - MAP_W * k) / 2, y: (el.clientHeight - MAP_H * k) / 2 },
        el.clientWidth,
        el.clientHeight,
      )
    })
  }, [])

  const zoomBy = (f: number) => {
    const el = wrapRef.current
    if (!el) return
    setSmooth(true)
    setView((v) => {
      const k2 = Math.min(K_MAX, Math.max(K_MIN, v.k * f))
      const r = k2 / v.k
      const mx = el.clientWidth / 2
      const my = el.clientHeight / 2
      return clampView({ k: k2, x: mx - (mx - v.x) * r, y: my - (my - v.y) * r }, el.clientWidth, el.clientHeight)
    })
  }

  const handleSelect = (meta: ContinentMeta) => {
    focusContinent(meta)
    onSelectContinent(meta)
  }

  const counterScale = Math.min(1.15, Math.max(0.85, 1 / view.k))

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-[56dvh] w-full touch-none select-none overflow-hidden rounded-[14px] border border-[rgba(227,194,124,.15)] bg-abyss/60 shadow-panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
    >
      {/* 地图内容层 */}
      <div
        className="absolute left-0 top-0"
        style={{
          width: MAP_W,
          height: MAP_H,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
          transformOrigin: '0 0',
          transition: smooth ? 'transform .6s cubic-bezier(.22,1,.36,1)' : 'none',
        }}
      >
        {/* 底图 */}
        <img
          src="/map-sea.png"
          alt="星云海图"
          width={MAP_W}
          height={MAP_H}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-90"
        />

        {/* 星桥航线 */}
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="absolute inset-0 h-full w-full">
          <style>{`@keyframes meta-bridge-dash { to { stroke-dashoffset: -140; } }`}</style>
          {CONTINENTS.map((c) => {
            const d = bridgePath(c.cx, c.cy)
            return (
              <g key={c.suit}>
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(227,194,124,.35)"
                  strokeWidth="1.4"
                  strokeDasharray="4 10"
                  style={{ animation: 'meta-bridge-dash 6s linear infinite' }}
                />
                <circle r="3" fill="#F8E9C0" opacity="0.9">
                  <animateMotion dur="6s" repeatCount="indefinite" path={d} />
                </circle>
              </g>
            )
          })}
        </svg>

        {/* 中央十日轮（世界中枢） */}
        <div
          className="absolute flex flex-col items-center"
          style={{ left: HUB.cx, top: HUB.cy, transform: `translate(-50%,-50%) scale(${counterScale})` }}
        >
          <motion.button
            type="button"
            onClick={onOpenJournal}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="group relative rounded-full"
            title="十日志"
          >
            <CountdownRing variant="hero" size={220}>
              <img src="/eclipse-suns.png" alt="十日轮" className="h-full w-full object-contain" draggable={false} />
            </CountdownRing>
            <span className="absolute inset-0 rounded-full border border-[rgba(227,194,124,.15)] transition-all duration-300 group-hover:border-[rgba(246,227,180,.5)] group-hover:shadow-gold-glow" />
          </motion.button>
          <span className="vertical-rl mt-3 font-mashan text-[13px] tracking-[.3em] text-gold-500/80">牌局之间 · 中枢</span>
          {/* 新用户引导气泡 */}
          {totalLit === 0 && (
            <motion.button
              type="button"
              onClick={onGoLobby}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="mt-2 animate-breathe rounded-full border border-gold-300/50 bg-ink/90 px-4 py-1.5 text-[11px] tracking-wider text-gold-300 shadow-gold-glow"
            >
              从青野或玄渊开始你的第一局 →
            </motion.button>
          )}
        </div>

        {/* 四大陆 */}
        <div data-island="">
          {CONTINENTS.map((c, i) => (
            <ContinentIsland key={c.suit} meta={c} counterScale={counterScale} enterDelay={0.15 + i * 0.15} onSelect={handleSelect} />
          ))}
        </div>
      </div>

      {/* 星尘层 */}
      <canvas ref={dustRef} className="pointer-events-none absolute inset-0" />

      {/* 缩放控制 */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => zoomBy(1.2)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(227,194,124,.3)] bg-ink/80 text-gold-300 backdrop-blur transition-colors hover:border-[rgba(246,227,180,.55)]"
          aria-label="放大"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.84)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(227,194,124,.3)] bg-ink/80 text-gold-300 backdrop-blur transition-colors hover:border-[rgba(246,227,180,.55)]"
          aria-label="缩小"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={resetView}
          title="全景"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(227,194,124,.3)] bg-ink/80 text-gold-300 backdrop-blur transition-colors hover:border-[rgba(246,227,180,.55)]"
          aria-label="全景"
        >
          <Compass size={14} />
        </button>
      </div>
    </div>
  )
}

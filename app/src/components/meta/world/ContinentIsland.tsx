/**
 * <ContinentIsland> 大陆浮岛（world.md §四块大陆）。
 * continent-*.png + 花色光晕 + 岛下名牌 + 环绕 12 生肖印（椭圆轨道）+ 主场/迷雾角标。
 * 常态浮动 ±8px（周期错开）；悬停 3D 倾斜 + 亮度提升 + 光晕扩散；迷雾岛罩 40% 雾。
 */
import { memo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { SUIT_META } from '@/data/echoes'
import { ZODIAC } from '@/data/zodiac'
import SuitIcon from '@/components/SuitIcon'
import ZodiacSeal from '@/components/ZodiacSeal'
import type { ContinentMeta } from '@/components/meta/world/continents'
import { cn } from '@/lib/utils'

export interface ContinentIslandProps {
  meta: ContinentMeta
  /** 反向缩放（保持名牌/生肖章可读，0.85–1.15 clamp） */
  counterScale: number
  /** 入场延迟（自四角漂入 stagger） */
  enterDelay: number
  onSelect: (meta: ContinentMeta) => void
}

const ISLAND_W = 340

function ContinentIslandInner({ meta, counterScale, enterDelay, onSelect }: ContinentIslandProps) {
  const lit = useProfile((s) => s.zodiac[meta.suit])
  const wins = useProfile((s) => s.winsTowardZodiac[meta.suit])
  const suit = SUIT_META[meta.suit]
  const ref = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState('')
  const [hover, setHover] = useState(false)

  const nextIdx = ZODIAC.find((z) => !lit.includes(z.index))?.index ?? -1

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTf(`perspective(900px) rotateY(${(px * 10).toFixed(2)}deg) rotateX(${(-py * 10).toFixed(2)}deg)`)
  }

  return (
    <div
      className="absolute"
      style={{ left: meta.cx, top: meta.cy, transform: 'translate(-50%,-50%)' }}
    >
      {/* 常态浮动 ±8px */}
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: meta.floatDur, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 40 }}
          animate={{ opacity: 1, scale: counterScale, y: 0 }}
          transition={{ duration: 0.8, delay: enterDelay, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'center center' }}
        >
          <div
            ref={ref}
            onMouseMove={onMove}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => {
              setTf('')
              setHover(false)
            }}
            onClick={() => onSelect(meta)}
            className="relative cursor-pointer transition-transform duration-200 ease-out"
            style={{ width: ISLAND_W, transform: tf, transformStyle: 'preserve-3d' }}
            role="button"
            aria-label={`${meta.name}大陆`}
          >
            {/* 岛底花色光晕（悬于花色海面） */}
            <div
              className="absolute left-1/2 top-[62%] -z-10 h-[240px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-500"
              style={{
                background: `radial-gradient(50% 50% at 50% 50%, ${suit.glow} 0%, transparent 70%)`,
                opacity: hover ? 1 : 0.65,
                transform: `translate(-50%,-50%) scale(${hover ? 1.15 : 1})`,
              }}
            />

            {/* 生肖光环（椭圆轨道 12 枚） */}
            <div className="pointer-events-auto absolute inset-x-[-30px] top-[-46px] bottom-[30px]">
              {ZODIAC.map((z, i) => {
                const a = -Math.PI / 2 + (i * 2 * Math.PI) / 12
                const x = 50 + 50 * Math.cos(a) // %
                const y = 50 + 50 * Math.sin(a)
                const isLit = lit.includes(z.index)
                const isCurrent = z.index === nextIdx
                return (
                  <span
                    key={z.index}
                    className="absolute"
                    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
                  >
                    <ZodiacSeal
                      index={z.index}
                      lit={isLit}
                      progress={isCurrent ? wins : 0}
                      size={28}
                      className={cn(isCurrent && !isLit && 'animate-breathe border-gold-300/60')}
                    />
                  </span>
                )
              })}
            </div>

            {/* 岛体插画 */}
            <img
              src={meta.image}
              alt={`${meta.name}大陆`}
              width={ISLAND_W}
              draggable={false}
              className="w-full rounded-[14px] transition-all duration-300"
              style={{
                filter: hover ? 'brightness(1.15)' : 'brightness(1)',
                boxShadow: `0 24px 60px rgba(0,0,0,.65), 0 0 ${hover ? 40 : 24}px ${suit.glow}`,
              }}
            />

            {/* 迷雾罩（未开启大陆） */}
            {meta.locked && (
              <div
                className={cn(
                  'absolute inset-0 flex items-center justify-center rounded-[14px] backdrop-blur-[2px] transition-opacity duration-500',
                  hover ? 'opacity-25' : 'opacity-40',
                )}
                style={{ background: 'linear-gradient(180deg, rgba(20,16,26,.55), rgba(7,6,11,.75))' }}
              >
                <span className="flex flex-col items-center gap-1.5 text-faint">
                  <Lock size={20} />
                  <span className="text-[10px] tracking-[.2em]">迷雾笼罩 · 第 2 个十日开启</span>
                </span>
              </div>
            )}

            {/* 岛下名牌 */}
            <div className="mt-2 flex flex-col items-center gap-1 text-center">
              <div className="flex items-center gap-2">
                <span style={{ color: suit.color }}>
                  <SuitIcon suit={meta.suit} size={18} glow />
                </span>
                <span className="gold-text font-serifsc text-[26px] font-black tracking-[.15em]">{meta.name}</span>
              </div>
              <span className="text-[11px] tracking-[.25em] text-dim">{meta.theme}</span>
              <span
                className="mt-1 rounded-full border px-2.5 py-0.5 text-[10px] tracking-wider"
                style={
                  meta.locked
                    ? { borderColor: 'rgba(227,194,124,.15)', color: '#6E6880' }
                    : { borderColor: `${suit.color}66`, color: suit.color, background: `${suit.color}14` }
                }
              >
                {meta.locked ? '迷雾笼罩' : meta.homeLabel}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}

const ContinentIsland = memo(ContinentIslandInner)
export default ContinentIsland

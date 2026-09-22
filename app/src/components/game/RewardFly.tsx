/**
 * 碎片飞行 RewardFly（design.md §7.2.3）：
 * 结算时奖励碎片从面板中心沿弧线飞入右上角碎片计数（8–12 枚，错峰 40ms）。
 */
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'

export interface RewardFlyProps {
  suit: Suit
  /** 是否播放 */
  show: boolean
  /** 碎片枚数（默认 10，≤12） */
  pieces?: number
  onDone?: () => void
}

export default function RewardFly({ suit, show, pieces = 10, onDone }: RewardFlyProps) {
  const meta = SUIT_META[suit]
  const count = Math.min(12, Math.max(8, pieces))
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => i), [count])

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[90] pointer-events-none">
          {seeds.map((i) => {
            const spreadX = ((i % 4) - 1.5) * 46
            const spreadY = (Math.floor(i / 4) - 1) * 34
            const delay = i * 0.04
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2"
                initial={{ x: spreadX, y: spreadY, scale: 0.4, opacity: 0 }}
                animate={{
                  x: [spreadX, spreadX * 2.4, window.innerWidth / 2 - 90 - i * 4],
                  y: [spreadY, spreadY - 90, -window.innerHeight / 2 + 40],
                  scale: [0.4, 1.25, 0.5],
                  opacity: [0, 1, 0.9],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.95, delay, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.35, 1] }}
                onAnimationComplete={i === count - 1 ? onDone : undefined}
              >
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-full bg-ink border"
                  style={{ borderColor: meta.color, boxShadow: `0 0 12px ${meta.glow}`, color: meta.color }}
                >
                  <SuitIcon suit={suit} size={14} />
                </span>
              </motion.span>
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}

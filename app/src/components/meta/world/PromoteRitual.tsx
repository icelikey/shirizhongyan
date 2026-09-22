/**
 * <PromoteRitual> 升阶仪式演出（world.md §边界与细节 + design.md §7.2.6 印章落定）。
 * 全屏金色墨染 → 新位阶玉玺 1.4x + 旋转砸下（spring）→ 位阶名金字 → 2.4s 后收束。
 */
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Tier } from '@/data/tiers'
import { getTier } from '@/data/tiers'
import TierSeal from '@/components/TierSeal'

export interface PromoteRitualProps {
  /** 非 null 时播放演出（晋升后的新位阶） */
  tier: Tier | null
  onDone: () => void
}

export default function PromoteRitual({ tier, onDone }: PromoteRitualProps) {
  useEffect(() => {
    if (!tier) return
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [tier, onDone])

  const meta = tier ? getTier(tier) : null

  return (
    <AnimatePresence>
      {tier && meta && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[96] flex items-center justify-center"
        >
          {/* 金色墨染 */}
          <motion.div
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 60% at 50% 50%, rgba(227,194,124,.28) 0%, rgba(12,10,19,.97) 70%)`,
            }}
          />
          {/* 玉玺落定 + 全屏微震 */}
          <motion.div
            animate={{ y: [0, 1, 0] }}
            transition={{ delay: 0.55, duration: 0.12 }}
            className="relative flex flex-col items-center gap-5"
          >
            <motion.div
              initial={{ scale: 1.6, rotate: 20, opacity: 0 }}
              animate={{ scale: 1, rotate: -4, opacity: 1 }}
              transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 15 }}
            >
              <TierSeal tier={tier} size={120} glow />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="gold-text font-serifsc text-[40px] font-black tracking-[.2em]">晋升 · {meta.name}</span>
              <span className="text-[13px] tracking-[.3em] text-dim">{meta.lore}</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

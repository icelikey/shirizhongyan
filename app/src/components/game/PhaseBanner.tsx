/**
 * 狼人杀阶段横幅（design game-werewolf.md「阶段横幅」）：
 * 竖排书法（Ma Shan Zheng 48px，墨底金/朱砂字），自中缝展开，
 * 停留 1.2s 后向上消散。text 变化时自动重播。
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface PhaseBannerProps {
  text: string | null
  /** gold=白日/系统 moon=夜晚 cinnabar=死亡/放逐 */
  tone?: 'gold' | 'moon' | 'cinnabar'
}

const TONE_COLOR: Record<NonNullable<PhaseBannerProps['tone']>, string> = {
  gold: '#E3C27C',
  moon: '#B9C8FF',
  cinnabar: '#F0655A',
}

export default function PhaseBanner({ text, tone = 'gold' }: PhaseBannerProps) {
  const [shown, setShown] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    setShown(text)
    const t = setTimeout(() => setShown(null), 1700)
    return () => clearTimeout(t)
  }, [text])

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={shown}
          className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
        >
          <motion.div
            className="vertical-rl font-mashan text-[46px] tracking-[.2em] px-5 py-7 rounded-lg bg-[rgba(12,10,19,.88)] border border-[rgba(227,194,124,.22)]"
            style={{ color: TONE_COLOR[tone], textShadow: `0 0 24px ${TONE_COLOR[tone]}55`, maxHeight: '72dvh' }}
            initial={{ clipPath: 'inset(0 50% 0 50%)' }}
            animate={{ clipPath: 'inset(0 0% 0 0%)' }}
            exit={{ y: -40, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {shown}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

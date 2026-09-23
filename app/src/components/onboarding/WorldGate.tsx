import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Clock3, Orbit, Sparkles } from 'lucide-react'
import CountdownRing from '@/components/CountdownRing'
import GoldButton from '@/components/GoldButton'
import { useProfile } from '@/store/profile'
import { COUNTDOWN_TICK_MS, formatHMS, getCountdown } from '@/lib/countdown'

export interface WorldGateProps {
  open: boolean
  onComplete: () => void
}

/**
 * 开场 PV 之后的世界入口。
 * 这里保留首页的核心视觉语汇，但作为独立浮层存在，避免用户需要再次滚动长页才能进入牌局。
 */
export default function WorldGate({ open, onComplete }: WorldGateProps) {
  const createdAt = useProfile((state) => state.session?.createdAt)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setTick((value) => value + 1), COUNTDOWN_TICK_MS)
    return () => window.clearInterval(timer)
  }, [open])

  const countdown = getCountdown(createdAt ?? new Date().setHours(0, 0, 0, 0))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#07060B]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: "url('/assets/onboarding/world-gate-v1.png')" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(51,35,82,.2),rgba(7,6,11,.82)_58%,#07060B_100%)]" />
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(86vw,86vh)] w-[min(86vw,86vh)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-300/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 44, ease: 'linear', repeat: Infinity }}
          >
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-100 shadow-[0_0_18px_#F8E9C0]" />
            <span className="absolute bottom-[11%] right-[11%] h-1.5 w-1.5 rounded-full bg-suit-heart shadow-[0_0_12px_#EE6A72]" />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[min(66vw,66vh)] w-[min(66vw,66vh)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-suit-spade/15 border-dashed"
            animate={{ rotate: -360 }}
            transition={{ duration: 31, ease: 'linear', repeat: Infinity }}
          />

          <div className="relative z-10 flex w-full max-w-[960px] flex-col items-center px-5 text-center">
            <div className="mb-5 flex items-center gap-2 text-[10px] tracking-[.34em] text-gold-200/75 sm:mb-7">
              <Orbit size={14} className="animate-spin-slow" />
              世界悬浮 · 元规则已接通
              <Orbit size={14} className="animate-spin-slow" />
            </div>

            <CountdownRing variant="hero" size={Math.min(360, typeof window === 'undefined' ? 320 : Math.max(240, Math.min(window.innerWidth * .72, 360)))}>
              <motion.img
                src="/eclipse-suns.png"
                alt="旋转的十日日蚀"
                className="h-full w-full object-contain"
                animate={{ rotate: 360, scale: [1, 1.035, 1] }}
                transition={{ rotate: { duration: 24, ease: 'linear', repeat: Infinity }, scale: { duration: 5, ease: 'easeInOut', repeat: Infinity } }}
              />
            </CountdownRing>

            <p className="mt-[-18px] font-mono text-[12px] tracking-[.26em] text-gold-100/75 sm:mt-[-22px]">第 {countdown.day} 日 · {formatHMS(countdown.remainMs)} 至终焉</p>
            <h1 className="mt-5 font-mashan text-[72px] leading-none tracking-[.2em] text-gold-100 drop-shadow-[0_0_24px_rgba(227,194,124,.28)] sm:text-[104px]">终焉</h1>
            <p className="mt-4 max-w-xl text-[13px] leading-7 tracking-[.16em] text-bone/70">世界不在远方。它悬在每一次选择之间，等候玩家、影从与外部 Agent 同时入席。</p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <GoldButton variant="gold" size="xl" className="gold-sweep tracking-[.32em]" onClick={onComplete}>
                进入牌局之间 <ArrowRight size={17} />
              </GoldButton>
            </div>
            <div className="mt-5 flex items-center gap-2 text-[10px] tracking-[.16em] text-faint"><Clock3 size={13} /> 倒计时与世界事件会在你离开入口后继续运行</div>
            <div className="mt-8 flex items-center gap-2 text-[9px] tracking-[.28em] text-gold-200/45"><Sparkles size={12} /> 每一次奇迹，都必须留下可回放的轨迹</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

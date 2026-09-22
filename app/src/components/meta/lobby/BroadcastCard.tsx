/**
 * 十日播报卡（lobby.md §R1）：CountdownRing mini + 实时倒计时文案 + 世界公告轮播（8s 切换）。
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProfile } from '@/store/profile'
import { COUNTDOWN_TICK_MS, formatCountdown, getCountdown } from '@/lib/countdown'
import CountdownRing from '@/components/CountdownRing'

const NEWS: string[] = [
  '昨夜玄渊，旅人『借火人』以 22.9 猜中均值，连破三层思维。',
  '讹兽悍跳预言家成功，月影村全军覆没。',
  '残章·叁 已被 12 位旅人解锁。',
  '青野演算场连续三局出现 0 偏差出数，算庭哗然。',
  '白泽在玄渊复盘局中点破四狼连环，观战者众。',
]

export default function BroadcastCard() {
  const createdAt = useProfile((s) => s.session?.createdAt)
  const [, setTick] = useState(0)
  const [newsIdx, setNewsIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNewsIdx((i) => (i + 1) % NEWS.length), 8000)
    return () => clearInterval(t)
  }, [])

  const anchor = createdAt ?? new Date().setHours(0, 0, 0, 0)
  const cd = getCountdown(anchor)

  return (
    <div className="panel-bg rounded-[14px] p-5">
      <div className="flex items-center gap-3">
        <CountdownRing variant="mini" size={48} />
        <div className="min-w-0">
          <div className="font-serifsc text-[14px] tracking-[.15em] text-bone">十日播报</div>
          <div className="mt-0.5 font-mono text-[11px] text-dim">{formatCountdown(cd)}</div>
        </div>
      </div>
      <div className="relative mt-4 border-l-2 border-gold-300/40 pl-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={newsIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="min-h-[44px] text-[12px] leading-relaxed text-dim"
          >
            {NEWS[newsIdx]}
          </motion.p>
        </AnimatePresence>
        <div className="mt-2 flex gap-1">
          {NEWS.map((_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-500"
              style={{ background: i === newsIdx ? '#E3C27C' : 'rgba(227,194,124,.15)' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

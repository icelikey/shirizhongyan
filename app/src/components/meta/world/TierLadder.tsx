/**
 * 位阶总览卡「天地玄黄」（world.md §位阶总览卡）。
 * 五级阶梯（黄→玄→地→天→洪荒传说位灰显）；当前位阶放大 1.15 + 金辉 +「当前」侧注；
 * 下一级显示进度（四花色生肖 x/12）；条件满足浮出「升阶试炼已开启」横幅 + 晋升按钮 → store.tryPromote()。
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { SUITS, SUIT_META } from '@/data/echoes'
import { TIERS, TIER_ORDER, ZODIAC_PER_SUIT_FOR_PROMOTE } from '@/data/tiers'
import type { Tier } from '@/data/tiers'
import GoldButton from '@/components/GoldButton'
import TierSeal from '@/components/TierSeal'
import PromoteRitual from '@/components/meta/world/PromoteRitual'
import { cn } from '@/lib/utils'

export default function TierLadder() {
  const tier = useProfile((s) => s.tier)
  const zodiac = useProfile((s) => s.zodiac)
  const tryPromote = useProfile((s) => s.tryPromote)
  const [ritualTier, setRitualTier] = useState<Tier | null>(null)

  const curIdx = TIER_ORDER.indexOf(tier)
  const ready = SUITS.every((s) => zodiac[s].length >= ZODIAC_PER_SUIT_FOR_PROMOTE)
  const totalLit = SUITS.reduce((n, s) => n + zodiac[s].length, 0)
  const totalNeed = ZODIAC_PER_SUIT_FOR_PROMOTE * 4

  const handlePromote = () => {
    if (tryPromote()) {
      const idx = TIER_ORDER.indexOf(useProfile.getState().tier)
      setRitualTier(TIER_ORDER[idx])
    } else {
      toast.error('升阶条件未足', { description: `四花色生肖 ${totalLit}/${totalNeed}` })
    }
  }

  return (
    <div className="panel-bg relative rounded-[14px] p-5">
      <h3 className="gold-text font-serifsc text-[16px] font-semibold tracking-[.15em]">天地玄黄</h3>
      <p className="mt-1 text-[11px] tracking-[.2em] text-faint">位阶阶梯 · 四大陆生肖尽亮则晋</p>

      {/* 升阶试炼横幅 */}
      {ready && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-cinnabar/50 bg-cinnabar/10 px-3 py-2"
        >
          <span className="flex items-center gap-1.5 text-[12px] tracking-wider text-cinnabar-hi">
            <Sparkles size={13} /> 升阶试炼已开启
          </span>
          <GoldButton size="sm" variant="danger" onClick={handlePromote}>
            晋升
          </GoldButton>
        </motion.div>
      )}

      {/* 阶梯（黄→玄→地→天→洪荒） */}
      <div className="relative mt-4 flex flex-col">
        {/* 生长线 */}
        <motion.span
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-5 left-[21px] top-5 w-px origin-top bg-[rgba(227,194,124,.2)]"
        />
        {TIERS.map((t, i) => {
          const isLegend = t.id === 'honghuang'
          const idx = isLegend ? TIER_ORDER.length : TIER_ORDER.indexOf(t.id as Tier)
          const isCurrent = !isLegend && t.id === tier
          const isNext = !isLegend && idx === curIdx + 1
          const passed = !isLegend && idx < curIdx
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
              className={cn('relative flex items-center gap-3 py-2.5 pl-0.5', isLegend && 'opacity-50')}
            >
              <motion.span animate={isCurrent ? { scale: 1.15 } : { scale: 1 }} className="relative z-10">
                <TierSeal tier={t.id} size={40} glow={isCurrent} />
                {isCurrent && <span className="absolute inset-0 -z-10 animate-breathe rounded-lg shadow-gold-glow" />}
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('font-serifsc text-[15px]', isCurrent ? 'gold-text font-semibold' : 'text-bone')}>
                    {t.name}
                  </span>
                  {isCurrent && (
                    <span className="rounded-full border border-gold-300/50 bg-gold-300/10 px-1.5 py-px text-[9px] tracking-wider text-gold-300">
                      当前
                    </span>
                  )}
                  {isLegend && (
                    <span className="rounded-full border border-[rgba(227,194,124,.15)] px-1.5 py-px text-[9px] tracking-wider text-faint">
                      传说 ???
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] leading-relaxed text-faint">
                  {isLegend
                    ? '世界每十日终结，唯洪荒者可改写规则。'
                    : idx === 0
                      ? '初始位阶 · 旅人皆以此立身'
                      : passed
                        ? '已达成'
                        : '四花色大陆各满 12 生肖'}
                </p>
                {/* 下一级进度 */}
                {isNext && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between font-mono text-[10px] text-dim">
                      <span>
                        生肖 {totalLit}/{totalNeed}
                      </span>
                      <span>
                        {SUITS.map((s) => `${SUIT_META[s].symbol}${zodiac[s].length}`).join(' ')}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgba(227,194,124,.12)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(totalLit / totalNeed) * 100}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gold-300"
                        style={{ boxShadow: '0 0 6px rgba(227,194,124,.6)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* 升阶仪式演出 */}
      <PromoteRitual tier={ritualTier} onDone={() => setRitualTier(null)} />
    </div>
  )
}

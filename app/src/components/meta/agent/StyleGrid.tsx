/**
 * 心性烙印 · 风格设定（agent.md §A2）。
 * 六张人设卡（2×3）：图标 + 名 + 一句话 + 行为倾向微型条。
 * 选中金边 + 印章「契」落定；切换前确认 Modal（重塑心性将清空当前风格熟练度）。
 * 写回 store.updateCompanion({ style })。
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import type { Companion } from '@/store/profile'
import GoldButton from '@/components/GoldButton'
import MetaModal from '@/components/meta/Modal'
import SectionHeader from '@/components/meta/SectionHeader'
import TendencyBar from '@/components/meta/TendencyBar'
import { STYLES } from '@/components/meta/agent/styles'
import type { StyleDef } from '@/components/meta/agent/styles'
import { cn } from '@/lib/utils'

export default function StyleGrid() {
  const companion = useProfile((s) => s.companion)
  const updateCompanion = useProfile((s) => s.updateCompanion)
  const [pending, setPending] = useState<StyleDef | null>(null)
  const [stampKey, setStampKey] = useState(0)

  if (!companion) return null
  const current = companion.style as string

  const apply = () => {
    if (!pending) return
    // store 类型仅覆盖四值；六风格 key 以字符串写入（见 styles.ts 注）
    updateCompanion({ style: pending.key as Companion['style'] })
    setStampKey((k) => k + 1)
    toast.success(`心性已烙 · ${pending.name}`, { description: pending.quote })
    setPending(null)
  }

  return (
    <section>
      <SectionHeader title="心性烙印" subtitle="影从的风格，即是你的影子。" sideMark="烙印" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {STYLES.map((s) => {
          const sel = current === s.key
          const Icon = s.icon
          return (
            <motion.button
              key={s.key}
              type="button"
              onClick={() => !sel && setPending(s)}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'relative flex flex-col gap-2 rounded-[12px] border bg-ink/50 p-3.5 text-left transition-all duration-200 ease-ink',
                sel
                  ? '-translate-y-1.5 border-gold-300/70 shadow-gold-glow'
                  : 'border-[rgba(227,194,124,.12)] hover:-translate-y-0.5 hover:border-[rgba(246,227,180,.35)]',
              )}
            >
              {sel && (
                <motion.span
                  key={stampKey}
                  initial={{ scale: 1.4, rotate: 16, opacity: 0 }}
                  animate={{ scale: 1, rotate: -8, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 15 }}
                  className="seal-stamp absolute right-2 top-2 flex h-7 w-7 items-center justify-center text-[15px]"
                >
                  契
                </motion.span>
              )}
              <span className={cn('flex items-center gap-2', sel ? 'text-gold-300' : 'text-dim')}>
                <Icon size={16} />
                <span className={cn('font-serifsc text-[14px]', sel ? 'text-gold-300' : 'text-bone')}>{s.name}</span>
              </span>
              <p className="min-h-[32px] text-[11px] leading-relaxed text-faint">{s.quote}</p>
              <div className="flex flex-col gap-1.5">
                {s.tendencies.map((t) => (
                  <TendencyBar key={t.label} label={t.label} value={t.value} color={sel ? '#E3C27C' : '#8A6A33'} />
                ))}
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* 切换确认 */}
      <MetaModal open={pending !== null} onClose={() => setPending(null)} title="重塑心性" width={400}>
        {pending && (
          <div className="flex flex-col gap-5">
            <p className="text-[13px] leading-relaxed text-dim">
              将契约影从的心性重塑为「<span className="text-gold-300">{pending.name}</span>」。
              <br />
              重塑心性将清空当前风格熟练度，确定？
            </p>
            <div className="flex justify-end gap-3">
              <GoldButton variant="ghost" size="sm" onClick={() => setPending(null)}>
                再想想
              </GoldButton>
              <GoldButton size="sm" onClick={apply}>
                烙下此印
              </GoldButton>
            </div>
          </div>
        )}
      </MetaModal>
    </section>
  )
}

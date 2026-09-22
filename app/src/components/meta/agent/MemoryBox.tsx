/**
 * 记忆之匣（agent.md §A4）—— 养成核心。
 * 3 格起始 + 5 格锁定（40♣ 解锁，store.spendFragments + updateCompanion）。
 * 记忆来自 store.echoMemories[契约影从].note（对局自动写入），新记忆卷轴展开。
 * 碎片不足：按钮朱砂抖动 + 提示。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { getEcho } from '@/data/echoes'
import MaskIcon from '@/components/MaskIcon'
import SectionHeader from '@/components/meta/SectionHeader'
import { ECHO_NOTE_SEED } from '@/components/meta/data'
import { cn } from '@/lib/utils'

const MAX_SLOTS = 8
const UNLOCK_COST = 40

export default function MemoryBox() {
  const companion = useProfile((s) => s.companion)
  const updateCompanion = useProfile((s) => s.updateCompanion)
  const memory = useProfile((s) => (s.companion ? s.echoMemories[s.companion.echoId] : undefined))
  const fragments = useProfile((s) => s.fragments)
  const spendFragments = useProfile((s) => s.spendFragments)
  const [shake, setShake] = useState(0)

  if (!companion) return null
  const echo = getEcho(companion.echoId)
  const slots = Math.min(MAX_SLOTS, companion.memorySlots)

  // 记忆列表：store 笔记（新→旧）优先，缺省补种子
  const notes = memory?.note?.length ? [...memory.note].reverse() : (ECHO_NOTE_SEED[companion.echoId] ?? [])
  const display = notes.slice(0, slots)

  const unlock = () => {
    if (slots >= MAX_SLOTS) return
    if (!spendFragments('club', UNLOCK_COST)) {
      setShake((k) => k + 1)
      toast.error('碎片不足，先去对局赢取', {
        description: `解锁记忆槽需要 ${UNLOCK_COST}♣ · 当前余额 ${fragments.club}♣`,
      })
      return
    }
    updateCompanion({ memorySlots: slots + 1 })
    toast.success(`记忆槽 +1（${slots + 1}/${MAX_SLOTS}）`, { description: `${echo?.name ?? '影从'}能记住更多与你的十日了。` })
  }

  return (
    <section>
      <SectionHeader
        title="记忆之匣"
        subtitle={`${slots}/${MAX_SLOTS} 槽 · 槽满后最旧记忆将风化`}
        sideMark="记忆"
        right={
          slots < MAX_SLOTS ? (
            <motion.button
              key={shake}
              type="button"
              onClick={unlock}
              animate={shake ? { x: [0, -5, 5, -4, 4, 0] } : undefined}
              transition={{ duration: 0.4 }}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] tracking-wider transition-colors',
                fragments.club >= UNLOCK_COST
                  ? 'border-[rgba(78,203,156,.45)] text-suit-club hover:bg-[rgba(78,203,156,.1)]'
                  : 'border-cinnabar/50 text-cinnabar-hi',
              )}
              title={`余额 ${fragments.club}♣`}
            >
              <Lock size={11} /> {UNLOCK_COST}♣ 解锁新槽
            </motion.button>
          ) : undefined
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        {Array.from({ length: MAX_SLOTS }).map((_, i) => {
          const open = i < slots
          const note = open ? display[i] : undefined
          if (!open) {
            return (
              <button
                key={i}
                type="button"
                onClick={unlock}
                className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[rgba(227,194,124,.2)] text-faint transition-colors hover:border-[rgba(227,194,124,.4)] hover:text-dim"
              >
                <Lock size={14} />
                <span className="text-[10px] tracking-wider">{UNLOCK_COST}♣ 解锁</span>
              </button>
            )
          }
          return (
            <AnimatePresence key={i} mode="popLayout">
              <motion.div
                key={note ?? `empty-${i}`}
                layout
                initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
                animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'flex min-h-[76px] gap-2.5 rounded-[12px] border p-3',
                  note ? 'border-[rgba(227,194,124,.18)] bg-ink/60' : 'border-[rgba(227,194,124,.08)] bg-ink/30',
                )}
              >
                <MaskIcon src="/icon-flame.svg" size={14} color={note ? '#E3C27C' : '#6E6880'} className="mt-0.5 shrink-0" />
                <p className={cn('text-[11px] leading-relaxed', note ? 'text-dim' : 'text-faint')}>
                  {note ?? '待新的共同记忆写入……'}
                </p>
              </motion.div>
            </AnimatePresence>
          )
        })}
      </div>
    </section>
  )
}

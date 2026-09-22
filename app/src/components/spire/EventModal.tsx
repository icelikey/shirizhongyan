/**
 * ============================================================================
 * 碎境爬塔 · 事件全屏弹层（spire-map.md §3.2 事件节点）
 * ============================================================================
 * 流程：插画 + 叙事文案 + 2–3 选项 → 结算效果 → 结果反馈一句话 → 继续。
 * 结算约定（与 src/data/spire/events.ts 配套）：
 * - 'fragments' → profile.addFragments('diamond', v)（store 故意不处理）；
 * - card/relic/potion refId 留空 → spire-data 随机池兜底补齐；
 * - 'removeCard' → 结果页「继续」后强制打开选牌器，removeCard 后才算完成。
 * ============================================================================
 */
import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import type { EventDef, EventEffect, EventOption } from '@/data/spire/types'
import { useSpire } from '@/store/spire'
import { useProfile } from '@/store/profile'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import CardPickerModal from '@/components/spire/CardPickerModal'
import { cardView, potionView, randomCardId, randomPotionId, randomRelicId, relicView } from '@/game/spire-data'
import { cn } from '@/lib/utils'

export interface EventModalProps {
  event: EventDef
  onDone: () => void
}

/** 效果一句话摘要（结果页反馈 chips） */
function effectChip(e: EventEffect): { label: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (e.kind) {
    case 'hp':
      return e.value >= 0 ? { label: `生命 +${e.value}`, tone: 'good' } : { label: `生命 ${e.value}`, tone: 'bad' }
    case 'maxHp':
      return e.value >= 0 ? { label: `生命上限 +${e.value}`, tone: 'good' } : { label: `生命上限 ${e.value}`, tone: 'bad' }
    case 'gold':
      return e.value >= 0 ? { label: `金币 +${e.value}`, tone: 'good' } : { label: `金币 ${e.value}`, tone: 'bad' }
    case 'fragments':
      return { label: `♦ 碎片 +${e.value}`, tone: 'good' }
    case 'card':
      return { label: `得牌 · ${e.refId ? cardView(e.refId).name : '???'}`, tone: 'good' }
    case 'curse':
      return { label: `业债缠身 · ${e.refId ? cardView(e.refId).name : '诅咒'}`, tone: 'bad' }
    case 'relic':
      return { label: `遗物 · ${e.refId ? relicView(e.refId).name : '???'}`, tone: 'good' }
    case 'potion':
      return { label: `药水 · ${e.refId ? potionView(e.refId).name : '???'}`, tone: 'good' }
    case 'removeCard':
      return { label: '移除 1 张牌', tone: 'neutral' }
  }
}

export default function EventModal({ event, onDone }: EventModalProps) {
  const applyEventEffects = useSpire((s) => s.applyEventEffects)
  const relics = useSpire((s) => s.relics)
  const deck = useSpire((s) => s.deck)
  const removeCard = useSpire((s) => s.removeCard)
  const addFragments = useProfile((s) => s.addFragments)

  const [picked, setPicked] = useState<EventOption | null>(null)
  const [resolved, setResolved] = useState<EventEffect[]>([])
  const [pickRemove, setPickRemove] = useState(false)

  const needRemove = useMemo(() => resolved.some((e) => e.kind === 'removeCard'), [resolved])

  const choose = (opt: EventOption) => {
    if (picked) return
    // 1) refId 留空的 card/relic/potion → 随机池兜底补齐
    const effects = opt.effects.map((e) => {
      if (e.kind === 'card' && !e.refId) return { ...e, refId: randomCardId() }
      if (e.kind === 'relic' && !e.refId) return { ...e, refId: randomRelicId(relics) }
      if (e.kind === 'potion' && !e.refId) return { ...e, refId: randomPotionId() }
      return e
    })
    // 2) 碎片走 profile；其余走 store；removeCard 延后到选牌器
    for (const e of effects) {
      if (e.kind === 'fragments') addFragments('diamond', e.value)
    }
    applyEventEffects(effects.filter((e) => e.kind !== 'fragments' && e.kind !== 'removeCard'))
    setPicked(opt)
    setResolved(effects)
  }

  const proceed = () => {
    if (needRemove) {
      setPickRemove(true)
      return
    }
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto bg-abyss/85 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[680px] overflow-hidden rounded-[18px] border border-[rgba(227,194,124,.28)] bg-panel shadow-panel"
      >
        {/* 插画 */}
        <div className="relative h-[240px] w-full overflow-hidden">
          <img src={event.art} alt={event.title} className="h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/30 to-transparent" />
          <h3 className="gold-text absolute bottom-3 left-6 font-serifsc text-[26px] font-black tracking-[.12em]">{event.title}</h3>
          <span className="vertical-rl absolute bottom-4 right-5 font-mashan text-[14px] text-gold-500/80">奇遇</span>
        </div>

        <div className="flex flex-col gap-5 p-6">
          {/* 文案 / 结果 */}
          <AnimatePresence mode="wait">
            {!picked ? (
              <motion.p
                key="text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-pre-line text-[14px] leading-[1.9] text-bone/85"
              >
                {event.text}
              </motion.p>
            ) : (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                <p className="text-[14px] leading-[1.9] text-bone/90">{picked.result}</p>
                <div className="flex flex-wrap gap-2">
                  {resolved.length === 0 && <span className="text-[12px] text-faint">——无所得，无所失——</span>}
                  {resolved.map((e, i) => {
                    const chip = effectChip(e)
                    return (
                      <span
                        key={i}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] tracking-wider',
                          chip.tone === 'good' && 'border-[rgba(78,203,156,.4)] text-ok',
                          chip.tone === 'bad' && 'border-[rgba(216,68,60,.45)] text-cinnabar-hi',
                          chip.tone === 'neutral' && 'border-[rgba(227,194,124,.3)] text-dim',
                        )}
                      >
                        {e.kind === 'fragments' && <SuitIcon suit="diamond" size={12} />}
                        {chip.label}
                      </span>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 选项 / 继续 */}
          {!picked ? (
            <div className="flex flex-col gap-2.5">
              {event.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => choose(opt)}
                  className={cn(
                    'group flex items-center justify-between gap-3 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/50 px-4 py-3 text-left',
                    'transition-all duration-200 ease-ink hover:-translate-y-0.5 hover:border-[rgba(246,227,180,.5)] hover:bg-ink/80',
                  )}
                >
                  <span className="text-[13px] tracking-[.06em] text-bone group-hover:text-gold-100">{opt.text}</span>
                  <span className="font-mono text-[11px] text-faint transition-colors group-hover:text-gold-300">择</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-end">
              <GoldButton size="md" onClick={proceed}>
                继续登塔
              </GoldButton>
            </div>
          )}
        </div>
      </motion.div>

      {/* 以记忆为祭：强制选牌移除 */}
      <CardPickerModal
        open={pickRemove}
        title="以一段记忆为祭"
        cards={deck}
        required
        onPick={(entry) => {
          removeCard(entry)
          toast('记忆已封入祭坛', { description: `失去了「${cardView(entry).name}」` })
          setPickRemove(false)
          onDone()
        }}
        onClose={() => {}}
      />
    </motion.div>
  )
}

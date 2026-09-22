/**
 * 快速匹配卡（lobby.md §L1）—— 本页视觉重心之一。
 * 两个游戏选项；点「入席」→ 扣门票 → 雷达扫描匹配演出（同心圆 + 扫描线，
 * 逐个点亮 5 个影从座位）→「牌桌已成」→ 墨染过渡进对局。
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Radar } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { SUIT_META, getEcho } from '@/data/echoes'
import EchoAvatar from '@/components/EchoAvatar'
import FragmentChip from '@/components/FragmentChip'
import SuitIcon from '@/components/SuitIcon'
import type { MetaGame } from '@/components/meta/data'
import { GAME_META } from '@/components/meta/data'
import { cn } from '@/lib/utils'

/** 匹配填充的 5 位影从（真人优先，不足以 AI 填充的原型演出） */
const FILLERS: Record<MetaGame, string[]> = {
  werewolf: ['baize', 'eshou', 'qingnang', 'ajiu', 'baixiao'],
  guess: ['xuanji', 'shouzhuo', 'ajiu', 'baize', 'qingnang'],
}

const OPTIONS: { game: MetaGame; ticket: number; waiting: number; desc: string }[] = [
  { game: 'werewolf', ticket: 15, waiting: 3, desc: '昼夜交替 · 谎言与刀锋' },
  { game: 'guess', ticket: 10, waiting: 2, desc: '五轮出数 · 思维的层数' },
]

type Phase = 'idle' | 'scanning' | 'filling' | 'done'

export interface QuickMatchCardProps {
  /** 墨染过渡跳转 */
  go: (to: string) => void
}

export default function QuickMatchCard({ go }: QuickMatchCardProps) {
  const fragments = useProfile((s) => s.fragments)
  const spendFragments = useProfile((s) => s.spendFragments)

  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<MetaGame>('werewolf')
  const [filled, setFilled] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  const startMatch = (game: MetaGame, ticket: number) => {
    if (phase !== 'idle') return
    const suit = GAME_META[game].suit
    if (fragments[suit] < ticket) {
      toast.error('碎片不足，先去对局赢取', { description: `${GAME_META[game].name}门票 ${ticket}${SUIT_META[suit].symbol}` })
      return
    }
    spendFragments(suit, ticket)
    setActive(game)
    setPhase('scanning')
    setFilled(0)
    later(() => setPhase('filling'), 1200)
    FILLERS[game].forEach((_, i) => later(() => setFilled(i + 1), 1200 + 200 * (i + 1)))
    later(() => {
      setPhase('done')
      toast.success('牌桌已成', { description: '真人 1 · 影从 5 · 开局' })
    }, 1200 + 200 * 5 + 300)
    later(() => go(`/game/${game}/${Date.now()}`), 1200 + 200 * 5 + 900)
  }

  const activeMeta = GAME_META[active]

  return (
    <div className="panel-bg gold-sweep relative overflow-hidden rounded-[14px] p-5">
      {/* 竖排小字「速战」 */}
      <span className="vertical-rl absolute right-3 top-4 font-mashan text-[13px] text-gold-500/70">速战</span>
      <h3 className="gold-text font-serifsc text-[18px] font-semibold tracking-[.12em]">快速匹配</h3>
      <p className="mt-1 text-[11px] tracking-[.2em] text-faint">雷达所及 · 即刻成局</p>

      <div className="mt-4 flex flex-col gap-3">
        {OPTIONS.map((opt) => {
          const meta = GAME_META[opt.game]
          const suit = SUIT_META[meta.suit]
          return (
            <button
              key={opt.game}
              type="button"
              onClick={() => startMatch(opt.game, opt.ticket)}
              disabled={phase !== 'idle'}
              className={cn(
                'group flex items-center gap-3 rounded-[12px] border border-[rgba(227,194,124,.14)] bg-ink/60 p-3 text-left',
                'transition-all duration-200 ease-ink hover:-translate-y-0.5 disabled:opacity-60',
              )}
              style={{ ['--suit-glow' as string]: suit.glow }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = suit.color)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]"
                style={{ background: `${suit.color}1F`, color: suit.color, boxShadow: `0 0 16px ${suit.glow}` }}
              >
                <SuitIcon suit={meta.suit} size={24} glow />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-serifsc text-[15px] text-bone">{meta.name}</span>
                  <FragmentChip suit={meta.suit} count={opt.ticket} size="sm" />
                </span>
                <span className="mt-1 block text-[11px] text-faint">
                  {opt.desc} · 等待中 <span className="font-mono text-dim">{opt.waiting}/6</span>
                </span>
              </span>
              <span className="flex items-center gap-1 text-[12px] tracking-[.2em] text-gold-300 opacity-80 transition-transform duration-200 group-hover:translate-x-0.5">
                入席 <ChevronRight size={14} />
              </span>
            </button>
          )
        })}
      </div>

      {/* 匹配演出覆盖层 */}
      <AnimatePresence>
        {phase !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-ink/95 backdrop-blur-sm"
          >
            {/* 雷达 */}
            <div className="relative flex h-28 w-28 items-center justify-center">
              {[0, 1].map((i) => (
                <motion.span
                  key={i}
                  className="absolute inset-0 rounded-full border"
                  style={{ borderColor: SUIT_META[activeMeta.suit].color }}
                  initial={{ scale: 0.2, opacity: 0.8 }}
                  animate={{ scale: 1.6, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: phase === 'scanning' ? Number.POSITIVE_INFINITY : 0, delay: i * 0.6, ease: 'easeOut' }}
                />
              ))}
              {/* 扫描线 */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, ${SUIT_META[activeMeta.suit].color}55, transparent 25%)`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(227,194,124,.28)] bg-panel">
                {phase === 'done' ? (
                  <SuitIcon suit={activeMeta.suit} size={26} glow />
                ) : (
                  <Radar size={24} style={{ color: SUIT_META[activeMeta.suit].color }} />
                )}
              </span>
            </div>

            <p className="text-[12px] tracking-[.3em] text-dim">
              {phase === 'scanning' && '雷达扫描中 · 寻找同桌'}
              {phase === 'filling' && '影从入座中 …'}
              {phase === 'done' && <span className="gold-text font-serifsc text-[15px]">牌桌已成</span>}
            </p>

            {/* 逐个点亮的 5 个座位 */}
            <div className="flex items-center gap-2.5">
              {FILLERS[active].map((id, i) => {
                const echo = getEcho(id)
                const on = i < filled
                return (
                  <motion.span
                    key={id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={on ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0.25 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="rounded-full"
                    title={echo?.name}
                  >
                    {echo && <EchoAvatar echo={echo} size={32} />}
                  </motion.span>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

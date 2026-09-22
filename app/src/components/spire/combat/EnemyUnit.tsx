/**
 * <EnemyUnit> 敌方单位卡：立绘 + HP 条 + 状态列 + 意图徽章。
 * 受击抖动（shake 计数触发）、伤害飘字、死亡碎裂淡出（AnimatePresence exit）。
 */
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, HelpCircle, Shield, Sword } from 'lucide-react'
import type { Combatant, IntentDisplay } from '@/engine/spire/types'
import StatusRow from '@/components/spire/combat/StatusRow'
import { FLOATER_CLS, type Floater } from '@/components/spire/combat/floaters'
import { cn } from '@/lib/utils'

const INTENT_ICON = { attack: Sword, block: Shield, buff: ArrowUp, debuff: ArrowDown, unknown: HelpCircle } as const

interface Props {
  c: Combatant
  intent: IntentDisplay
  selectable: boolean
  shake: number
  floaters: Floater[]
  onClick?: () => void
}

export default function EnemyUnit({ c, intent, selectable, shake, floaters, onClick }: Props) {
  const isBoss = c.def.tier === 'boss'
  const IntentIcon = INTENT_ICON[intent.icon]
  const hpPct = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100))
  const w = isBoss ? 'w-[200px] min-[1400px]:w-[220px]' : 'w-[150px] min-[1400px]:w-[180px]'

  return (
    <AnimatePresence>
      {c.alive && (
        <motion.div
          key={c.key}
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.55, rotate: 9, y: 26, filter: 'brightness(2.2)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className={cn('relative flex flex-col items-center', w)}
        >
          {/* 意图徽章 */}
          <div
            title={intent.detail ?? intent.label}
            className={cn(
              'mb-1.5 flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] leading-none bg-ink/85',
              intent.icon === 'attack' && 'border-cinnabar/60 text-cinnabar-hi',
              intent.icon === 'block' && 'border-[#7FC8E8]/50 text-[#7FC8E8]',
              intent.icon === 'buff' && 'border-ok/50 text-ok',
              intent.icon === 'debuff' && 'border-suit-spade/60 text-suit-spade',
              intent.icon === 'unknown' && 'border-dim/40 text-dim',
            )}
          >
            <IntentIcon size={12} strokeWidth={2.5} />
            {intent.icon === 'attack' && intent.damage !== undefined && (
              <span>
                {intent.damage}
                {intent.times && intent.times > 1 ? `×${intent.times}` : ''}
              </span>
            )}
            {intent.icon === 'block' && intent.value !== undefined && <span>{intent.value}</span>}
            {(intent.icon === 'buff' || intent.icon === 'debuff' || intent.icon === 'unknown') && (
              <span className="font-sanssc">{intent.icon === 'unknown' ? '?' : intent.icon === 'buff' ? '强化' : '削弱'}</span>
            )}
          </div>

          {/* 立绘（受击抖动） */}
          <motion.div
            key={`shake-${shake}`}
            animate={shake > 0 ? { x: [0, -8, 7, -5, 3, 0] } : undefined}
            transition={{ duration: 0.32 }}
            className={cn('relative w-full', selectable && 'cursor-crosshair')}
            onClick={selectable ? onClick : undefined}
            role={selectable ? 'button' : undefined}
          >
            <div
              className={cn(
                'relative aspect-square w-full overflow-hidden rounded-[14px] border bg-panel transition-shadow duration-200',
                selectable
                  ? 'border-gold-300 shadow-[0_0_28px_rgba(242,169,59,.45)]'
                  : isBoss
                    ? 'border-cinnabar/50 shadow-[0_0_26px_rgba(216,68,60,.28)]'
                    : 'border-[rgba(227,194,124,.28)] shadow-card',
              )}
            >
              <img src={c.def.art} alt={c.def.name} className="h-full w-full object-cover" draggable={false} />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(7,6,11,.82)_100%)]" />
              {/* 镜像反伤标记 */}
              {c.mirrored && (
                <div className="absolute left-1.5 top-1.5 rounded-full border border-suit-spade/60 bg-ink/85 px-1.5 py-0.5 text-[10px] text-suit-spade">
                  镜像
                </div>
              )}
              {/* 格挡盾标 */}
              {c.block > 0 && (
                <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full border border-[#7FC8E8]/60 bg-ink/85 px-1.5 py-0.5 font-mono text-[11px] text-[#7FC8E8]">
                  <Shield size={11} strokeWidth={2.5} />
                  {c.block}
                </div>
              )}
              {/* 名字 */}
              <div className="absolute inset-x-1 bottom-1 text-center">
                <span className={cn('font-serifsc text-[13px] leading-tight text-bone', isBoss && 'text-[15px] text-gold-100')}>
                  {c.def.name}
                </span>
              </div>
            </div>
            {/* 飘字层 */}
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
              <AnimatePresence>
                {floaters.map((f) => (
                  <motion.span
                    key={f.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: [0, 1, 1, 0], y: -52 }}
                    transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1] }}
                    className={cn('absolute top-1/3 drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]', FLOATER_CLS[f.cls])}
                  >
                    {f.text}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* HP 条 */}
          <div className="mt-1.5 w-full">
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-[rgba(227,194,124,.2)] bg-ink/90">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#B0352E,#F0655A)] transition-[width] duration-300"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <div className="mt-0.5 text-center font-mono text-[11px] leading-none text-dim">
              {c.hp}/{c.maxHp}
            </div>
          </div>
          {/* 状态列 */}
          <div className="mt-1 flex min-h-[20px] justify-center">
            <StatusRow statuses={c.statuses} size="sm" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

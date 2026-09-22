/**
 * <PlayerPanel> 玩家区：契约影从小卡 + HP 条 + 格挡盾标 + 状态列 + 能力。
 * <EnergyOrb> 琥珀琉璃能量球（液面随能量升降）。
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, Zap } from 'lucide-react'
import type { BattleState } from '@/engine/spire/types'
import { getCard } from '@/data/spire/cards'
import StatusRow from '@/components/spire/combat/StatusRow'
import { FLOATER_CLS, type Floater } from '@/components/spire/combat/floaters'
import { cn } from '@/lib/utils'

export function EnergyOrb({ energy, maxEnergy }: { energy: number; maxEnergy: number }) {
  const pct = Math.max(0, Math.min(1, energy / Math.max(1, maxEnergy + 1)))
  return (
    <div className="flex flex-col items-center gap-1" title={`能量 ${energy}/${maxEnergy}`}>
      <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full border border-suit-diamond/60 bg-ink shadow-[0_0_24px_rgba(242,169,59,.3)]">
        {/* 液面 */}
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-300 ease-ink"
          style={{
            height: `${pct * 100}%`,
            background: 'linear-gradient(180deg, rgba(248,233,192,.95) 0%, rgba(242,169,59,.9) 30%, rgba(138,106,51,.95) 100%)',
          }}
        />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 4px 10px rgba(255,246,220,.35), inset 0 -6px 14px rgba(7,6,11,.6)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-cinzel text-[20px] font-bold leading-none text-bone drop-shadow-[0_2px_4px_rgba(0,0,0,.85)]">
            {energy}
            <span className="text-[12px] text-bone/70">/{maxEnergy}</span>
          </span>
        </div>
      </div>
      <span className="flex items-center gap-1 font-sanssc text-[10px] tracking-[.2em] text-suit-diamond">
        <Zap size={10} /> 能量
      </span>
    </div>
  )
}

interface Props {
  state: BattleState
  portrait: string
  name: string
  floaters: Floater[]
  shake: number
}

export default function PlayerPanel({ state, portrait, name, floaters, shake }: Props) {
  const p = state.player
  const hpPct = Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))
  return (
    <div className="flex items-end gap-3">
      {/* 影从小卡 */}
      <motion.div
        key={`pshake-${shake}`}
        animate={shake > 0 ? { x: [0, -6, 5, -3, 2, 0] } : undefined}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="relative h-[104px] w-[78px] overflow-hidden rounded-[12px] border border-[rgba(227,194,124,.4)] bg-panel shadow-card">
          <img src={portrait} alt={name} className="h-full w-full object-cover object-top" draggable={false} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(7,6,11,.85))]" />
          <div className="absolute inset-x-0 bottom-0.5 text-center font-serifsc text-[11px] leading-tight text-bone">{name}</div>
        </div>
        {/* 格挡盾标 */}
        {p.block > 0 && (
          <div className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full border border-[#7FC8E8]/70 bg-ink px-1.5 py-0.5 font-mono text-[12px] text-[#7FC8E8] shadow-[0_0_14px_rgba(127,200,232,.35)]">
            <Shield size={12} strokeWidth={2.5} />
            {p.block}
          </div>
        )}
        {/* 无敌标记 */}
        {state.counters.invulnerable && (
          <div className="absolute -left-2 -top-2 rounded-full border border-gold-300/70 bg-ink px-1.5 py-0.5 text-[10px] text-gold-300">
            无敌
          </div>
        )}
        {/* 飘字层 */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <AnimatePresence>
            {floaters.map((f) => (
              <motion.span
                key={f.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: [0, 1, 1, 0], y: -46 }}
                transition={{ duration: 0.9, times: [0, 0.15, 0.7, 1] }}
                className={cn('absolute top-1/4 drop-shadow-[0_2px_6px_rgba(0,0,0,.8)]', FLOATER_CLS[f.cls])}
              >
                {f.text}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
      {/* HP + 状态 + 能力 */}
      <div className="flex w-[190px] flex-col gap-1 pb-0.5 min-[1400px]:w-[220px]">
        <div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-[rgba(227,194,124,.25)] bg-ink/90">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#B0352E,#F0655A)] transition-[width] duration-300"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="mt-0.5 font-mono text-[12px] leading-none text-bone">
            {p.hp}
            <span className="text-dim">/{p.maxHp}</span>
          </div>
        </div>
        <StatusRow statuses={p.statuses} size="sm" />
        {state.powers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {state.powers.map((pid, i) => (
              <span
                key={`${pid}-${i}`}
                title={getCard(pid).desc}
                className="rounded-full border border-[#9B7FE8]/50 bg-[#9B7FE8]/12 px-1.5 py-0.5 font-sanssc text-[10px] leading-none text-[#9B7FE8]"
              >
                {getCard(pid).name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

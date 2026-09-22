/**
 * <HandArea> 手牌扇形区：旋转 ±6°、悬停抽起放大、费用不足置灰、选中上浮。
 */
import { canPlayCard } from '@/engine/spire/engine'
import type { BattleState } from '@/engine/spire/types'
import BattleCard from '@/components/spire/combat/BattleCard'
import { cn } from '@/lib/utils'

interface Props {
  state: BattleState
  selectedUid: number | null
  onSelect: (uid: number) => void
  busy: boolean
}

export default function HandArea({ state, selectedUid, onSelect, busy }: Props) {
  const hand = state.hand
  const n = hand.length
  const center = (n - 1) / 2
  const spacing = Math.min(86, 560 / Math.max(1, n))

  return (
    <div className="relative h-[190px] w-full select-none">
      {hand.map((inst, i) => {
        const offset = i - center
        const rot = Math.max(-6, Math.min(6, offset * 4))
        const playable = !busy && state.phase === 'player' && canPlayCard(state, inst.uid).ok
        const selected = selectedUid === inst.uid
        return (
          <div
            key={inst.uid}
            className={cn('absolute bottom-0 left-1/2 transition-transform duration-200 ease-ink')}
            style={{
              transform: `translateX(calc(-50% + ${offset * spacing}px)) translateY(${selected ? -30 : Math.abs(offset) * 4}px) rotate(${selected ? 0 : rot}deg) scale(${selected ? 1.12 : 1})`,
              zIndex: selected ? 40 : 10 + i,
              transformOrigin: 'bottom center',
            }}
          >
            <div className={cn('transition-transform duration-150 ease-ink', playable && !selected && 'hover:-translate-y-9 hover:scale-[1.15] hover:z-50')}>
              <BattleCard
                inst={inst}
                state={state}
                selected={selected}
                disabled={!playable && !selected}
                onClick={() => playable || selected ? onSelect(inst.uid) : undefined}
              />
            </div>
          </div>
        )
      })}
      {n === 0 && (
        <div className="absolute inset-x-0 bottom-4 text-center font-sanssc text-xs text-faint">手牌已空</div>
      )}
    </div>
  )
}

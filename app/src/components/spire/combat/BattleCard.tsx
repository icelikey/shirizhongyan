/**
 * <BattleCard> 战斗卡牌：费用宝石 + 卡面 + 名称 + 描述。
 * 稀有度边框：普通素线 / 罕见金线 / 稀有金线+光晕；三色系风格条。
 */
import { getCard } from '@/data/spire/cards'
import { cardCost, resolveCard } from '@/engine/spire/engine'
import type { BattleState, CardInstance } from '@/engine/spire/types'
import { CARD_TYPE_LABEL, FAMILY_META, RARITY_META, familyOf } from '@/components/spire/combat/cardMeta'
import { cn } from '@/lib/utils'

interface Props {
  inst: CardInstance
  /** 战斗中传入用于残卷等费用修正；奖励屏省略 */
  state?: BattleState
  selected?: boolean
  disabled?: boolean
  large?: boolean
  onClick?: () => void
}

export default function BattleCard({ inst, state, selected, disabled, large, onClick }: Props) {
  const def = getCard(inst.id)
  const resolved = resolveCard(inst)
  const cost = state ? cardCost(state, inst) : resolved.cost
  const fam = FAMILY_META[familyOf(def.id)]
  const rar = RARITY_META[def.rarity]
  const isCurse = def.rarity === 'curse'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex shrink-0 flex-col overflow-hidden rounded-[12px] border bg-panel text-left',
        'shadow-card transition-[transform,box-shadow,opacity,filter] duration-200 ease-ink',
        large ? 'h-[240px] w-[160px]' : 'h-[168px] w-[112px]',
        selected && 'ring-2 ring-gold-300',
        disabled ? 'cursor-not-allowed opacity-40 saturate-[.4]' : 'hover:brightness-110',
      )}
      style={{
        borderColor: rar.border,
        boxShadow: selected
          ? `0 0 0 2px rgba(227,194,124,.8), 0 0 26px ${fam.glow}`
          : rar.glow,
      }}
      title={resolved.desc}
    >
      {/* 卡面 */}
      <div className="relative h-[52%] w-full overflow-hidden bg-ink">
        <img src={def.art} alt="" className="h-full w-full object-cover" draggable={false} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,11,.15),transparent_40%,rgba(20,16,28,.9)_100%)]" />
        {/* 费用宝石 */}
        <div
          className={cn(
            'absolute left-1 top-1 flex items-center justify-center rounded-full border font-cinzel font-bold text-[#2A1E0C]',
            large ? 'h-7 w-7 text-[15px]' : 'h-6 w-6 text-[13px]',
          )}
          style={{
            background: isCurse
              ? 'linear-gradient(180deg,#5A5A6E,#2A2A38)'
              : 'linear-gradient(180deg,#F8E9C0 0%,#E3C27C 50%,#B9904A 100%)',
            borderColor: 'rgba(246,227,180,.6)',
            boxShadow: '0 0 10px rgba(227,194,124,.4)',
            color: isCurse ? '#A89F8D' : undefined,
          }}
        >
          {isCurse ? '—' : cost}
        </div>
        {/* 类型 + 色系 */}
        <div
          className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 font-sanssc text-[10px] leading-none"
          style={{ background: `${fam.color}22`, color: fam.color, border: `1px solid ${fam.color}55` }}
        >
          {CARD_TYPE_LABEL[def.type]}
        </div>
        {inst.upgraded && (
          <div className="absolute bottom-1 right-1 rounded-sm bg-gold-300 px-1 font-cinzel text-[10px] font-bold leading-tight text-[#2A1E0C]">
            +
          </div>
        )}
      </div>
      {/* 名称 + 描述 */}
      <div className="flex min-h-0 flex-1 flex-col px-1.5 py-1">
        <div className={cn('flex items-center gap-1 font-serifsc leading-tight text-bone', large ? 'text-[15px]' : 'text-[12px]')}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fam.color }} />
          {def.name}
        </div>
        <p
          className={cn(
            'mt-0.5 font-sanssc leading-snug text-dim',
            large ? 'line-clamp-4 text-[11px]' : 'line-clamp-3 text-[9.5px]',
          )}
        >
          {resolved.desc}
        </p>
      </div>
      {/* 底部色系条 */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${fam.color}, transparent)` }} />
    </button>
  )
}

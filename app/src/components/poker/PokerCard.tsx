/**
 * 丹丘牌楼 · 标准扑克牌面（CSS/文字渲染，不生成图片）。
 * 左上/右下 花色+点数，中央大花色；词条徽记（底部小圆点，按词条类色）。
 * 选中上浮由父级控制（selected → -translate-y）。
 */
import type { CSSProperties } from 'react'
import type { DeckCard } from '@/engine/poker/types'
import { RANK_LABEL, SUIT_SYMBOL } from '@/engine/poker/cards'
import { AFFIX_KIND_META, getAffix } from '@/data/poker/affixes'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

/** 牌面文字色（象牙底上保证对比度的深色变体） */
const FACE_COLOR: Record<DeckCard['suit'], string> = {
  spade: '#3A3F8F',
  heart: '#C13B45',
  club: '#1E7A55',
  diamond: '#B9741B',
}

export interface PokerCardProps {
  card: DeckCard
  selected?: boolean
  onClick?: () => void
  size?: 'xs' | 'sm' | 'md'
  disabled?: boolean
  /** 临时筹码加成（点金） */
  tempBuff?: number
  className?: string
  style?: CSSProperties
}

const SIZES = {
  xs: 'h-[64px] w-[44px] rounded-[6px] text-[11px]',
  sm: 'h-[92px] w-[64px] rounded-[8px] text-[13px]',
  md: 'h-[132px] w-[92px] rounded-[10px] text-base',
} as const

export default function PokerCard({ card, selected, onClick, size = 'md', disabled, tempBuff, className, style }: PokerCardProps) {
  const color = FACE_COLOR[card.suit]
  const sym = SUIT_SYMBOL[card.suit]
  const label = RANK_LABEL[card.rank]
  const centerSize = size === 'md' ? 30 : size === 'sm' ? 20 : 14

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative shrink-0 select-none border text-left transition-all duration-200 ease-snap',
        'bg-[linear-gradient(160deg,#F7F0DC_0%,#EDE2C4_55%,#DFD0A8_100%)]',
        SIZES[size],
        onClick && !disabled && 'hover:-translate-y-1.5 cursor-pointer',
        selected ? '-translate-y-4 shadow-[0_14px_30px_rgba(0,0,0,.55),0_0_18px_rgba(238,106,114,.45)]' : 'shadow-[0_6px_16px_rgba(0,0,0,.45)]',
        disabled && 'opacity-50',
        className,
      )}
      style={{
        borderColor: selected ? SUIT_META.heart.color : 'rgba(138,106,51,.65)',
        boxShadow: selected ? undefined : 'inset 0 0 0 1px rgba(7,6,11,.15), 0 6px 16px rgba(0,0,0,.45)',
        ...style,
      }}
    >
      {/* 左上角 */}
      <span className="absolute left-1 top-0.5 flex flex-col items-center leading-none" style={{ color }}>
        <span className={cn('font-cinzel font-bold', size === 'md' ? 'text-[15px]' : size === 'sm' ? 'text-[12px]' : 'text-[10px]')}>{label}</span>
        <span style={{ fontSize: centerSize * 0.42 }}>{sym}</span>
      </span>
      {/* 中央大花色 */}
      <span className="absolute inset-0 flex items-center justify-center" style={{ color, fontSize: centerSize, textShadow: '0 1px 0 rgba(255,255,255,.4)' }}>
        {sym}
      </span>
      {/* 右下角（倒置） */}
      <span className="absolute bottom-0.5 right-1 flex rotate-180 flex-col items-center leading-none" style={{ color }}>
        <span className={cn('font-cinzel font-bold', size === 'md' ? 'text-[15px]' : size === 'sm' ? 'text-[12px]' : 'text-[10px]')}>{label}</span>
        <span style={{ fontSize: centerSize * 0.42 }}>{sym}</span>
      </span>
      {/* 词条徽记 */}
      {card.affixes.length > 0 && (
        <span className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
          {card.affixes.map((id) => {
            const a = getAffix(id)
            const m = AFFIX_KIND_META[a.kind]
            return (
              <span
                key={id}
                title={`${m.name} · ${a.name}：${a.desc}`}
                className="flex h-4 w-4 items-center justify-center rounded-full border border-ink/60 font-mashan text-[9px] leading-none text-abyss"
                style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }}
              >
                {m.glyph}
              </span>
            )
          })}
        </span>
      )}
      {/* 临时加成 */}
      {tempBuff ? (
        <span className="absolute -top-2 right-1 rounded-full bg-suit-diamond px-1.5 font-mono text-[9px] font-semibold text-abyss">
          +{tempBuff}
        </span>
      ) : null}
    </button>
  )
}

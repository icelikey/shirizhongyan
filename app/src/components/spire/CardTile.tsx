/**
 * 碎境爬塔 · 卡牌行/格展示件（牌组抽屉、选牌器、商店共用）。
 * 左：费用徽（Cinzel）；中：牌名 + 类型/稀有度；右：描述。
 */
import type { CardView } from '@/game/spire-data'
import { cn } from '@/lib/utils'

const CARD_TYPE_LABEL: Record<CardView['type'], string> = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
}
const CARD_TYPE_COLOR: Record<CardView['type'], string> = {
  attack: '#F0655A',
  skill: '#8B93F8',
  power: '#E3C27C',
}
const RARITY_COLOR: Record<CardView['rarity'], string> = {
  common: '#A89F8D',
  uncommon: '#9B7FE8',
  rare: '#E8C15A',
  curse: '#D8443C',
}
const RARITY_LABEL: Record<CardView['rarity'], string> = {
  common: '普通',
  uncommon: '罕见',
  rare: '稀有',
  curse: '诅咒',
}

export interface CardTileProps {
  card: CardView
  /** 紧凑模式（牌组抽屉） */
  compact?: boolean
  className?: string
}

export default function CardTile({ card, compact = false, className }: CardTileProps) {
  const rarityColor = RARITY_COLOR[card.rarity]
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-[10px] border border-[rgba(227,194,124,.12)] bg-ink/60',
        compact ? 'px-3 py-2' : 'px-3.5 py-3',
        className,
      )}
    >
      {/* 稀有度侧条 */}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: rarityColor }} />
      {/* 费用徽 */}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-cinzel text-[14px] font-bold"
        style={{
          borderColor: card.rarity === 'curse' ? 'rgba(216,68,60,.5)' : 'rgba(227,194,124,.4)',
          color: card.rarity === 'curse' ? '#F0655A' : '#E3C27C',
          background: 'rgba(227,194,124,.06)',
        }}
      >
        {card.cost}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('font-serifsc text-bone', compact ? 'text-[13px]' : 'text-[14px]', card.upgraded && 'text-gold-300')}>
            {card.name}
          </span>
          <span className="text-[10px] tracking-wider" style={{ color: CARD_TYPE_COLOR[card.type] }}>
            {CARD_TYPE_LABEL[card.type]}
          </span>
          <span className="text-[10px] tracking-wider" style={{ color: rarityColor }}>
            {RARITY_LABEL[card.rarity]}
          </span>
        </div>
        {card.desc && <p className="mt-0.5 truncate text-[11px] leading-relaxed text-faint">{card.desc}</p>}
      </div>
      {card.upgraded && (
        <span className="shrink-0 rounded-full border border-gold-300/50 px-1.5 py-0.5 text-[9px] tracking-wider text-gold-300">
          已淬
        </span>
      )}
    </div>
  )
}

/**
 * <TierSeal> 位阶玺（design.md §10.7）。
 * 44×44 方形玉玺（圆角 8px），中央篆字。带光晕变体用于当前位阶。
 * 印章图：/tier-huang.svg /tier-xuan.svg /tier-di.svg /tier-tian.svg（+传说 /tier-honghuang.svg）。
 */
import type { Tier } from '@/data/tiers'
import { TIERS, getTier } from '@/data/tiers'
import MaskIcon from '@/components/MaskIcon'
import { cn } from '@/lib/utils'

export interface TierSealProps {
  tier: Tier | 'honghuang'
  size?: number
  /** 当前位阶光晕 */
  glow?: boolean
  className?: string
}

export default function TierSeal({ tier, size = 44, glow = false, className }: TierSealProps) {
  const meta = TIERS.find((t) => t.id === tier) ?? getTier('huang')
  const color = meta.id === 'honghuang' ? '#F8E9C0' : meta.color
  return (
    <span
      title={`${meta.name} · ${meta.lore}`}
      className={cn('inline-flex items-center justify-center rounded-lg border select-none', className)}
      style={{
        width: size,
        height: size,
        borderColor: `${color}66`,
        background: `${color}14`,
        boxShadow: glow ? `0 0 12px ${color}55, inset 0 0 6px ${color}22` : undefined,
      }}
    >
      <MaskIcon
        src={meta.seal}
        alt={meta.name}
        size={size * 0.72}
        color={color}
        style={glow ? { filter: `drop-shadow(0 0 4px ${color}88)` } : undefined}
      />
    </span>
  )
}

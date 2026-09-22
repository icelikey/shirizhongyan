/**
 * <FragmentChip> 碎片芯片（design.md §10.5）。
 * 圆角 999 深色芯片：花色图标 + Mono 数字。三规格 sm/md/lg。
 */
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import { cn } from '@/lib/utils'

const SIZES = {
  sm: { wrap: 'h-6 px-2 gap-1 text-[11px]', icon: 12, },
  md: { wrap: 'h-8 px-3 gap-1.5 text-[13px]', icon: 16 },
  lg: { wrap: 'h-10 px-4 gap-2 text-[15px]', icon: 20 },
} as const

/** 碎片用途提示（tooltip） */
const SUIT_USAGE: Record<Suit, string> = {
  spade: '玄渊碎片 · 狼人杀门票 / 建房 / 解锁残章',
  heart: '丹丘碎片 · 影从记忆槽 / 解锁残章',
  club: '青野碎片 · 猜平均数门票 / 建房 / 解锁残章',
  diamond: '金壤碎片 · 竞逐入场 / 解锁残章',
}

export interface FragmentChipProps {
  suit: Suit
  count: number
  size?: keyof typeof SIZES
  className?: string
}

export default function FragmentChip({ suit, count, size = 'md', className }: FragmentChipProps) {
  const meta = SUIT_META[suit]
  const s = SIZES[size]
  return (
    <span
      title={SUIT_USAGE[suit]}
      className={cn(
        'inline-flex items-center rounded-full border bg-ink/80 font-mono leading-none select-none',
        s.wrap,
        className,
      )}
      style={{ borderColor: meta.glow, color: meta.color }}
    >
      <SuitIcon suit={suit} size={s.icon} />
      <span>{count}</span>
    </span>
  )
}

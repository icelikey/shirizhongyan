/**
 * <SuitIcon> 四花色图标（design.md §10.4）。
 * 内联 SVG，stroke=currentColor —— 颜色由父级 text-suit-* 或 style 控制。
 * 与 public/suit-*.svg 保持同一套路径。
 */
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

const PATHS: Record<Suit, React.ReactNode> = {
  spade: (
    <path d="M32 8C26 18 16 26 16 36c0 7 5 12 11 12 2 0 4-.6 5-1.8-.4 3.4-1.6 6.6-4 9.8h8c-2.4-3.2-3.6-6.4-4-9.8 1 1.2 3 1.8 5 1.8 6 0 11-5 11-12C48 26 38 18 32 8Z" />
  ),
  heart: (
    <path d="M32 54C20 44 12 35 12 26c0-7 5-12 11-12 4 0 7 2 9 5 2-3 5-5 9-5 6 0 11 5 11 12 0 9-8 18-20 28Z" />
  ),
  club: (
    <>
      <circle cx="32" cy="20" r="9" />
      <circle cx="20" cy="38" r="9" />
      <circle cx="44" cy="38" r="9" />
      <path d="M32 42c-.4 4-1.6 8-4 12h8c-2.4-4-3.6-8-4-12" />
    </>
  ),
  diamond: <path d="M32 8 48 32 32 56 16 32Z" />,
}

export interface SuitIconProps {
  suit: Suit
  /** 像素尺寸（14/18/24/32） */
  size?: 14 | 18 | 24 | 32 | number
  /** 加花色光晕 drop-shadow */
  glow?: boolean
  className?: string
}

export default function SuitIcon({ suit, size = 18, glow = false, className }: SuitIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={SUIT_META[suit].realm}
      className={cn('shrink-0', className)}
      style={glow ? { filter: `drop-shadow(0 0 8px ${SUIT_META[suit].glow})` } : undefined}
    >
      {PATHS[suit]}
    </svg>
  )
}

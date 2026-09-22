/**
 * 按钮体系（design.md §10.13）。
 * - variant="gold"   主按钮（§2.2 渐变 + 内阴影 + 外发光），文字 #2A1E0C
 * - variant="ghost"  透明 + 1px 金线，悬停金线亮起 + 字色转金
 * - variant="danger" 朱砂描边，用于退出/放弃
 * - variant="suit"   花色主题按钮（对局页门票/提交），需配合 suit 属性
 * 按压 scale .97；图标按钮用 lucide-react 18px。
 */
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

export interface GoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'ghost' | 'danger' | 'suit'
  suit?: Suit
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES = {
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-10 px-6 text-sm',
  lg: 'h-12 px-8 text-[15px]',
  xl: 'h-14 px-10 text-base',
} as const

const GoldButton = forwardRef<HTMLButtonElement, GoldButtonProps>(function GoldButton(
  { variant = 'gold', suit = 'club', size = 'md', className, style, children, ...rest },
  ref,
) {
  const suitMeta = SUIT_META[suit]
  const variantStyle =
    variant === 'gold'
      ? {
          background: 'linear-gradient(180deg, #F1D9A2 0%, #E3C27C 45%, #B9904A 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,246,220,.7), 0 0 24px rgba(227,194,124,.25)',
          color: '#2A1E0C',
        }
      : variant === 'danger'
        ? { border: '1px solid rgba(216,68,60,.6)', color: '#F0655A', background: 'rgba(216,68,60,.08)' }
        : variant === 'suit'
          ? {
              border: `1px solid ${suitMeta.color}88`,
              color: suitMeta.color,
              background: `${suitMeta.color}1F`,
              boxShadow: `0 0 16px ${suitMeta.glow}`,
            }
          : { border: '1px solid rgba(227,194,124,.28)', color: '#A89F8D', background: 'transparent' }

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-sanssc font-medium tracking-[.2em] select-none',
        'transition-all duration-200 ease-ink active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none',
        variant === 'gold' && 'hover:brightness-110 font-semibold',
        variant === 'ghost' && 'hover:border-[rgba(246,227,180,.55)] hover:text-gold-300',
        variant === 'danger' && 'hover:bg-cinnabar/20 hover:border-cinnabar-hi',
        variant === 'suit' && 'hover:brightness-125',
        SIZES[size],
        className,
      )}
      style={{ ...variantStyle, ...style }}
      {...rest}
    >
      {children}
    </button>
  )
})

export default GoldButton

/**
 * <SectionHeader> 区块标题（H2 金字 + 副题 + 可选竖排侧款）。
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionHeaderProps {
  title: string
  subtitle?: string
  /** 竖排侧款（如「设局」「名录」） */
  sideMark?: string
  right?: ReactNode
  className?: string
}

export default function SectionHeader({ title, subtitle, sideMark, right, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="flex items-end gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="gold-text font-serifsc font-semibold text-[22px] leading-tight tracking-[.08em]">{title}</h2>
          {subtitle && <p className="mt-1 text-[12px] text-faint tracking-[.2em]">{subtitle}</p>}
        </div>
        {sideMark && (
          <span className="vertical-rl hidden sm:block font-mashan text-[13px] text-gold-500/70 pb-0.5">{sideMark}</span>
        )}
      </div>
      {right}
    </div>
  )
}

/**
 * <TendencyBar> 行为倾向条（agent.md §A2/详情 Modal）。
 * 五段刻度条：标签 + 1-5 值，段块滑动点亮（600ms）。
 */
import { cn } from '@/lib/utils'

export interface TendencyBarProps {
  label: string
  /** 1-5 */
  value: number
  color?: string
  className?: string
}

export default function TendencyBar({ label, value, color = '#E3C27C', className }: TendencyBarProps) {
  const v = Math.max(1, Math.min(5, Math.round(value)))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="w-8 shrink-0 text-[11px] text-dim tracking-wider">{label}</span>
      <span className="flex flex-1 gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-500 ease-ink"
            style={{
              transitionDelay: `${i * 80}ms`,
              background: i < v ? color : 'rgba(227,194,124,.12)',
              boxShadow: i < v ? `0 0 6px ${color}66` : 'none',
            }}
          />
        ))}
      </span>
    </div>
  )
}

/**
 * <MetaSwitch> 墨色金边开关（代打授权 / 建房选项用）。
 */
import { cn } from '@/lib/utils'

export interface MetaSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  className?: string
  label?: string
}

export default function MetaSwitch({ checked, onChange, disabled = false, className, label }: MetaSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ease-ink disabled:opacity-40',
        checked ? 'border-gold-300/70 bg-gold-300/25' : 'border-[rgba(227,194,124,.2)] bg-ink',
        className,
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-200 ease-ink',
          checked ? 'left-[22px] bg-gold-300 shadow-gold-glow' : 'left-[3px] bg-faint',
        )}
      />
    </button>
  )
}

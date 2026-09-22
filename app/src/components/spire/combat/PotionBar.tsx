/**
 * <PotionBar> 药水栏（3 格）。点击使用；需目标的药水进入选目标态。
 * 图标用 lucide（按数据 icon 字段映射，非 emoji）。
 */
import { CloudFog, Coffee, Crosshair, FlaskConical, HeartPulse, Shield, Wine } from 'lucide-react'
import { getPotion } from '@/data/spire/potions'
import { cn } from '@/lib/utils'

const POTION_ICON: Record<string, typeof FlaskConical> = {
  HeartPulse, Wine, Shield, CloudFog, Crosshair, Coffee,
}

interface Props {
  potions: string[]
  selectedPotion: string | null
  disabled: boolean
  onClick: (potionId: string) => void
}

export default function PotionBar({ potions, selectedPotion, disabled, onClick }: Props) {
  return (
    <div className="flex items-center gap-1.5" title="药水栏">
      {[0, 1, 2].map((slot) => {
        const pid = potions[slot]
        if (!pid) {
          return <div key={slot} className="h-9 w-9 rounded-[10px] border border-dashed border-[rgba(227,194,124,.18)] bg-ink/40" />
        }
        const def = getPotion(pid)
        const Icon = POTION_ICON[def.icon] ?? FlaskConical
        const selected = selectedPotion === pid
        return (
          <button
            key={`${pid}-${slot}`}
            type="button"
            title={`${def.name}：${def.desc}`}
            disabled={disabled}
            onClick={() => onClick(pid)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-[10px] border bg-panel transition-all duration-150',
              selected
                ? 'border-gold-300 text-gold-100 shadow-[0_0_16px_rgba(227,194,124,.45)]'
                : 'border-[rgba(227,194,124,.3)] text-gold-300 hover:border-[rgba(246,227,180,.55)] hover:brightness-125',
              disabled && 'opacity-40',
            )}
          >
            <Icon size={17} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}

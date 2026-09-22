/**
 * <StatusRow> 状态图标列（图标 + 层数，title tooltip）。
 */
import { ArrowDown, ChevronsUp, Crosshair, Droplet, Flame, Shield } from 'lucide-react'
import type { StatusId } from '@/data/spire/types'
import type { StatusMap } from '@/engine/spire/types'
import { STATUS_META } from '@/components/spire/combat/cardMeta'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<StatusId, typeof Flame> = {
  strength: ChevronsUp,
  dexterity: Shield,
  vulnerable: Crosshair,
  weak: ArrowDown,
  poison: Droplet,
  burn: Flame,
}

export default function StatusRow({ statuses, size = 'md' }: { statuses: StatusMap; size?: 'sm' | 'md' }) {
  const entries = (Object.entries(statuses) as [StatusId, number][]).filter(([, v]) => v !== 0)
  if (entries.length === 0) return null
  const iconSize = size === 'sm' ? 11 : 13
  return (
    <div className="flex flex-wrap items-center gap-1">
      {entries.map(([id, layers]) => {
        const meta = STATUS_META[id]
        const Icon = STATUS_ICON[id]
        return (
          <span
            key={id}
            title={`${meta.name} ${layers} 层：${meta.desc}`}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border font-mono leading-none',
              size === 'sm' ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[11px]',
            )}
            style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
          >
            <Icon size={iconSize} strokeWidth={2.5} />
            {layers}
          </span>
        )
      })}
    </div>
  )
}

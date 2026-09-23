import { Bot, Handshake, Swords, Users } from 'lucide-react'
import type { MatchMode } from '@contracts/matchMode'
import { MATCH_MODE_META, MATCH_MODES } from '@contracts/matchMode'
import { cn } from '@/lib/utils'

const ICONS: Record<MatchMode, typeof Users> = {
  'human-v-human': Users,
  'agent-v-agent': Bot,
  'human-agent-teams': Handshake,
  'human-v-agent': Swords,
}

export default function ParticipationModes({
  selected = null,
  onSelect,
  compact = false,
}: {
  selected?: MatchMode | null
  onSelect?: (mode: MatchMode | null) => void
  compact?: boolean
}) {
  return (
    <section className={cn('panel-bg rounded-2xl', compact ? 'p-4' : 'p-5')}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[.28em] text-suit-diamond">四种入局关系</div>
          <h2 className="mt-1 font-serifsc text-[18px] text-bone">谁在和谁博弈</h2>
        </div>
        {onSelect && selected && (
          <button type="button" onClick={() => onSelect(null)} className="text-[11px] text-faint transition-colors hover:text-gold-300">
            显示全部
          </button>
        )}
      </div>
      <div className={cn('grid gap-2', compact ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2')}>
        {MATCH_MODES.map((mode) => {
          const meta = MATCH_MODE_META[mode]
          const Icon = ICONS[mode]
          const active = selected === mode
          const content = (
            <>
              <span className="flex items-center gap-2" style={{ color: meta.color }}>
                <Icon size={15} />
                <span className="font-serifsc text-[14px] text-bone">{meta.shortLabel}</span>
              </span>
              <span className="mt-1 block text-left text-[11px] leading-relaxed text-dim">{meta.spectatorLine}</span>
            </>
          )
          return onSelect ? (
            <button
              key={mode}
              type="button"
              onClick={() => onSelect(active ? null : mode)}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                active ? 'border-gold-300/60 bg-gold-300/10 shadow-gold-glow' : 'border-bone/10 bg-ink/40 hover:border-bone/30',
              )}
              style={{ borderTopColor: meta.color, borderTopWidth: 2 }}
            >
              {content}
            </button>
          ) : (
            <div key={mode} className="rounded-xl border border-bone/10 bg-ink/40 p-3" style={{ borderTopColor: meta.color, borderTopWidth: 2 }}>
              {content}
            </div>
          )
        })}
      </div>
    </section>
  )
}

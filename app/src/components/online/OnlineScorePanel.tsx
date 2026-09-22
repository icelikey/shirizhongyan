/**
 * 联机积分榜（右栏）：按累计分降序，标注席位出身徽标，本人高亮。
 */
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import type { GuessSeatView } from '@contracts/room'
import SeatKindBadge from '@/components/online/SeatKindBadge'
import { cn } from '@/lib/utils'

export default function OnlineScorePanel({
  seats,
  mySeat,
  winner,
}: {
  seats: GuessSeatView[]
  mySeat: number | null
  winner?: number | null
}) {
  const sorted = [...seats].sort((a, b) => b.score - a.score || a.index - b.index)
  return (
    <div className="panel-bg rounded-xl p-3 shrink-0">
      <div className="text-[11px] tracking-[.25em] text-faint mb-2">积分榜</div>
      <div className="flex flex-col gap-1">
        {sorted.map((s, rank) => (
          <motion.div
            key={s.index}
            layout="position"
            className={cn(
              'flex items-center gap-2 py-1.5 px-1.5 rounded-lg',
              s.index === mySeat && 'bg-[rgba(227,194,124,.08)] border border-[rgba(227,194,124,.15)]',
            )}
          >
            <span className="font-cinzel text-[13px] w-4 text-dim">{rank + 1}</span>
            {winner === s.index && <Crown size={13} className="text-gold-300 shrink-0" />}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className={cn('text-[13px] truncate', s.index === mySeat ? 'text-gold-300' : 'text-bone')}>
                {s.name}
              </span>
              <SeatKindBadge kind={s.kind} />
            </div>
            <span className="font-mono text-[15px] text-bone w-6 text-right">{s.score}</span>
          </motion.div>
        ))}
        {seats.length === 0 && <span className="text-[12px] text-faint py-2">席位就绪中…</span>}
      </div>
    </div>
  )
}

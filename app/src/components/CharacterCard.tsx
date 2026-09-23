import { motion } from 'framer-motion'
import type { Echo } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import { cn } from '@/lib/utils'

interface CharacterCardProps {
  echo: Echo
  selected?: boolean
  onSelect: () => void
  className?: string
}

export default function CharacterCard({ echo, selected = false, onSelect, className }: CharacterCardProps) {
  const suit = SUIT_META[echo.suit]
  const art = echo.cardArt ?? echo.portrait

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      whileHover={{ y: -8, rotate: selected ? 0 : -1.5 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'group relative aspect-[2/3] overflow-hidden rounded-[18px] text-left transition-shadow duration-300',
        selected ? 'shadow-[0_0_0_1px_rgba(246,227,180,.82),0_22px_55px_rgba(0,0,0,.62)]' : 'shadow-[0_18px_45px_rgba(0,0,0,.45)]',
        className,
      )}
      style={{ background: `linear-gradient(160deg, ${suit.color}28, #0C0A13 68%)` }}
    >
      <img
        src={art}
        alt={`${echo.name}角色卡立绘`}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,4,9,.62)_0%,transparent_34%,transparent_54%,rgba(5,4,9,.96)_100%)]" />
      <div className="absolute inset-0 rounded-[18px] border border-[rgba(246,227,180,.35)]" style={{ boxShadow: `inset 0 0 0 1px ${suit.color}44` }} />

      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <span className="font-cinzel text-[10px] tracking-[.22em] text-gold-100/80">ECHO / CARD</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border" style={{ color: suit.color, borderColor: `${suit.color}88`, background: '#0C0A13B8' }}>
          <SuitIcon suit={echo.suit} size={16} />
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] tracking-[.18em]" style={{ color: suit.color }}>
          <span>{suit.realm}</span>
          <span className="h-px w-7" style={{ backgroundColor: `${suit.color}88` }} />
          <span className="text-gold-100/70">{echo.persona}</span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serifsc text-[27px] font-black tracking-[.13em] text-bone">{echo.name}</h2>
          <span className="rounded-full border border-[rgba(246,227,180,.25)] bg-[#0C0A13B8] px-2 py-1 font-mono text-[10px] text-gold-100/80">
            {(echo.winRate * 100).toFixed(0)}%胜率
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-bone/70">{echo.tagline}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${echo.winRate * 100}%` }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${suit.color}66, ${suit.color})` }}
          />
        </div>
      </div>
    </motion.button>
  )
}

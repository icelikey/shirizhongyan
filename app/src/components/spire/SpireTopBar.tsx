/**
 * 碎境爬塔 · 地图页顶栏（spire-map.md §3.2 顶栏）。
 * HP 条 / 金币 / 层数（第 N 层 · 金壤/玄渊/十日之巅）/ 牌组按钮 / 遗物栏 / 药水栏（≤3）。
 */
import { Coins, Heart, Layers } from 'lucide-react'
import { useSpire } from '@/store/spire'
import { PotionIcon, RelicIcon } from '@/components/spire/icons'
import { potionView, relicView } from '@/game/spire-data'
import { cn } from '@/lib/utils'

/** 层域名：1 金壤 / 2 玄渊 / 3 十日之巅 */
export const FLOOR_NAMES = ['金壤', '玄渊', '十日之巅'] as const

export interface SpireTopBarProps {
  onOpenDeck: () => void
}

export default function SpireTopBar({ onOpenDeck }: SpireTopBarProps) {
  const hp = useSpire((s) => s.hp)
  const maxHp = useSpire((s) => s.maxHp)
  const gold = useSpire((s) => s.gold)
  const floor = useSpire((s) => s.floor)
  const deckCount = useSpire((s) => s.deck.length)
  const relics = useSpire((s) => s.relics)
  const potions = useSpire((s) => s.potions)

  const hpPct = maxHp > 0 ? Math.min(100, (hp / maxHp) * 100) : 0
  const floorName = FLOOR_NAMES[Math.min(Math.max(floor, 1), 3) - 1]

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-b border-[rgba(227,194,124,.14)] bg-ink/80 px-4 backdrop-blur-md">
      {/* HP */}
      <div className="flex min-w-[180px] items-center gap-2" title={`生命 ${hp}/${maxHp}`}>
        <Heart size={15} className={cn('shrink-0', hpPct <= 25 ? 'text-cinnabar-hi' : 'text-suit-diamond')} />
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(227,194,124,.12)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${hpPct}%`,
              background:
                hpPct <= 25
                  ? 'linear-gradient(90deg,#8A2A24,#F0655A)'
                  : 'linear-gradient(90deg,#8A6A33,#F2A93B)',
              boxShadow: hpPct <= 25 ? '0 0 10px rgba(240,101,90,.5)' : '0 0 10px rgba(242,169,59,.4)',
            }}
          />
        </div>
        <span className={cn('font-mono text-[12px]', hpPct <= 25 ? 'text-cinnabar-hi' : 'text-bone')}>
          {hp}<span className="text-faint">/{maxHp}</span>
        </span>
      </div>

      {/* 金币 */}
      <span className="flex items-center gap-1.5 font-mono text-[13px] text-gold-300" title="金币（商店通用）">
        <Coins size={14} />
        {gold}
      </span>

      {/* 层数 */}
      <span className="hidden items-center gap-2 text-[12px] tracking-[.2em] text-dim sm:flex">
        第 <span className="font-cinzel text-[15px] text-gold-300">{floor}</span> 层
        <span className="text-faint">·</span>
        <span className="text-suit-diamond">{floorName}</span>
      </span>

      <span className="flex-1" />

      {/* 牌组 */}
      <button
        type="button"
        onClick={onOpenDeck}
        className="flex h-8 items-center gap-1.5 rounded-full border border-[rgba(227,194,124,.25)] px-3 text-[12px] tracking-wider text-dim transition-all duration-200 hover:border-[rgba(246,227,180,.55)] hover:text-gold-300"
        title="浏览牌组"
      >
        <Layers size={13} />
        牌组 <span className="font-mono text-bone">{deckCount}</span>
      </button>

      {/* 遗物栏 */}
      <div className="hidden items-center gap-1.5 md:flex" title="遗物栏">
        {relics.length === 0 && <span className="text-[11px] text-faint">无遗物</span>}
        {relics.map((id, i) => {
          const r = relicView(id)
          return (
            <span
              key={`${id}-${i}`}
              title={`${r.name} — ${r.desc}`}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(242,169,59,.3)] bg-suit-diamond/[.07]"
            >
              <RelicIcon id={id} size={19} />
            </span>
          )
        })}
      </div>

      {/* 药水栏（≤3） */}
      <div className="flex items-center gap-1.5" title="药水栏（至多 3 瓶）">
        {[0, 1, 2].map((i) => {
          const id = potions[i]
          if (!id) {
            return <span key={i} className="h-8 w-8 rounded-[8px] border border-dashed border-[rgba(227,194,124,.18)]" />
          }
          const p = potionView(id)
          return (
            <span
              key={`${id}-${i}`}
              title={`${p.name} — ${p.desc}`}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(227,194,124,.3)] bg-ink/60"
            >
              <PotionIcon id={id} size={19} style={{ color: '#E3C27C' }} />
            </span>
          )
        })}
      </div>
    </div>
  )
}

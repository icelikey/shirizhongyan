/**
 * 碎境爬塔 · 篝火弹层（spire-map.md §3.2 篝火节点）。
 * 二选一：疗伤（回血 30% maxHp） / 淬牌（升级一张牌，upgradeCard）。
 */
import { useState } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useSpire } from '@/store/spire'
import MetaModal from '@/components/meta/Modal'
import CardPickerModal from '@/components/spire/CardPickerModal'
import { cardView } from '@/game/spire-data'

export interface RestModalProps {
  onDone: () => void
}

export default function RestModal({ onDone }: RestModalProps) {
  const hp = useSpire((s) => s.hp)
  const maxHp = useSpire((s) => s.maxHp)
  const deck = useSpire((s) => s.deck)
  const heal = useSpire((s) => s.heal)
  const upgradeCard = useSpire((s) => s.upgradeCard)
  const [picking, setPicking] = useState(false)

  const healAmount = Math.round(maxHp * 0.3)
  const upgradable = deck.filter((c) => !c.startsWith('+') && cardView(c).rarity !== 'curse')

  const doHeal = () => {
    heal(healAmount)
    toast.success('火光温养', { description: `生命 +${healAmount}（${hp} → ${Math.min(maxHp, hp + healAmount)}）` })
    onDone()
  }

  return (
    <>
      <MetaModal open onClose={() => {}} title="篝火" sideMark="歇息" width={520}>
        <p className="mb-5 text-[13px] leading-relaxed text-dim">
          一堆不知谁留下的火，火苗是琥珀色的。你可以烤烤伤口，也可以把一张牌架在火上淬一淬。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={doHeal}
            className="group flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/50 p-5 transition-all duration-200 ease-ink hover:-translate-y-0.5 hover:border-[rgba(246,227,180,.5)]"
          >
            <Flame size={26} className="text-suit-diamond transition-transform group-hover:scale-110" />
            <span className="font-serifsc text-[15px] text-bone">疗伤</span>
            <span className="text-[11px] leading-relaxed text-faint">
              回复 <span className="font-mono text-ok">{healAmount}</span> 点生命（上限 30%）
            </span>
            <span className="font-mono text-[11px] text-dim">
              {hp}/{maxHp} → {Math.min(maxHp, hp + healAmount)}/{maxHp}
            </span>
          </button>
          <button
            type="button"
            onClick={() => upgradable.length > 0 && setPicking(true)}
            disabled={upgradable.length === 0}
            className="group flex flex-col items-center gap-2 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/50 p-5 transition-all duration-200 ease-ink hover:-translate-y-0.5 hover:border-[rgba(246,227,180,.5)] disabled:pointer-events-none disabled:opacity-40"
          >
            <Sparkles size={26} className="text-gold-300 transition-transform group-hover:scale-110" />
            <span className="font-serifsc text-[15px] text-bone">淬牌</span>
            <span className="text-[11px] leading-relaxed text-faint">升级牌组中一张未淬之牌</span>
            <span className="font-mono text-[11px] text-dim">可淬 {upgradable.length} 张</span>
          </button>
        </div>
      </MetaModal>

      <CardPickerModal
        open={picking}
        title="择一张牌入火淬炼"
        cards={upgradable}
        emptyTip="所有牌都已淬过火"
        onPick={(entry) => {
          upgradeCard(entry)
          toast.success('淬炼完成', { description: `「${cardView(entry).name}」→「${cardView(`+${entry}`).name}」` })
          setPicking(false)
          onDone()
        }}
        onClose={() => setPicking(false)}
      />
    </>
  )
}

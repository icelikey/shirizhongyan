/**
 * ============================================================================
 * 碎境爬塔 · 商店弹层（spire-map.md §3.2 商店节点）
 * ============================================================================
 * 6 商品：3 卡（30–80 金，按稀有度分档）+ 1 遗物（120–180）+ 2 药水（40–60）；
 * 另售「撤牌」服务：75 金移除一张牌，每店限购一次。
 * 库存由 genShopStock() 在进节点时生成（随机）；离开即完成节点。
 * ============================================================================
 */
import { useState } from 'react'
import { Coins, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSpire } from '@/store/spire'
import MetaModal from '@/components/meta/Modal'
import GoldButton from '@/components/GoldButton'
import CardTile from '@/components/spire/CardTile'
import CardPickerModal from '@/components/spire/CardPickerModal'
import { PotionIcon, RelicIcon } from '@/components/spire/icons'
import { cardView, potionView, relicView } from '@/game/spire-data'
import { REMOVE_PRICE } from '@/game/shop'
import type { ShopStock } from '@/game/shop'
import { cn } from '@/lib/utils'

export interface ShopModalProps {
  stock: ShopStock
  onLeave: () => void
}

export default function ShopModal({ stock, onLeave }: ShopModalProps) {
  const gold = useSpire((s) => s.gold)
  const deck = useSpire((s) => s.deck)
  const potions = useSpire((s) => s.potions)
  const spendGold = useSpire((s) => s.spendGold)
  const addCard = useSpire((s) => s.addCard)
  const addRelic = useSpire((s) => s.addRelic)
  const addPotion = useSpire((s) => s.addPotion)
  const removeCard = useSpire((s) => s.removeCard)

  const [sold, setSold] = useState<Set<string>>(new Set())
  const [removeUsed, setRemoveUsed] = useState(false)
  const [pickingRemove, setPickingRemove] = useState(false)

  const buy = (key: string, price: number, apply: () => void, what: string) => {
    if (sold.has(key)) return
    if (!spendGold(price)) {
      toast.error('金币不足', { description: `${what} 需 ${price} 金` })
      return
    }
    apply()
    setSold((s) => new Set(s).add(key))
    toast.success(`购得${what}`, { description: `-${price} 金` })
  }

  const potionFull = potions.length >= 3

  return (
    <>
      <MetaModal open onClose={onLeave} title="刀币商店" sideMark="童叟无欺" width={620}>
        <div className="mb-4 flex items-center justify-between rounded-[10px] border border-[rgba(227,194,124,.14)] bg-ink/60 px-4 py-2.5">
          <span className="text-[12px] tracking-[.2em] text-dim">所持金币</span>
          <span className="flex items-center gap-1.5 font-mono text-[15px] text-gold-300">
            <Coins size={14} /> {gold}
          </span>
        </div>

        <div className="flex max-h-[54dvh] flex-col gap-2.5 overflow-y-auto pr-1">
          {/* 卡牌 */}
          {stock.cards.map((c) => {
            const key = `card-${c.id}`
            const isSold = sold.has(key)
            return (
              <div key={key} className={cn('flex items-center gap-3', isSold && 'opacity-40')}>
                <div className="min-w-0 flex-1">
                  <CardTile card={cardView(c.id)} />
                </div>
                <GoldButton
                  size="sm"
                  variant="suit"
                  suit="diamond"
                  disabled={isSold || gold < c.price}
                  onClick={() => buy(key, c.price, () => addCard(c.id), `「${cardView(c.id).name}」`)}
                  className="w-[76px] shrink-0 tracking-normal"
                >
                  {isSold ? '已售' : `${c.price} 金`}
                </GoldButton>
              </div>
            )
          })}

          {/* 遗物 */}
          {stock.relic &&
            (() => {
              const r = relicView(stock.relic!.id)
              const key = `relic-${r.id}`
              const isSold = sold.has(key)
              return (
                <div className={cn('flex items-center gap-3 rounded-[10px] border border-[rgba(242,169,59,.25)] bg-suit-diamond/[.06] px-3.5 py-3', isSold && 'opacity-40')}>
                  <RelicIcon id={r.id} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="font-serifsc text-[14px] text-bone">{r.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-faint">{r.desc}</p>
                  </div>
                  <GoldButton
                    size="sm"
                    variant="suit"
                    suit="diamond"
                    disabled={isSold || gold < stock.relic!.price}
                    onClick={() => buy(key, stock.relic!.price, () => addRelic(r.id), `遗物「${r.name}」`)}
                    className="w-[76px] shrink-0 tracking-normal"
                  >
                    {isSold ? '已售' : `${stock.relic!.price} 金`}
                  </GoldButton>
                </div>
              )
            })()}

          {/* 药水 */}
          {stock.potions.map((p) => {
            const v = potionView(p.id)
            const key = `potion-${p.id}`
            const isSold = sold.has(key)
            return (
              <div key={key} className={cn('flex items-center gap-3 rounded-[10px] border border-[rgba(227,194,124,.12)] bg-ink/60 px-3.5 py-3', isSold && 'opacity-40')}>
                <PotionIcon id={p.id} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="font-serifsc text-[14px] text-bone">{v.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-faint">{v.desc}</p>
                </div>
                <GoldButton
                  size="sm"
                  variant="suit"
                  suit="diamond"
                  disabled={isSold || potionFull || gold < p.price}
                  title={potionFull ? '药水栏已满' : undefined}
                  onClick={() => {
                    if (potionFull) return
                    buy(key, p.price, () => {
                      if (!addPotion(p.id)) toast.error('药水栏已满')
                    }, `药水「${v.name}」`)
                  }}
                  className="w-[76px] shrink-0 tracking-normal"
                >
                  {isSold ? '已售' : `${p.price} 金`}
                </GoldButton>
              </div>
            )
          })}

          {/* 撤牌服务 */}
          <div className={cn('flex items-center gap-3 rounded-[10px] border border-dashed border-[rgba(216,68,60,.35)] bg-cinnabar/[.05] px-3.5 py-3', removeUsed && 'opacity-40')}>
            <Trash2 size={20} className="shrink-0 text-cinnabar-hi" />
            <div className="min-w-0 flex-1">
              <p className="font-serifsc text-[14px] text-bone">撤牌</p>
              <p className="mt-0.5 text-[11px] text-faint">从牌组移除一张牌（含业债），每店限一次</p>
            </div>
            <GoldButton
              size="sm"
              variant="danger"
              disabled={removeUsed || deck.length === 0 || gold < REMOVE_PRICE}
              onClick={() => setPickingRemove(true)}
              className="w-[76px] shrink-0 tracking-normal"
            >
              {removeUsed ? '已用' : `${REMOVE_PRICE} 金`}
            </GoldButton>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <GoldButton variant="ghost" size="sm" onClick={onLeave}>
            离开商店
          </GoldButton>
        </div>
      </MetaModal>

      <CardPickerModal
        open={pickingRemove}
        title="择一张牌撤出牌组"
        cards={deck}
        onPick={(entry) => {
          if (!spendGold(REMOVE_PRICE)) {
            toast.error('金币不足', { description: `撤牌需 ${REMOVE_PRICE} 金` })
            setPickingRemove(false)
            return
          }
          removeCard(entry)
          setRemoveUsed(true)
          setPickingRemove(false)
          toast.success('已撤牌', { description: `「${cardView(entry).name}」离开牌组 · -${REMOVE_PRICE} 金` })
        }}
        onClose={() => setPickingRemove(false)}
      />
    </>
  )
}

/**
 * 碎境爬塔 · 选牌弹层（篝火淬牌 / 商店撤牌 / 事件祭牌共用）。
 * - filter 决定可选牌（如不可淬的诅咒/已淬牌会被排除）。
 * - required=true 时不提供取消（事件「以记忆为祭」必须选一张）。
 */
import MetaModal from '@/components/meta/Modal'
import { cardView } from '@/game/spire-data'
import type { CardView } from '@/game/spire-data'
import CardTile from '@/components/spire/CardTile'
import { cn } from '@/lib/utils'

export interface CardPickerModalProps {
  open: boolean
  title: string
  /** 候选牌（牌组条目，可含 '+' 前缀） */
  cards: string[]
  /** 空候选时的提示 */
  emptyTip?: string
  /** 必选（无取消按钮） */
  required?: boolean
  onPick: (deckEntry: string) => void
  onClose: () => void
}

export default function CardPickerModal({ open, title, cards, emptyTip = '没有可选择的牌', required = false, onPick, onClose }: CardPickerModalProps) {
  return (
    <MetaModal open={open} onClose={required ? () => {} : onClose} title={title} sideMark="择牌" width={520}>
      {cards.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-faint">{emptyTip}</p>
      ) : (
        <div className="flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pr-1">
          {cards.map((entry, i) => {
            const view: CardView = cardView(entry)
            return (
              <button
                key={`${entry}-${i}`}
                type="button"
                onClick={() => onPick(entry)}
                className={cn(
                  'group text-left transition-all duration-150 ease-ink',
                  'hover:-translate-y-0.5 hover:drop-shadow-[0_0_12px_rgba(227,194,124,.25)]',
                )}
              >
                <CardTile card={view} className="group-hover:border-[rgba(246,227,180,.45)]" />
              </button>
            )
          })}
        </div>
      )}
      {required && <p className="mt-3 text-center text-[11px] tracking-wider text-cinnabar-hi">此祭不可反悔，请择一张。</p>}
    </MetaModal>
  )
}

/**
 * 门票不足弹窗：碎片不够门票时，提供「友谊局」（免门票无奖励）或返回大厅。
 */
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import GameModal from '@/components/game/GameModal'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'

export interface TicketModalProps {
  open: boolean
  suit: Suit
  cost: number
  balance: number
  gameName: string
  onFriendly: () => void
  onExit: () => void
}

export default function TicketModal({ open, suit, cost, balance, gameName, onFriendly, onExit }: TicketModalProps) {
  const meta = SUIT_META[suit]
  return (
    <GameModal open={open} title="门票不足">
      <div className="flex flex-col items-center gap-5 text-center">
        <span style={{ color: meta.color }}>
          <SuitIcon suit={suit} size={40} glow />
        </span>
        <p className="text-[14px] text-dim leading-relaxed">
          {gameName}的门票为 <span className="font-mono" style={{ color: meta.color }}>{cost} {meta.symbol}</span>，
          你当前仅有 <span className="font-mono" style={{ color: meta.color }}>{balance} {meta.symbol}</span>。
          <br />
          可以开一局不计奖励的「友谊局」，或返回大厅另行筹备。
        </p>
        <div className="flex items-center gap-4">
          <GoldButton variant="suit" suit={suit} size="lg" onClick={onFriendly}>
            友谊局 · 免票
          </GoldButton>
          <GoldButton variant="ghost" size="lg" onClick={onExit}>
            返回大厅
          </GoldButton>
        </div>
        <p className="text-[11px] text-faint tracking-wider">友谊局不消耗门票，结算时也不发放碎片与生肖进度</p>
      </div>
    </GameModal>
  )
}

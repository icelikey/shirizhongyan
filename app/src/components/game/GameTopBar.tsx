/**
 * 对局顶条（56px）：← 离场 │ 房间名 · 阶段 │ 奖池 + 十日 mini 环。
 * 两对局页共用（design game-guess/game-werewolf「对局顶条」）。
 */
import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { Suit } from '@/data/echoes'
import FragmentChip from '@/components/FragmentChip'
import CountdownRing from '@/components/CountdownRing'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'
import GameIntroCards, { type GameIntroSpec } from '@/components/game/GameIntroCards'

export interface GameTopBarProps {
  suit: Suit
  /** 房间名（Small, dim） */
  room: string
  /** 中央阶段标题（如「第 2 / 5 轮」「第 2 天 · 白天发言」） */
  phase: ReactNode
  /** 奖池碎片数 */
  pool: number
  onExit: () => void
  /** 右侧额外内容（如委托开关） */
  extra?: ReactNode
  /** 玩法卡过场；未传时按花色采用终焉内置世界卡。 */
  intro?: GameIntroSpec
  className?: string
}

export default function GameTopBar({ suit, room, phase, pool, onExit, extra, intro, className }: GameTopBarProps) {
  return (
    <header
      className={cn(
        'relative z-30 h-14 shrink-0 flex items-center gap-3 px-4 border-b border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.72)] backdrop-blur-[16px]',
        className,
      )}
    >
      <GoldButton variant="danger" size="sm" onClick={onExit} className="tracking-[.15em]">
        <ChevronLeft size={15} />
        离场
      </GoldButton>
      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <span className="text-[12px] text-dim tracking-[.2em] truncate hidden sm:inline">{room}</span>
        <span className="text-gold-300/40 hidden sm:inline">·</span>
        <span className="font-cinzel font-bold text-[17px] text-bone tracking-wider truncate">{phase}</span>
      </div>
      {extra}
      <GameIntroCards suit={suit} spec={intro} />
      <FragmentChip suit={suit} count={pool} size="lg" />
      <CountdownRing variant="mini" size={30} />
    </header>
  )
}

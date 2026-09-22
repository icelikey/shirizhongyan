/**
 * 猜平均数终局结算演出（全屏 Overlay，design game-guess.md「终局结算演出」）。
 * 前三名登坛 + 完整名次表 + 影从评语 + 操作按钮。
 * 碎片 RewardFly 由页面层触发（此处仅展示数额）。
 */
import { motion } from 'framer-motion'
import { getEcho } from '@/data/echoes'
import type { GuessState } from '@/engine/guessEngine'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'

const RANK_COLOR = ['#E8C15A', '#C9CFDA', '#C98A4B']
const RANK_NAME = ['冠军', '亚军', '季军']

export interface GuessSettlementProps {
  open: boolean
  state: GuessState
  humanSeat: number
  /** 是否排位局（友谊局=false → 不显示奖励） */
  ranked: boolean
  rewards: Record<number, number>
  companionComment: string
  onRestart: () => void
  onExit: () => void
}

function portraitOf(state: GuessState, seat: number): { img: string; name: string } {
  const s = state.seats.find((x) => x.seat === seat)!
  if (s.kind === 'human') return { img: '/avatar-traveler.png', name: s.name }
  const echo = s.echoId ? getEcho(s.echoId) : undefined
  return { img: echo?.portrait ?? '/avatar-traveler.png', name: s.name }
}

export default function GuessSettlement({ open, state, humanSeat, ranked, rewards, companionComment, onRestart, onExit }: GuessSettlementProps) {
  if (!open || !state.rankings) return null
  const rankings = state.rankings
  const top3 = rankings.slice(0, 3)
  const podium = [top3[1], top3[0], top3[2]].filter((x) => x != null)
  const myRank = rankings.indexOf(humanSeat)

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(7,6,11,.82)] backdrop-blur-[6px] overflow-y-auto py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-[min(680px,94vw)] flex flex-col items-center gap-6">
        <motion.h2
          className="gold-text font-mashan text-[52px] leading-none tracking-[.1em]"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          结算之仪
        </motion.h2>

        {/* 前三名登坛 */}
        <div className="flex items-end justify-center gap-5">
          {podium.map((seat) => {
            const rank = rankings.indexOf(seat)
            const { img, name } = portraitOf(state, seat)
            const champion = rank === 0
            return (
              <motion.div
                key={seat}
                className="flex flex-col items-center gap-2"
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + rank * 0.2, type: 'spring', stiffness: 220, damping: 18 }}
              >
                <span className="font-cinzel font-bold" style={{ color: RANK_COLOR[rank], fontSize: champion ? 44 : 30 }}>
                  {rank + 1}
                </span>
                <div
                  className={cn('card-frame rounded-[14px] overflow-hidden', champion && 'shadow-[0_0_36px_rgba(227,194,124,.4)]')}
                  style={{ width: champion ? 132 : 96, height: champion ? 198 : 144 }}
                >
                  <img src={img} alt={name} className="w-full h-full object-cover object-top" draggable={false} />
                </div>
                <span className={cn('text-[13px]', seat === humanSeat ? 'text-gold-300' : 'text-bone')}>{name}</span>
                <span className="text-[10px] tracking-[.2em]" style={{ color: RANK_COLOR[rank] }}>
                  {RANK_NAME[rank]} · {state.scores[seat]} 分
                </span>
                {ranked && (
                  <span className="font-mono text-[12px] text-suit-club">+{rewards[seat]} ♣</span>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* 完整名次表 */}
        <motion.div
          className="panel-bg rounded-[14px] w-full px-5 py-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          {rankings.map((seat, rank) => {
            const { name } = portraitOf(state, seat)
            return (
              <div
                key={seat}
                className={cn(
                  'flex items-center gap-3 py-1.5 text-[13px]',
                  seat === humanSeat && 'bg-[rgba(227,194,124,.08)] rounded-lg px-2 -mx-2',
                )}
              >
                <span className="font-cinzel w-6 text-center" style={{ color: RANK_COLOR[rank] ?? '#6E6880' }}>{rank + 1}</span>
                <span className={seat === humanSeat ? 'text-gold-300' : 'text-bone'}>{name}{seat === humanSeat && '（你）'}</span>
                <span className="flex-1" />
                <span className="font-mono text-dim">{state.scores[seat]} 分</span>
                {ranked && <span className="font-mono text-suit-club w-16 text-right">+{rewards[seat]} ♣</span>}
              </div>
            )
          })}
        </motion.div>

        {/* 影从评语 */}
        <motion.p
          className="text-[13px] text-dim italic text-center max-w-[480px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        >
          {companionComment}
        </motion.p>

        {/* 按钮 */}
        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25, duration: 0.4 }}
        >
          <GoldButton variant="gold" size="lg" onClick={onRestart}>再来一局</GoldButton>
          <GoldButton variant="ghost" size="lg" onClick={onExit}>返回大厅</GoldButton>
        </motion.div>

        {myRank === 0 && ranked && (
          <motion.span
            className="seal-stamp px-3 py-1 text-[14px] rotate-[-2deg]"
            initial={{ scale: 1.4, opacity: 0, rotate: 12 }}
            animate={{ scale: 1, opacity: 1, rotate: -2 }}
            transition={{ delay: 1.4, type: 'spring', stiffness: 300, damping: 14 }}
          >
            MVP · 夺魁
          </motion.span>
        )}
      </div>
    </motion.div>
  )
}

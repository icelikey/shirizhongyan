/**
 * 狼人杀终局演出（design game-werewolf.md「终局演出」）：
 * 胜方阵营色笼罩 + 书法巨题 + 六张身份大揭示 + MVP 金日徽章 + 奖励与按钮。
 */
import { motion } from 'framer-motion'
import type { WolfState } from '@/engine/werewolfEngine'
import { ROLE_META } from '@/engine/werewolfEngine'
import GoldButton from '@/components/GoldButton'
import PlayingCard from '@/components/PlayingCard'
import { cn } from '@/lib/utils'

export interface WerewolfSettlementProps {
  open: boolean
  state: WolfState
  humanSeat: number
  ranked: boolean
  /** 真人奖励明细（ranked=false 时全 0） */
  reward: { base: number; mvp: number }
  onRestart: () => void
  onExit: () => void
}

export default function WerewolfSettlement({ open, state, humanSeat, ranked, reward, onRestart, onExit }: WerewolfSettlementProps) {
  if (!open || !state.winner) return null
  const wolfWin = state.winner === 'wolf'
  const humanCamp = state.seats[humanSeat].role === 'werewolf' ? 'wolf' : 'good'
  const humanWon = humanCamp === state.winner
  const tint = wolfWin ? 'rgba(216,68,60,.16)' : 'rgba(78,203,156,.14)'
  const glowColor = wolfWin ? '#F0655A' : '#4ECB9C'

  return (
    <motion.div
      className="fixed inset-0 z-[80] overflow-y-auto py-8 flex items-start justify-center backdrop-blur-[4px]"
      style={{ background: `linear-gradient(180deg, ${tint}, rgba(7,6,11,.9))` }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="w-[min(720px,94vw)] flex flex-col items-center gap-6">
        {/* 书法巨题 */}
        <motion.h2
          className="font-mashan leading-none"
          style={{ fontSize: 72, color: glowColor, textShadow: `0 0 40px ${glowColor}66` }}
          initial={{ opacity: 0, filter: 'blur(10px)', scale: 1.1 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {wolfWin ? '狼人 · 胜' : '好人 · 胜'}
        </motion.h2>
        <motion.p
          className={cn('text-[14px] tracking-[.3em]', humanWon ? 'text-ok' : 'text-danger')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {humanWon ? '—— 你所在的阵营获胜 ——' : '—— 你的阵营败北 ——'}
        </motion.p>

        {/* 身份大揭示 */}
        <div className="flex items-end justify-center gap-3 flex-wrap">
          {state.seats.map((s, i) => {
            const meta = ROLE_META[s.role]
            const isWolf = s.role === 'werewolf'
            const isMvp = s.seat === state.mvpSeat
            return (
              <motion.div
                key={s.seat}
                className="flex flex-col items-center gap-1.5 relative"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.08, duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
              >
                {isMvp && (
                  <motion.span
                    className="absolute -top-3 -right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-cinzel font-bold bg-[radial-gradient(circle,#F8E9C0,#C6A15B)] text-[#2A1E0C]"
                    style={{ boxShadow: '0 0 18px rgba(227,194,124,.7)' }}
                    initial={{ scale: 0, y: -14 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: 1.6, type: 'spring', stiffness: 300, damping: 12 }}
                    title="MVP"
                  >
                    MVP
                  </motion.span>
                )}
                <div style={isWolf ? { filter: 'drop-shadow(0 0 12px rgba(240,101,90,.5))' } : undefined}>
                  <PlayingCard suit="spade" rank={meta.name} image={meta.image} width={88} tilt={false} />
                </div>
                <span className={cn('text-[12px]', s.seat === humanSeat ? 'text-gold-300' : 'text-bone')}>
                  {s.seat + 1} 号 {s.name}
                </span>
                <span className="text-[10px]" style={{ color: isWolf ? '#F0655A' : '#4ECB9C' }}>{meta.name}</span>
              </motion.div>
            )
          })}
        </div>

        {/* MVP 评语 + 奖励 */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
        >
          {state.mvpNote && <p className="text-[13px] text-dim italic">{state.mvpNote}</p>}
          {ranked ? (
            <div className="flex items-center gap-5 font-mono text-[14px]">
              <span className="text-suit-spade">{humanWon ? '胜方' : '败方'} +{reward.base} ♠</span>
              {reward.mvp > 0 && <span className="text-gold-300">MVP +{reward.mvp} ♠</span>}
            </div>
          ) : (
            <p className="text-[12px] text-faint">友谊局 · 不发放碎片奖励</p>
          )}
          {/* 我的关键行动 */}
          {(state.keyActions[humanSeat] ?? []).length > 0 && (
            <p className="text-[12px] text-faint">你的关键行动:{(state.keyActions[humanSeat] ?? []).join(' · ')}</p>
          )}
        </motion.div>

        <motion.div
          className="flex items-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
        >
          <GoldButton variant="gold" size="lg" onClick={onRestart}>再来一局</GoldButton>
          <GoldButton variant="ghost" size="lg" onClick={onExit}>返回大厅</GoldButton>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * 碎境爬塔 · 终局演出层。
 * - VictoryOverlay：通关「登岸」（第 3 层 Boss 击杀后）：金雨碎片 + 结算 + 60♦。
 * - GameOverOverlay：坠塔（endCombat win=false → phase gameover）：死亡结算。
 * 两者都以「返回门厅」结束（abandonRun 后由页面跳转）。
 */
import { motion } from 'framer-motion'
import { Skull, Sunrise } from 'lucide-react'
import { useSpire } from '@/store/spire'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import { FLOOR_NAMES } from '@/components/spire/SpireTopBar'

const STATS = (floor: number, kills: number, deck: number, relics: number) => [
  { k: '抵达', v: `第 ${floor} 层 · ${FLOOR_NAMES[Math.min(Math.max(floor, 1), 3) - 1]}` },
  { k: '击杀', v: `${kills}` },
  { k: '牌组', v: `${deck} 张` },
  { k: '遗物', v: `${relics} 件` },
]

export function VictoryOverlay({ onLeave }: { onLeave: () => void }) {
  const floor = useSpire((s) => s.floor)
  const kills = useSpire((s) => s.kills)
  const deck = useSpire((s) => s.deck)
  const relics = useSpire((s) => s.relics)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-hidden bg-abyss/90 backdrop-blur-md"
    >
      {/* 金雨碎片 */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={i}
          initial={{ y: -80, x: `${(i * 73) % 100}vw`, opacity: 0, rotate: 0 }}
          animate={{ y: '110vh', opacity: [0, 1, 1, 0], rotate: 340 }}
          transition={{ duration: 3.2 + (i % 5) * 0.5, delay: i * 0.18, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
          className="pointer-events-none absolute top-0 text-suit-diamond"
        >
          <SuitIcon suit="diamond" size={i % 3 === 0 ? 18 : 12} />
        </motion.span>
      ))}

      <div className="relative flex w-full max-w-[520px] flex-col items-center gap-6 rounded-[18px] border border-[rgba(242,169,59,.4)] bg-panel/90 p-10 text-center shadow-panel">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
          className="flex h-20 w-20 items-center justify-center rounded-full border border-suit-diamond/60 bg-suit-diamond/10"
          style={{ boxShadow: '0 0 44px rgba(242,169,59,.5)' }}
        >
          <Sunrise size={36} className="text-suit-diamond" />
        </motion.div>
        <div>
          <h2 className="gold-text font-serifsc text-[36px] font-black tracking-[.2em]">登岸</h2>
          <p className="vertical-rl mx-auto mt-3 h-[104px] font-mashan text-[15px] text-gold-500/80">十日之巅，云海在脚下</p>
          <p className="mt-3 text-[13px] leading-relaxed text-dim">
            你走出最后一级石阶。风从下方吹来，带着赌坊的烛火味——这一局，你赢了。
          </p>
        </div>
        <div className="grid w-full grid-cols-4 gap-2">
          {STATS(floor, kills, deck.length, relics.length).map((s) => (
            <div key={s.k} className="rounded-[10px] border border-[rgba(227,194,124,.14)] bg-ink/60 px-2 py-3">
              <p className="text-[10px] tracking-[.2em] text-faint">{s.k}</p>
              <p className="mt-1 font-mono text-[13px] text-bone">{s.v}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-suit-diamond/40 bg-suit-diamond/10 px-4 py-1.5 text-[13px] text-suit-diamond">
          <SuitIcon suit="diamond" size={14} />
          通关赏 <span className="font-mono">+60</span> 碎片 · 已入账
        </div>
        <GoldButton size="lg" onClick={onLeave} className="w-full">
          返回门厅
        </GoldButton>
      </div>
    </motion.div>
  )
}

export function GameOverOverlay({ onLeave }: { onLeave: () => void }) {
  const floor = useSpire((s) => s.floor)
  const kills = useSpire((s) => s.kills)
  const deck = useSpire((s) => s.deck)
  const relics = useSpire((s) => s.relics)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-abyss/92 backdrop-blur-md"
    >
      <div className="flex w-full max-w-[520px] flex-col items-center gap-6 rounded-[18px] border border-[rgba(216,68,60,.35)] bg-panel/90 p-10 text-center shadow-panel">
        <motion.div
          initial={{ scale: 1.4, opacity: 0, rotate: 12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
          className="flex h-20 w-20 items-center justify-center rounded-full border border-cinnabar/50 bg-cinnabar/10"
        >
          <Skull size={34} className="text-cinnabar-hi" />
        </motion.div>
        <div>
          <h2 className="font-serifsc text-[32px] font-black tracking-[.2em] text-cinnabar-hi">坠塔</h2>
          <p className="mt-3 text-[13px] leading-relaxed text-dim">
            石阶在你脚下碎裂。你向下坠去，云海合拢——
            <br />
            已入账的碎片与战绩不会随你坠落，下一个十日，门还开着。
          </p>
        </div>
        <div className="grid w-full grid-cols-4 gap-2">
          {STATS(floor, kills, deck.length, relics.length).map((s) => (
            <div key={s.k} className="rounded-[10px] border border-[rgba(227,194,124,.14)] bg-ink/60 px-2 py-3">
              <p className="text-[10px] tracking-[.2em] text-faint">{s.k}</p>
              <p className="mt-1 font-mono text-[13px] text-bone">{s.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] tracking-wider text-faint">死亡惩罚：本局牌组、遗物与金币散入碎境；门票不退。</p>
        <GoldButton size="lg" variant="danger" onClick={onLeave} className="w-full">
          返回门厅
        </GoldButton>
      </div>
    </motion.div>
  )
}

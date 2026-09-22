/**
 * <DefeatScreen> 终焉结算屏：已达层数 / 本局击杀 / 碎片汇总，返回大厅。
 */
import { motion } from 'framer-motion'
import { Skull, Swords } from 'lucide-react'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'

interface Props {
  floor: number
  kills: number
  diamondFragments: number
  onLobby: () => void
}

export default function DefeatScreen({ floor, kills, diamondFragments, onLobby }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[rgba(7,6,11,.86)] backdrop-blur-[10px]"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className="flex w-[min(480px,92vw)] flex-col items-center gap-5 rounded-[18px] border border-cinnabar/40 bg-panel/95 px-8 py-8 shadow-panel"
      >
        <Skull size={40} className="text-cinnabar-hi" strokeWidth={1.5} />
        <h2 className="font-mashan text-[42px] leading-none text-cinnabar-hi" style={{ textShadow: '0 0 24px rgba(216,68,60,.4)' }}>
          终焉已至
        </h2>
        <p className="text-center font-sanssc text-[13px] leading-relaxed text-dim">
          十日未竟，旅人长眠于碎境。
          <br />
          记忆碎片将随你进入下一个十日。
        </p>
        <div className="grid w-full grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/60 py-3">
            <span className="font-sanssc text-[11px] text-faint">已达层数</span>
            <span className="font-cinzel text-[22px] font-bold text-gold-300">{floor}</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/60 py-3">
            <span className="font-sanssc text-[11px] text-faint">本局击杀</span>
            <span className="flex items-center gap-1 font-cinzel text-[22px] font-bold text-bone">
              <Swords size={15} className="text-dim" />
              {kills}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-ink/60 py-3">
            <span className="font-sanssc text-[11px] text-faint">♦ 碎片</span>
            <span className="flex items-center gap-1 font-cinzel text-[22px] font-bold text-suit-diamond">
              <SuitIcon suit="diamond" size={15} />
              {diamondFragments}
            </span>
          </div>
        </div>
        <p className="font-sanssc text-[11px] text-faint">本局获得的碎片已即时入账</p>
        <GoldButton variant="gold" size="lg" onClick={onLobby}>
          返回大厅
        </GoldButton>
      </motion.div>
    </motion.div>
  )
}

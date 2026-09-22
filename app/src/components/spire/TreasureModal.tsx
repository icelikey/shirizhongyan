/**
 * 碎境爬塔 · 宝箱弹层（spire-map.md §3.2 宝箱节点：金币 25–50 + 30% 遗物）。
 * 开启演出（箱盖弹开 + 金光）→ 收取入账。
 */
import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'
import { useSpire } from '@/store/spire'
import MetaModal from '@/components/meta/Modal'
import GoldButton from '@/components/GoldButton'
import { NodeGlyph, RelicIcon } from '@/components/spire/icons'
import { relicView } from '@/game/spire-data'

export interface TreasureModalProps {
  gold: number
  relicId: string | null
  onDone: () => void
}

export default function TreasureModal({ gold, relicId, onDone }: TreasureModalProps) {
  const addGold = useSpire((s) => s.addGold)
  const addRelic = useSpire((s) => s.addRelic)
  const relic = relicId ? relicView(relicId) : null

  const claim = () => {
    addGold(gold)
    if (relicId) addRelic(relicId)
    onDone()
  }

  return (
    <MetaModal open onClose={() => {}} title="宝箱" sideMark="遗珍" width={480}>
      <div className="flex flex-col items-center gap-5">
        {/* 箱盖弹开演出 */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="relative flex h-24 w-24 items-center justify-center rounded-[16px] border border-[rgba(242,169,59,.4)] bg-suit-diamond/10"
          style={{ boxShadow: '0 0 40px rgba(242,169,59,.3)' }}
        >
          <NodeGlyph type="treasure" size={52} />
          <motion.span
            initial={{ opacity: 0.9, scale: 0.4 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="absolute inset-0 rounded-[16px] border border-suit-diamond"
          />
        </motion.div>

        <div className="flex w-full flex-col gap-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-between rounded-[10px] border border-[rgba(227,194,124,.14)] bg-ink/60 px-4 py-3"
          >
            <span className="flex items-center gap-2 text-[13px] text-dim">
              <Coins size={15} className="text-gold-300" /> 碎金
            </span>
            <span className="font-mono text-[15px] text-gold-300">+{gold}</span>
          </motion.div>
          {relic && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex items-center gap-3 rounded-[10px] border border-[rgba(242,169,59,.35)] bg-suit-diamond/[.07] px-4 py-3"
            >
              <RelicIcon id={relic.id} size={30} />
              <div className="min-w-0 flex-1">
                <p className="font-serifsc text-[14px] text-bone">{relic.name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{relic.desc}</p>
              </div>
              <span className="shrink-0 text-[10px] tracking-[.2em] text-suit-diamond">遗物</span>
            </motion.div>
          )}
          {!relic && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center text-[11px] text-faint">
              箱底空空，只有一枚模糊的手印。
            </motion.p>
          )}
        </div>

        <GoldButton onClick={claim} className="w-full">
          收入行囊
        </GoldButton>
      </div>
    </MetaModal>
  )
}

/**
 * <RewardScreen> 胜利奖励屏（Modal 全屏）：金币 + ♦碎片 + 三选一卡牌（可跳过）
 * + 精英遗物 / Boss 遗物三选一。
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'
import { getRelic } from '@/data/spire/relics'
import type { RewardBundle } from '@/engine/spire/rewards'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import BattleCard from '@/components/spire/combat/BattleCard'
import { RELIC_ICON } from '@/components/spire/combat/relicIcons'
import { cn } from '@/lib/utils'

interface Props {
  bundle: RewardBundle
  onConfirm: (choice: { cardId?: string; relicId?: string }) => void
}

export default function RewardScreen({ bundle, onConfirm }: Props) {
  const [cardId, setCardId] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [relicId, setRelicId] = useState<string | null>(null)
  const needRelic = bundle.relicChoices.length > 0
  const ready = (cardId !== null || skipped) && (!needRelic || relicId !== null)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[70] flex items-center justify-center bg-[rgba(7,6,11,.78)] backdrop-blur-[8px]"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="flex max-h-[92dvh] w-[min(720px,94vw)] flex-col items-center gap-4 overflow-y-auto rounded-[18px] border border-[rgba(227,194,124,.35)] bg-panel/95 px-8 py-7 shadow-panel"
      >
        <h2
          className="font-serifsc text-[34px] font-black leading-none tracking-[.18em]"
          style={{
            background: 'linear-gradient(180deg,#F8E9C0 20%,#E3C27C 55%,#A87F3D 90%)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 2px 12px rgba(227,194,124,.25)',
          }}
        >
          胜 利
        </h2>

        {/* 金币 + 碎片 */}
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5 font-mono text-lg text-gold-300">
            <Coins size={18} /> +{bundle.gold}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-lg text-suit-diamond">
            <SuitIcon suit="diamond" size={16} glow /> +{bundle.fragments}
          </span>
        </div>

        {/* 卡牌三选一 */}
        <div className="w-full">
          <div className="mb-2 text-center font-sanssc text-[13px] tracking-[.3em] text-dim">拾取一张卡牌（可跳过）</div>
          <div className="flex justify-center gap-4">
            {bundle.cardChoices.map((id) => (
              <div
                key={id}
                className={cn(
                  'rounded-[12px] transition-transform duration-200',
                  cardId === id ? '-translate-y-2 ring-2 ring-gold-300' : skipped && 'opacity-40',
                )}
              >
                <BattleCard
                  inst={{ uid: -1, id, upgraded: false }}
                  large
                  onClick={() => {
                    setCardId(id)
                    setSkipped(false)
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => {
                setSkipped(true)
                setCardId(null)
              }}
              className={cn(
                'font-sanssc text-[12px] tracking-[.2em] transition-colors',
                skipped ? 'text-gold-300' : 'text-faint hover:text-dim',
              )}
            >
              {skipped ? '已选择跳过' : '跳过'}
            </button>
          </div>
        </div>

        {/* 遗物（精英 1 / Boss 三选一） */}
        {needRelic && (
          <div className="w-full">
            <div className="mb-2 text-center font-sanssc text-[13px] tracking-[.3em] text-dim">
              {bundle.isBoss ? 'Boss 遗物 · 三选一' : '拾取遗物'}
            </div>
            <div className="flex justify-center gap-3">
              {bundle.relicChoices.map((id) => {
                const relic = getRelic(id)
                const Icon = RELIC_ICON[id]
                const active = relicId === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRelicId(id)}
                    className={cn(
                      'flex w-[170px] flex-col items-center gap-1.5 rounded-[14px] border bg-elevated/70 px-3 py-3 transition-all duration-200',
                      active
                        ? 'border-gold-300 shadow-[0_0_22px_rgba(227,194,124,.4)]'
                        : 'border-[rgba(227,194,124,.25)] hover:border-[rgba(246,227,180,.5)]',
                    )}
                  >
                    {Icon && <Icon size={26} className="text-gold-300" />}
                    <span className="font-serifsc text-[14px] text-bone">{relic.name}</span>
                    <span className="text-center font-sanssc text-[11px] leading-snug text-dim">{relic.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <GoldButton size="lg" disabled={!ready} onClick={() => onConfirm({ cardId: cardId ?? undefined, relicId: relicId ?? undefined })}>
          继续攀登
        </GoldButton>
      </motion.div>
    </motion.div>
  )
}

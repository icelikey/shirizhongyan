/**
 * 碎片背包卡（world.md §碎片背包卡）。
 * 四花色资产行（FragmentChip lg 规格感：SuitIcon 24 + 余额 Mono 20px + 用途 + 「获取」→ 大厅）。
 */
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { SUITS, SUIT_META } from '@/data/echoes'
import type { Suit } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'

const USAGE: Record<Suit, string> = {
  spade: '狼人杀门票 · 建房 · 残章',
  heart: '影从记忆槽 · 残章',
  club: '猜平均数门票 · 建房 · 残章',
  diamond: '竞逐入场 · 残章封存',
}

export default function FragmentBag() {
  const navigate = useNavigate()
  const fragments = useProfile((s) => s.fragments)

  return (
    <div className="panel-bg rounded-[14px] p-5">
      <h3 className="gold-text font-serifsc text-[16px] font-semibold tracking-[.15em]">碎片背包</h3>
      <div className="mt-3 flex flex-col">
        {SUITS.map((s, i) => {
          const meta = SUIT_META[s]
          return (
            <motion.div
              key={s}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="group flex items-center gap-3 border-b border-[rgba(227,194,124,.07)] py-2.5 last:border-0"
            >
              <span style={{ color: meta.color }}>
                <SuitIcon suit={s} size={24} glow />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-bone">{meta.realm}碎片</span>
                  <span className="font-mono text-[18px] leading-none" style={{ color: meta.color }}>
                    {fragments[s]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] tracking-wider text-faint">{USAGE[s]}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/lobby')}
                className="flex items-center gap-0.5 text-[11px] tracking-wider text-dim transition-colors hover:text-gold-300"
              >
                获取 <ArrowUpRight size={12} />
              </button>
            </motion.div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] italic leading-relaxed text-faint">「碎片既是货币，也是叙事的钥匙。」</p>
    </div>
  )
}

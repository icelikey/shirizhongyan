/**
 * 大厅快速匹配区 · 第三张入口卡「碎境爬塔 · 肉鸽牌局」（spire-map.md §4）。
 * ♦ 琥珀主题 · 门票 12♦ · 副标题「单人登塔」；点击直入 /game/spire（门票在 Hub 收取）。
 * 视觉与 QuickMatchCard 同语言（panel-bg + gold-sweep + 竖排小字）。
 */
import { motion } from 'framer-motion'
import { ChevronRight, Mountain } from 'lucide-react'
import { SUIT_META } from '@/data/echoes'
import FragmentChip from '@/components/FragmentChip'
import SuitIcon from '@/components/SuitIcon'

export interface SpireLobbyCardProps {
  /** 墨染过渡跳转 */
  go: (to: string) => void
}

export default function SpireLobbyCard({ go }: SpireLobbyCardProps) {
  const suit = SUIT_META.diamond
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={() => go('/game/spire')}
      className="panel-bg gold-sweep group relative w-full overflow-hidden rounded-[14px] border border-[rgba(242,169,59,.3)] p-5 text-left transition-all duration-200 ease-ink hover:-translate-y-0.5 hover:border-[rgba(242,169,59,.6)]"
    >
      <span className="vertical-rl absolute right-3 top-4 font-mashan text-[13px] text-suit-diamond/70">登塔</span>
      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `${suit.color}1F`, color: suit.color, boxShadow: `0 0 16px ${suit.glow}` }}
        >
          <SuitIcon suit="diamond" size={24} glow />
        </span>
        <div className="min-w-0">
          <h3 className="font-serifsc text-[16px] text-bone">碎境爬塔</h3>
          <p className="mt-0.5 text-[11px] tracking-[.18em] text-faint">肉鸽牌局 · 单人登塔</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] text-dim">
          <Mountain size={12} className="text-suit-diamond" />
          三层碎境 · 死即终局 · 门票
        </span>
        <FragmentChip suit="diamond" count={12} size="sm" />
      </div>
      <span className="mt-3 flex items-center gap-1 text-[12px] tracking-[.2em] text-suit-diamond opacity-90 transition-transform duration-200 group-hover:translate-x-0.5">
        前往门厅 <ChevronRight size={14} />
      </span>
    </motion.button>
  )
}

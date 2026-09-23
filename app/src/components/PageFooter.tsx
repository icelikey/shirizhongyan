/**
 * <PageFooter> 页脚（design.md §10.15）—— 仅叙事页 home / codex / lore 使用。
 */
import { SUITS } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'

export default function PageFooter() {
  return (
    <footer className="relative z-10 border-t border-[rgba(227,194,124,.10)] py-6 px-6">
      <div className="mx-auto max-w-[1280px] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-faint font-sanssc">
        <span>终焉 · Distributed Intelligence World</span>
        <span className="tracking-wider">世界每十日终结一次，胜者携带记忆前行</span>
        <span className="flex items-center gap-3">
          {SUITS.map((s) => (
            <SuitIcon key={s} suit={s} size={14} className="opacity-60" />
          ))}
        </span>
      </div>
    </footer>
  )
}

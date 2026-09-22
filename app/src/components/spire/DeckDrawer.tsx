/**
 * 碎境爬塔 · 牌组浏览抽屉（design.md §10.14 Drawer：右滑入 380px）。
 * 顶栏「牌组」按钮唤起；展示全部牌（含 '+' 淬炼标记与诅咒牌），只读。
 */
import { AnimatePresence, motion } from 'framer-motion'
import { Layers, X } from 'lucide-react'
import { cardView } from '@/game/spire-data'
import CardTile from '@/components/spire/CardTile'

export interface DeckDrawerProps {
  open: boolean
  deck: string[]
  onClose: () => void
}

export default function DeckDrawer({ open, deck, onClose }: DeckDrawerProps) {
  const upgraded = deck.filter((c) => c.startsWith('+')).length
  const curses = deck.filter((c) => cardView(c).rarity === 'curse').length
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[80] bg-abyss/70 backdrop-blur-[8px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 right-0 top-0 z-[81] flex w-[380px] max-w-[90vw] flex-col gap-4 border-l border-[rgba(227,194,124,.15)] bg-panel p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="gold-text font-serifsc text-[18px] tracking-[.1em]">牌组</h3>
              <button type="button" onClick={onClose} className="text-faint transition-colors hover:text-gold-300" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-[10px] border border-[rgba(227,194,124,.12)] bg-ink/60 px-3 py-2 text-[12px] text-dim">
              <Layers size={14} className="text-gold-300" />
              <span className="font-mono text-bone">{deck.length}</span> 张
              {upgraded > 0 && (
                <span className="text-gold-300">
                  · <span className="font-mono">{upgraded}</span> 已淬
                </span>
              )}
              {curses > 0 && (
                <span className="text-cinnabar-hi">
                  · <span className="font-mono">{curses}</span> 业债
                </span>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {deck.map((entry, i) => (
                <CardTile key={`${entry}-${i}`} card={cardView(entry)} compact />
              ))}
              {deck.length === 0 && <p className="py-10 text-center text-[12px] text-faint">牌组空空如也</p>}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/**
 * 丹丘牌楼 · 「我的牌组」抽屉：52 张牌网格（词条徽记）+ 词条名录（图鉴式）。
 * 右滑入 420px，design.md §10.14 Drawer 语言。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Layers, ScrollText } from 'lucide-react'
import type { DeckCard } from '@/engine/poker/types'
import { AFFIXES, AFFIX_KIND_META } from '@/data/poker/affixes'
import type { AffixKind } from '@/data/poker/affixes'
import PokerCard from './PokerCard'
import { SUITS, SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

const KIND_ORDER: AffixKind[] = ['attack', 'defense', 'scheme', 'luck']

export interface DeckDrawerProps {
  open: boolean
  onClose: () => void
  deck: DeckCard[]
}

export default function DeckDrawer({ open, onClose, deck }: DeckDrawerProps) {
  const [tab, setTab] = useState<'deck' | 'codex'>('deck')

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[70] bg-abyss/70 backdrop-blur-[8px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 440 }}
            animate={{ x: 0 }}
            exit={{ x: 440 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-0 right-0 top-0 z-[71] flex w-[420px] max-w-[92vw] flex-col border-l border-[rgba(227,194,124,.28)] bg-elevated shadow-panel"
          >
            <div className="flex items-center gap-2 border-b border-[rgba(227,194,124,.1)] px-4 py-3">
              <button
                type="button"
                onClick={() => setTab('deck')}
                className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] tracking-wider transition-colors',
                  tab === 'deck' ? 'bg-gold-300/15 text-gold-300' : 'text-dim hover:text-bone')}
              >
                <Layers size={14} /> 我的牌组
              </button>
              <button
                type="button"
                onClick={() => setTab('codex')}
                className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] tracking-wider transition-colors',
                  tab === 'codex' ? 'bg-gold-300/15 text-gold-300' : 'text-dim hover:text-bone')}
              >
                <ScrollText size={14} /> 词条名录
              </button>
              <span className="flex-1" />
              <button type="button" onClick={onClose} className="text-dim transition-colors hover:text-bone" aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'deck' ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[11px] leading-relaxed text-faint">
                    你的 52 张牌是永久资产——词条洗炼跨局保留，死亡重开，牌组不灭。
                    当前共 {deck.reduce((s, c) => s + c.affixes.length, 0)} 条词条。
                  </p>
                  {SUITS.map((suit) => (
                    <div key={suit}>
                      <div className="mb-2 flex items-center gap-1.5 text-[12px] tracking-[.2em]" style={{ color: SUIT_META[suit].color }}>
                        <span>{SUIT_META[suit].symbol}</span>
                        <span>{SUIT_META[suit].realm}花色</span>
                      </div>
                      <div className="flex flex-wrap gap-x-1.5 gap-y-3">
                        {deck.filter((c) => c.suit === suit).sort((a, b) => a.rank - b.rank).map((c) => (
                          <PokerCard key={c.id} card={c} size="xs" disabled />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {KIND_ORDER.map((kind) => {
                    const m = AFFIX_KIND_META[kind]
                    return (
                      <div key={kind}>
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full font-mashan text-[12px] text-abyss"
                            style={{ background: m.color, boxShadow: `0 0 10px ${m.color}66` }}
                          >
                            {m.glyph}
                          </span>
                          <span className="font-serifsc text-[15px] font-semibold" style={{ color: m.color }}>
                            {m.name}之词条
                          </span>
                          <span className="text-[10px] tracking-wider text-faint">
                            {kind === 'attack' ? '计分强化' : kind === 'defense' ? '生存与节奏' : kind === 'scheme' ? '牌型连携' : '概率奇遇'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {AFFIXES.filter((a) => a.kind === kind).map((a) => (
                            <div key={a.id} className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-3 py-2">
                              <div className="flex items-baseline gap-2">
                                <span className="font-serifsc text-[13px] text-bone">{a.name}</span>
                                <span className="text-[10px] tracking-wider text-faint">
                                  {a.trigger === 'onPlay' ? '打出时' : a.trigger === 'inHand' ? '在手牌时' : '弃牌时'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] leading-relaxed text-dim">{a.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

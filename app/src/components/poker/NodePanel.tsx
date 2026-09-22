/**
 * 丹丘牌楼 · 层间节点面板（三选一）：洗心祭坛 / 丹丘茶馆 / 千面奇遇。
 * 选择后展开对应交互；祭坛可多次操作（币够即可），奇遇一次揭晓。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Coins, Flame, Heart, Sparkles, X } from 'lucide-react'
import type { NodeKind } from '@/engine/poker/nodes'
import {
  NODE_META, INFUSE_COST, REROLL_COST, TEAPOT_DISCARD_COST, TEAPOT_PLAY_COST, TEA_HEAL,
} from '@/engine/poker/nodes'
import { usePoker } from '@/store/poker'
import { PLAYER_MAX_HP } from '@/engine/poker/duel'
import { AFFIX_KIND_META, getAffix } from '@/data/poker/affixes'
import GoldButton from '@/components/GoldButton'
import PokerCard from './PokerCard'
import { cn } from '@/lib/utils'

const NODE_GLYPH: Record<NodeKind, string> = { altar: '祭', teahouse: '茶', encounter: '遇' }

export interface NodePanelProps {
  /** 是否已选定某节点（控制「继续登楼」可用） */
  onChosen: (chosen: boolean) => void
}

export default function NodePanel({ onChosen }: NodePanelProps) {
  const run = usePoker((s) => s.run)!
  const deck = usePoker((s) => s.deck)
  const [chosen, setChosen] = useState<NodeKind | null>(null)
  const [altarCard, setAltarCard] = useState<string | null>(null)
  const [infuseOpts, setInfuseOpts] = useState<string[]>([])
  const [encounterText, setEncounterText] = useState<{ text: string; resultText: string } | null>(null)
  const [flash, setFlash] = useState<string>('')

  const pick = (k: NodeKind) => {
    if (chosen) return
    setChosen(k)
    onChosen(true)
  }

  const say = (t: string) => {
    setFlash(t)
    window.setTimeout(() => setFlash(''), 2200)
  }

  const card = deck.find((c) => c.id === altarCard) ?? null
  const rerollCost = run.altarFreeUsed ? REROLL_COST : 0

  return (
    <div className="flex w-full max-w-[860px] flex-col items-center gap-4">
      {/* 三选一卡片 */}
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(NODE_META) as NodeKind[]).map((k) => {
          const active = chosen === k
          const dim = chosen && !active
          return (
            <button
              key={k}
              type="button"
              disabled={!!chosen}
              onClick={() => pick(k)}
              className={cn(
                'group rounded-[14px] border p-4 text-left transition-all duration-300',
                active
                  ? 'border-suit-heart/60 bg-suit-heart/[.08] shadow-[0_0_24px_rgba(238,106,114,.25)]'
                  : 'border-[rgba(227,194,124,.2)] bg-panel/80 hover:border-[rgba(246,227,180,.55)] hover:bg-elevated',
                dim && 'opacity-30',
              )}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-suit-heart/50 bg-ink font-mashan text-[16px] text-suit-heart">
                {NODE_GLYPH[k]}
              </span>
              <p className="mt-2.5 font-serifsc text-[16px] font-semibold text-bone">{NODE_META[k].name}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-dim">{NODE_META[k].desc}</p>
            </button>
          )
        })}
      </div>

      {/* 闪现提示 */}
      <AnimatePresence>
        {flash && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-full border border-gold-500/40 bg-ink/90 px-4 py-1 text-[12px] text-gold-300"
          >
            {flash}
          </motion.p>
        )}
      </AnimatePresence>

      {/* 祭坛交互 */}
      <AnimatePresence>
        {chosen === 'altar' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full rounded-[14px] border border-[rgba(238,106,114,.25)] bg-ink/70 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-[12px] text-dim">
              <Flame size={13} className="text-suit-heart" />
              <span>择一张牌——重摇一条词条（{run.altarFreeUsed ? `${REROLL_COST} 币` : '首次免费'}）或注灵（{INFUSE_COST} 币，至多 2 条）</span>
              <span className="flex-1" />
              <span className="flex items-center gap-1 font-mono text-suit-diamond"><Coins size={11} />{run.coins}</span>
            </div>
            <div className="flex max-h-[220px] flex-wrap gap-x-1.5 gap-y-3 overflow-y-auto rounded-[10px] border border-[rgba(227,194,124,.08)] bg-abyss/50 p-3">
              {deck.map((c) => (
                <PokerCard
                  key={c.id}
                  card={c}
                  size="xs"
                  selected={altarCard === c.id}
                  onClick={() => { setAltarCard(c.id); setInfuseOpts([]) }}
                />
              ))}
            </div>
            {card && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-[rgba(227,194,124,.12)] bg-panel/70 p-3">
                <span className="font-mono text-[12px] text-bone">{card.id}</span>
                {card.affixes.length === 0 && <span className="text-[11px] text-faint">（无词条，可注灵）</span>}
                {card.affixes.map((id, slot) => {
                  const a = getAffix(id)
                  const m = AFFIX_KIND_META[a.kind]
                  const afford = run.altarFreeUsed ? run.coins >= REROLL_COST : true
                  return (
                    <span key={`${id}-${slot}`} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: `${m.color}66`, color: m.color }}>
                      {m.name} · {a.name}
                      <button
                        type="button"
                        disabled={!afford}
                        onClick={() => {
                          if (usePoker.getState().altarReroll(card.id, slot)) say(`重摇成功：${card.id} 的词条已改换`)
                          else say('人心币不足')
                        }}
                        className="rounded-full bg-abyss/70 px-1.5 text-[10px] text-gold-300 transition-colors hover:text-gold-100 disabled:opacity-40"
                      >
                        重摇{rerollCost > 0 ? ` ${rerollCost}币` : '（免费）'}
                      </button>
                    </span>
                  )
                })}
                {card.affixes.length < 2 && (
                  <GoldButton
                    variant="ghost"
                    size="sm"
                    disabled={run.coins < INFUSE_COST}
                    onClick={() => setInfuseOpts(usePoker.getState().altarInfuseOptions(card.id))}
                  >
                    <Sparkles size={13} /> 注灵 {INFUSE_COST} 币 · 三选一
                  </GoldButton>
                )}
                {infuseOpts.length > 0 && (
                  <div className="mt-1 flex w-full flex-wrap gap-2">
                    {infuseOpts.map((id) => {
                      const a = getAffix(id)
                      const m = AFFIX_KIND_META[a.kind]
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (usePoker.getState().altarInfuse(card.id, id)) {
                              say(`注灵成功：${card.id} 获得「${a.name}」`)
                              setInfuseOpts([])
                            } else say('注灵失败（币不足或词条已满）')
                          }}
                          className="rounded-[10px] border px-3 py-1.5 text-left transition-colors hover:bg-elevated"
                          style={{ borderColor: `${m.color}55` }}
                        >
                          <span className="text-[12px]" style={{ color: m.color }}>{m.name} · {a.name}</span>
                          <p className="text-[10px] text-dim">{a.desc}</p>
                        </button>
                      )
                    })}
                    <button type="button" onClick={() => setInfuseOpts([])} className="self-center text-faint hover:text-dim">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 茶馆交互 */}
      <AnimatePresence>
        {chosen === 'teahouse' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full flex-wrap items-center gap-3 rounded-[14px] border border-[rgba(238,106,114,.25)] bg-ink/70 p-4"
          >
            <span className="font-mono text-[11px] text-dim">HP {run.hp}/{PLAYER_MAX_HP}</span>
            <GoldButton
              variant="suit"
              suit="heart"
              size="sm"
              disabled={run.hp >= PLAYER_MAX_HP}
              onClick={() => {
                if (usePoker.getState().teahouseHeal()) say(`一盏温茶入喉：HP +${TEA_HEAL}`)
              }}
            >
              <Heart size={13} /> 温茶疗愈 · 免费 +{TEA_HEAL} HP
            </GoldButton>
            <GoldButton
              variant="ghost"
              size="sm"
              disabled={run.coins < TEAPOT_PLAY_COST}
              onClick={() => { if (usePoker.getState().teahouseBuy('play')) say('购得「续盏」：下一场对决 +1 次出牌') }}
            >
              续盏 {TEAPOT_PLAY_COST}币 · 下场 +1 出牌
            </GoldButton>
            <GoldButton
              variant="ghost"
              size="sm"
              disabled={run.coins < TEAPOT_DISCARD_COST}
              onClick={() => { if (usePoker.getState().teahouseBuy('discard')) say('购得「换手」：下一场对决 +1 次弃牌') }}
            >
              换手 {TEAPOT_DISCARD_COST}币 · 下场 +1 弃牌
            </GoldButton>
            <span className="flex-1" />
            <span className="flex items-center gap-1 font-mono text-[12px] text-suit-diamond"><Coins size={12} />{run.coins}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 奇遇交互 */}
      <AnimatePresence>
        {chosen === 'encounter' && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full rounded-[14px] border border-[rgba(238,106,114,.25)] bg-ink/70 p-5 text-center"
          >
            {!encounterText ? (
              <>
                <p className="text-[13px] leading-relaxed text-dim">巷口挂着一盏无字灯笼，灯笼下蹲着一个戴面具的人影。ta 朝你招了招手。</p>
                <GoldButton
                  variant="suit"
                  suit="heart"
                  size="sm"
                  className="mt-3"
                  onClick={() => setEncounterText(usePoker.getState().applyEncounter())}
                >
                  走上前去 · 揭面
                </GoldButton>
              </>
            ) : (
              <>
                <p className="font-serifsc text-[15px] text-bone">{encounterText.text}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-suit-heart">{encounterText.resultText}</p>
                <p className="mt-2 font-mono text-[11px] text-dim">HP {run.hp} · 币 {run.coins}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

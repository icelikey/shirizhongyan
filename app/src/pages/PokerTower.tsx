/**
 * 丹丘牌楼 · 千面牌楼 `/game/poker`（poker.md §2 四屏结构）。
 * 屏一 牌楼外观（开局/继续/我的牌组）；屏二 对决（牌桌/读心区间/出牌演出）；
 * 屏三 层间节点三选一；屏四 终局/登顶结算。
 * 100dvh 应用壳，路由由主代理接线（default export）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Coins, Heart, Layers, RotateCcw, Sparkles, Swords, X } from 'lucide-react'
import { usePoker, TICKET_COST, FINAL_FLOOR } from '@/store/poker'
import { useProfile } from '@/store/profile'
import { OPPONENTS } from '@/data/poker/opponents'
import { evaluateHand, HAND_SCORE } from '@/engine/poker/evaluator'
import { cardValue } from '@/engine/poker/cards'
import type { DuelEvent } from '@/engine/poker/types'
import { getAffix } from '@/data/poker/affixes'
import { PLAYER_MAX_HP } from '@/engine/poker/duel'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import FragmentChip from '@/components/FragmentChip'
import MaskIcon from '@/components/MaskIcon'
import { useInkTransition } from '@/components/meta/InkTransition'
import PokerCard from '@/components/poker/PokerCard'
import DeckDrawer from '@/components/poker/DeckDrawer'
import NodePanel from '@/components/poker/NodePanel'
import GameIntroCards from '@/components/game/GameIntroCards'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

interface FloatMsg {
  id: number
  text: string
  target: 'opp' | 'me' | 'mid'
  tone: 'dmg' | 'heal' | 'gold' | 'info'
}

let floatSeq = 1

export default function PokerTower() {
  const { inkNode, go } = useInkTransition()
  const deck = usePoker((s) => s.deck)
  const deckReady = usePoker((s) => s.deckReady)
  const stats = usePoker((s) => s.stats)
  const run = usePoker((s) => s.run)
  const heartFragments = useProfile((s) => s.fragments.heart)
  const winsToward = useProfile((s) => s.winsTowardZodiac.heart)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [floats, setFloats] = useState<FloatMsg[]>([])
  const [banner, setBanner] = useState<{ key: number; name: string; chips: number; mult: number; damage: number } | null>(null)
  const [oppLine, setOppLine] = useState<string>('')
  const [log, setLog] = useState<string[]>([])
  const floatsRef = useRef<FloatMsg[]>([])

  useEffect(() => {
    usePoker.getState().ensureDeck()
  }, [])

  const opp = run ? OPPONENTS[run.floor - 1] : null
  const duel = run?.duel ?? null

  // 层变化清空演出状态（仅随楼层重置，避免胜负一瞬的清场打断击杀演出）
  useEffect(() => {
    setSelected([])
    setFloats([])
    floatsRef.current = []
    setBanner(null)
    setLog([])
    if (opp) setOppLine(opp.intro)
  }, [run?.floor]) // eslint-disable-line react-hooks/exhaustive-deps

  const pushFloat = (text: string, target: FloatMsg['target'], tone: FloatMsg['tone']) => {
    const f = { id: floatSeq++, text, target, tone }
    floatsRef.current = [...floatsRef.current.slice(-5), f]
    setFloats(floatsRef.current)
    window.setTimeout(() => {
      floatsRef.current = floatsRef.current.filter((x) => x.id !== f.id)
      setFloats(floatsRef.current)
    }, 1400)
  }

  /** 出牌事件 → 演出 */
  const presentEvents = (events: DuelEvent[], damage: number, betDamage: number) => {
    const score = events.find((e) => e.type === 'score')
    if (score && score.handType) {
      setBanner({ key: Date.now(), name: HAND_SCORE[score.handType].name, chips: score.chips ?? 0, mult: score.mult ?? 1, damage })
      pushFloat(`-${damage}`, 'opp', 'dmg')
    }
    if (betDamage > 0) pushFloat(`-${betDamage}`, 'me', 'dmg')
    const bet = events.find((e) => e.type === 'bet')
    if (bet && opp && betDamage >= 0 && (bet.amount ?? 0) > 0) {
      setOppLine(opp.betLines[Math.floor(Math.random() * opp.betLines.length)])
    }
    for (const e of events) {
      if (e.type === 'heal' && (e.amount ?? 0) > 0) pushFloat(`+${e.amount}`, 'me', 'heal')
      if (e.type === 'coins') pushFloat(`+${e.amount}币`, 'mid', 'gold')
    }
    setLog((prev) => [...events.map((e) => e.note).filter(Boolean), ...prev].slice(0, 8))
    if (events.some((e) => e.type === 'win') && opp) setOppLine(opp.defeat)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 5 ? prev : [...prev, id],
    )
  }

  const handlePlay = () => {
    if (selected.length === 0) return
    const r = usePoker.getState().playCards(selected)
    if (!r) return
    setSelected([])
    presentEvents(r.events, r.damage, r.betDamage)
  }

  const handleDiscard = () => {
    if (selected.length === 0) return
    const evs = usePoker.getState().discard(selected)
    if (!evs) return
    setSelected([])
    setLog((prev) => [...evs.map((e) => e.note), ...prev].slice(0, 8))
  }

  /** 牌型实时预览（基础筹码×倍率，词条另行提示） */
  const preview = useMemo(() => {
    if (!duel || selected.length === 0) return null
    const cards = duel.hand.filter((c) => selected.includes(c.id))
    if (cards.length === 0) return null
    const ev = evaluateHand(cards)
    const chips = ev.chips + cards.reduce((s, c) => s + cardValue(c.rank), 0)
    const affixCount = cards.reduce((s, c) => s + c.affixes.filter((id) => getAffix(id).trigger === 'onPlay').length, 0)
    return { name: HAND_SCORE[ev.type].name, chips, mult: ev.mult, affixCount }
  }, [duel, selected])

  const screen: 'lobby' | 'duel' | 'node' | 'end' = !run
    ? 'lobby'
    : run.phase === 'duel' && duel
      ? 'duel'
      : run.phase === 'node'
        ? 'node'
        : run.phase === 'won' || run.phase === 'lost'
          ? 'end'
          : 'lobby'

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-abyss text-bone">
      {/* 背景层 */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${screen === 'duel' ? '/bg-poker-table.png' : '/bg-danqiu-palace.png'})`, opacity: screen === 'duel' ? 0.5 : 0.62 }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 0%, transparent 30%, rgba(7,6,11,.92) 100%)' }} />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-[1280px] flex-col px-4 py-4 sm:px-6">
        {/* 顶栏 */}
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => go('/world')}
            className="flex items-center gap-1.5 text-[12px] tracking-wider text-dim transition-colors hover:text-gold-300"
          >
            <ArrowLeft size={14} /> 世界
          </button>
          <span className="flex items-center gap-1.5 text-suit-heart">
            <SuitIcon suit="heart" size={16} glow />
            <span className="font-serifsc text-[15px] font-semibold tracking-[.2em] text-bone">千面牌楼</span>
          </span>
          {run && (
            <span className="font-mono text-[11px] text-dim">
              第 <span className="text-suit-heart">{run.floor}</span>/{FINAL_FLOOR} 层
            </span>
          )}
          <span className="flex-1" />
          {run && (
            <span className="flex items-center gap-1 rounded-full border border-[rgba(242,169,59,.3)] bg-ink/70 px-2.5 py-1 font-mono text-[11px] text-suit-diamond">
              <Coins size={12} /> {run.coins}
            </span>
          )}
          <FragmentChip suit="heart" count={heartFragments} size="sm" />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[rgba(227,194,124,.28)] px-3 py-1 text-[11px] tracking-wider text-dim transition-colors hover:border-[rgba(246,227,180,.55)] hover:text-gold-300"
          >
            <Layers size={12} /> 我的牌组
          </button>
          <GameIntroCards suit="heart" spec={GAME_INTROS.poker} />
        </header>

        <AnimatePresence mode="wait">
          {screen === 'lobby' && (
            <motion.main
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 items-center justify-center"
            >
              <div className="panel-bg w-full max-w-[560px] rounded-[18px] border border-[rgba(238,106,114,.25)] p-8 text-center shadow-panel">
                <p className="font-mono text-[10px] uppercase tracking-[.4em] text-suit-heart">DANQIU · TOWER OF THOUSAND MASKS</p>
                <h1 className="gold-text mt-3 font-mashan text-[56px] leading-none tracking-[.1em]">千面牌楼</h1>
                <p className="mt-4 text-[13px] leading-relaxed text-dim">
                  丹丘心战之地。十二层面具牌手镇守长阶，读懂压注的节奏方能登顶。
                  你的 52 张牌是永久法器——词条洗炼，跨局不灭。
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '最高层数', value: stats.bestFloor },
                    { label: '登顶次数', value: stats.summits },
                    { label: '总局数', value: stats.runs },
                  ].map((s) => (
                    <div key={s.label} className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-2 py-2.5">
                      <p className="font-cinzel text-[20px] text-gold-300">{s.value}</p>
                      <p className="mt-0.5 text-[10px] tracking-[.2em] text-faint">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-dim">
                  <span>牌组词条</span>
                  <span className="font-mono text-suit-heart">{deckReady ? deck.reduce((s, c) => s + c.affixes.length, 0) : 0}</span>
                  <span className="text-faint">·</span>
                  <span>丹丘生肖进度</span>
                  <span className="font-mono text-suit-heart">{winsToward}/3</span>
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <GoldButton
                      variant="gold"
                      size="lg"
                      className="w-full"
                      disabled={heartFragments < TICKET_COST}
                      onClick={() => {
                        if (!usePoker.getState().startRun()) {
                          toast.error(`♥ 碎片不足 ${TICKET_COST}，无法支付门票`)
                          return
                        }
                        toast(`门票 -${TICKET_COST}♥ · 牌楼之门开启`, {
                          icon: <span className="text-suit-heart"><SuitIcon suit="heart" size={14} /></span>,
                        })
                      }}
                    >
                      <Swords size={16} /> 入楼开局 · 门票 {TICKET_COST}♥
                    </GoldButton>
                  {heartFragments < TICKET_COST && (
                    <p className="text-[11px] text-danger">♥ 碎片不足（{heartFragments}/{TICKET_COST}）——去其他大陆赢取碎片再来</p>
                  )}
                  <GoldButton variant="ghost" size="sm" onClick={() => setDrawerOpen(true)}>
                    <Layers size={14} /> 检视我的牌组 / 词条名录
                  </GoldButton>
                </div>
              </div>
            </motion.main>
          )}

          {screen === 'duel' && run && duel && opp && (
            <motion.main
              key={`duel-${run.floor}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-1 flex-col"
            >
              {/* 层数进度点 */}
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {OPPONENTS.map((o, i) => (
                  <span
                    key={o.id}
                    title={`${i + 1}F · ${o.name}`}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i + 1 < run.floor ? 'w-4 bg-suit-heart/70' : i + 1 === run.floor ? 'w-6 bg-suit-heart shadow-[0_0_8px_rgba(238,106,114,.6)]' : 'w-4 bg-[rgba(227,194,124,.15)]',
                    )}
                  />
                ))}
              </div>

              {/* 对手区 */}
              <div className="mt-3 flex items-start justify-center gap-4">
                <div className="relative flex w-[320px] max-w-full items-center gap-3 rounded-[14px] border border-[rgba(238,106,114,.3)] bg-ink/70 p-3 backdrop-blur-sm">
                  <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-full border border-[rgba(238,106,114,.5)] bg-abyss">
                    {opp.portrait ? (
                      <img src={opp.portrait} alt={opp.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <MaskIcon src="/icon-mask.svg" color="#EE6A72" size={44} alt={opp.name} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-serifsc text-[16px] font-semibold text-bone">{opp.name}</span>
                      {opp.elite && <span className="rounded-full bg-suit-diamond/20 px-1.5 py-0.5 text-[9px] tracking-wider text-suit-diamond">精英</span>}
                      {opp.boss && <span className="rounded-full bg-cinnabar/25 px-1.5 py-0.5 text-[9px] tracking-wider text-cinnabar-hi">楼主</span>}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-faint">{opp.mask}</p>
                    {/* HP */}
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgba(227,194,124,.1)]">
                      <motion.div
                        animate={{ width: `${(duel.oppHp / duel.oppMaxHp) * 100}%` }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-cinnabar to-cinnabar-hi"
                      />
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-dim">{duel.oppHp}/{duel.oppMaxHp}</p>
                  </div>
                  {/* 读心：压注区间徽章 */}
                  <div
                    className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-suit-heart/50 bg-abyss/95 px-2.5 py-0.5"
                    title={opp.elite || opp.boss ? '读心：面具伪装——显示区间比实际更宽' : '读心：对手压注区间'}
                  >
                    <span className="text-[9px] tracking-wider text-faint">读心</span>
                    <span className="font-mono text-[11px] text-suit-heart">
                      压注 {duel.shownBetRange[0]}–{duel.shownBetRange[1]}
                    </span>
                  </div>
                  {/* 伤害飘字 */}
                  <div className="pointer-events-none absolute -right-2 top-0 flex flex-col items-end gap-1">
                    <AnimatePresence>
                      {floats.filter((f) => f.target === 'opp').map((f) => (
                        <motion.span
                          key={f.id}
                          initial={{ opacity: 0, y: 8, scale: 0.8 }}
                          animate={{ opacity: 1, y: -18, scale: 1.15 }}
                          exit={{ opacity: 0, y: -30 }}
                          transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                          className="font-cinzel text-[22px] font-bold text-cinnabar-hi"
                          style={{ textShadow: '0 0 12px rgba(240,101,90,.6)' }}
                        >
                          {f.text}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* 对手台词 */}
              <div className="mt-5 flex justify-center">
                <p className="max-w-[420px] rounded-[10px] border border-[rgba(238,106,114,.18)] bg-elevated/80 px-3 py-1.5 text-center text-[12px] italic leading-relaxed text-dim">
                  {oppLine}
                </p>
              </div>

              {/* 中央演出区：牌型横幅 */}
              <div className="relative flex min-h-[92px] flex-1 items-center justify-center">
                <AnimatePresence mode="wait">
                  {banner && (
                    <motion.div
                      key={banner.key}
                      initial={{ opacity: 0, scale: 0.7, y: 16 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 1.1 }}
                      transition={{ duration: 0.35, ease: [0.83, 0, 0.17, 1] }}
                      className="flex items-baseline gap-3"
                    >
                      <span className="gold-text font-serifsc text-[34px] font-black tracking-[.12em]">{banner.name}</span>
                      <span className="font-mono text-[18px] text-suit-heart">{banner.chips}</span>
                      <span className="text-gold-500">×</span>
                      <span className="font-mono text-[18px] text-gold-300">{banner.mult}</span>
                      <span className="font-cinzel text-[26px] font-bold text-cinnabar-hi">= {banner.damage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* 中场飘字（币/信息） */}
                <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center gap-3">
                  <AnimatePresence>
                    {floats.filter((f) => f.target === 'mid').map((f) => (
                      <motion.span
                        key={f.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: -12 }}
                        exit={{ opacity: 0 }}
                        className="font-mono text-[14px] text-suit-diamond"
                      >
                        {f.text}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* 玩家区 */}
              <div className="relative mx-auto w-full max-w-[860px]">
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative flex flex-1 items-center gap-2">
                    <Heart size={14} className="shrink-0 text-cinnabar-hi" />
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[rgba(227,194,124,.1)]">
                      <motion.div
                        animate={{ width: `${(duel.playerHp / PLAYER_MAX_HP) * 100}%` }}
                        transition={{ duration: 0.4 }}
                        className="h-full rounded-full bg-gradient-to-r from-suit-heart/80 to-suit-heart"
                      />
                    </div>
                    <span className="font-mono text-[11px] text-dim">{duel.playerHp}/{PLAYER_MAX_HP}</span>
                    {/* 玩家受击飘字 */}
                    <div className="pointer-events-none absolute -top-5 left-8 flex gap-2">
                      <AnimatePresence>
                        {floats.filter((f) => f.target === 'me').map((f) => (
                          <motion.span
                            key={f.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: -10 }}
                            exit={{ opacity: 0 }}
                            className={cn('font-cinzel text-[16px] font-bold', f.tone === 'heal' ? 'text-ok' : 'text-cinnabar-hi')}
                          >
                            {f.text}
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                  <span className="rounded-full border border-[rgba(227,194,124,.2)] px-2.5 py-1 font-mono text-[11px] text-dim">
                    出牌 <span className="text-suit-heart">{duel.playsLeft}</span>
                  </span>
                  <span className="rounded-full border border-[rgba(227,194,124,.2)] px-2.5 py-1 font-mono text-[11px] text-dim">
                    弃牌 <span className="text-suit-heart">{duel.discardsLeft}</span>
                  </span>
                </div>

                {/* 牌型实时预览 */}
                <div className="mb-2 flex h-[44px] items-center justify-center">
                  {preview ? (
                    <div className="flex items-center gap-3 rounded-full border border-suit-heart/40 bg-ink/80 px-4 py-1.5">
                      <span className="font-serifsc text-[15px] font-semibold text-bone">{preview.name}</span>
                      <span className="font-mono text-[13px] text-suit-heart">{preview.chips}</span>
                      <span className="text-[12px] text-gold-500">×</span>
                      <span className="font-mono text-[13px] text-gold-300">{preview.mult}</span>
                      <span className="font-mono text-[13px] text-cinnabar-hi">≈ {Math.ceil(preview.chips * preview.mult)}</span>
                      {preview.affixCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-suit-diamond">
                          <Sparkles size={11} /> {preview.affixCount} 词条将触发
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] tracking-[.2em] text-faint">选 1–5 张牌组成牌型</span>
                  )}
                </div>

                {/* 手牌扇形 */}
                <div className="flex items-end justify-center gap-1.5 overflow-x-auto px-2 pb-4 pt-5 sm:gap-2">
                  {duel.hand.map((c, i) => {
                    const mid = (duel.hand.length - 1) / 2
                    const rot = (i - mid) * 2.4
                    return (
                      <div key={c.id} style={{ transform: `rotate(${rot}deg)` }} className="origin-bottom">
                        <PokerCard
                          card={c}
                          size="md"
                          selected={selected.includes(c.id)}
                          tempBuff={duel.tempBuffs[c.id]}
                          onClick={() => toggleSelect(c.id)}
                          className="max-lg:!h-[104px] max-lg:!w-[72px]"
                        />
                      </div>
                    )
                  })}
                </div>

                {/* 操作行 */}
                <div className="mt-1 flex items-center justify-center gap-3 pb-2">
                  <GoldButton variant="suit" suit="heart" size="md" disabled={selected.length === 0} onClick={handlePlay}>
                    <Swords size={15} /> 打出（{selected.length}）
                  </GoldButton>
                  <GoldButton variant="ghost" size="md" disabled={selected.length === 0 || duel.discardsLeft <= 0} onClick={handleDiscard}>
                    <RotateCcw size={14} /> 弃牌补牌（{duel.discardsLeft}）
                  </GoldButton>
                  <GoldButton
                    variant="danger"
                    size="md"
                    onClick={() => {
                      usePoker.getState().abandonRun()
                      toast('你转身下楼，牌楼在身后合上了门')
                    }}
                  >
                    <X size={14} /> 弃局
                  </GoldButton>
                </div>

                {/* 事件记录 */}
                {log.length > 0 && (
                  <div className="mx-auto mb-1 max-w-[640px] rounded-[10px] border border-[rgba(227,194,124,.08)] bg-ink/50 px-3 py-2">
                    {log.slice(0, 4).map((l, i) => (
                      <p key={`${i}-${l}`} className={cn('truncate text-[10.5px] leading-relaxed', i === 0 ? 'text-dim' : 'text-faint')}>
                        {l}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </motion.main>
          )}

          {screen === 'node' && run && (
            <motion.main
              key={`node-${run.floor}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 flex-col items-center justify-center gap-5 py-6"
            >
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.4em] text-suit-heart">INTERLUDE</p>
                <h2 className="gold-text mt-2 font-serifsc text-[30px] font-black tracking-[.15em]">第 {run.floor} 层已破 · 层间</h2>
                <p className="mt-1 text-[12px] text-dim">人心币 +{OPPONENTS[run.floor - 1].elite ? 40 : 15} 已入囊 · 择一处歇脚，然后继续登楼</p>
              </div>
              <NodePanelChosen />
            </motion.main>
          )}

          {screen === 'end' && run && (
            <motion.main
              key="end"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 items-center justify-center"
            >
              <div className={cn(
                'panel-bg w-full max-w-[520px] rounded-[18px] border p-8 text-center shadow-panel',
                run.phase === 'won' ? 'border-[rgba(238,106,114,.5)]' : 'border-[rgba(227,194,124,.2)]',
              )}>
                <p className="font-mono text-[10px] uppercase tracking-[.4em] text-suit-heart">
                  {run.phase === 'won' ? 'SUMMIT' : 'FALLEN'}
                </p>
                <h2 className={cn('mt-3 font-mashan text-[48px] leading-none tracking-[.1em]', run.phase === 'won' ? 'gold-text' : 'text-dim')}>
                  {run.phase === 'won' ? '登顶千面' : '败走牌楼'}
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-dim">
                  {run.phase === 'won'
                    ? '千面尽落，最后一张面具之下是你自己的脸。丹丘认你了。'
                    : `你走到了第 ${run.floor} 层。牌组不灭，词条犹温——养好了牌，再上来。`}
                </p>

                {/* 结算 */}
                <div className="mt-5 rounded-[12px] border border-[rgba(238,106,114,.2)] bg-ink/60 p-4">
                  <div className="relative flex items-center justify-center gap-2">
                    <SuitIcon suit="heart" size={20} glow />
                    <motion.span
                      key={run.settled ?? 0}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                      className="font-cinzel text-[34px] font-bold text-suit-heart"
                    >
                      +{run.settled ?? 0}
                    </motion.span>
                    {/* 碎片飞行（简化版：若干小碎片向右上飞去） */}
                    {[...Array(6)].map((_, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, x: 0, y: 0 }}
                        animate={{ opacity: [0, 1, 0], x: 60 + i * 14, y: -40 - (i % 3) * 12 }}
                        transition={{ duration: 0.9, delay: 0.15 + i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                        className="absolute left-1/2 text-suit-heart"
                      >
                        <SuitIcon suit="heart" size={10} />
                      </motion.span>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    {run.phase === 'won' ? '全额入账（含登顶 +40）' : '本局累积碎片保留一半（向上取整）'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: '抵达层数', value: run.floor },
                    { label: '最高纪录', value: stats.bestFloor },
                    { label: '登顶', value: stats.summits },
                  ].map((s) => (
                    <div key={s.label} className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-2 py-2">
                      <p className="font-cinzel text-[18px] text-gold-300">{s.value}</p>
                      <p className="mt-0.5 text-[10px] tracking-[.2em] text-faint">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-2.5">
                  <GoldButton
                    variant="gold"
                    size="lg"
                    disabled={heartFragments < TICKET_COST}
                    onClick={() => {
                      if (!usePoker.getState().startRun()) {
                        toast.error(`♥ 碎片不足 ${TICKET_COST}`)
                        return
                      }
                    }}
                  >
                    再登一次 · 门票 {TICKET_COST}♥
                  </GoldButton>
                  <GoldButton variant="ghost" size="sm" onClick={() => go('/world')}>
                    返回世界地图
                  </GoldButton>
                </div>
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>

      <DeckDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} deck={deck} />
      {inkNode}
    </div>
  )
}

/** 节点屏内部容器：管理「选定 → 可继续」状态 */
function NodePanelChosen() {
  const [chosen, setChosen] = useState(false)
  return (
    <>
      <NodePanel onChosen={setChosen} />
      <GoldButton
        variant="suit"
        suit="heart"
        size="md"
        disabled={!chosen}
        onClick={() => usePoker.getState().nextFloor()}
      >
        继续登楼 →
      </GoldButton>
    </>
  )
}

/**
 * 天梯 `/leaderboard`（design/leaderboard.md）。
 * 人 / AI 混排榜：综合评分 = 胜率 × √场次。
 * 身份盲盒：默认不标注人/AI；「揭盅」开关打开后全表 rotateY 错峰翻转揭示
 * （人=旅人印记 / AI=影从印记）；筛选 全部 / 只看旅人 / 只看影从。
 * 前三点将台金银铜演出；玩家自己金边高亮。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Eye, VenetianMask } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { getCountdown, formatHMS, COUNTDOWN_TICK_MS, DAY_MS, TOTAL_DAYS } from '@/lib/countdown'
import type { BoardEntry, GameTab, Identity } from '@/components/content/leaderboard-data'
import { buildBoard, sortByTab } from '@/components/content/leaderboard-data'
import { Podium, BoardRow, PlayerDrawer } from '@/components/content/leaderboard-ui'
import CountdownRing from '@/components/CountdownRing'
import EchoAvatar from '@/components/EchoAvatar'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'

const GAME_TABS: { id: GameTab; label: string }[] = [
  { id: 'overall', label: '总天梯' },
  { id: 'werewolf', label: '♠ 狼人杀' },
  { id: 'guess', label: '♣ 猜平均数' },
]

type Filter = 'blind' | Identity

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'blind', label: '身份盲盒' },
  { id: 'human', label: '只看旅人' },
  { id: 'echo', label: '只看影从' },
]

export default function Leaderboard() {
  const session = useProfile((s) => s.session)
  const records = useProfile((s) => s.records)
  const tier = useProfile((s) => s.tier)
  const memories = useProfile((s) => s.echoMemories)

  const [tab, setTab] = useState<GameTab>('overall')
  const [filter, setFilter] = useState<Filter>('blind')
  const [revealSwitch, setRevealSwitch] = useState(false)
  const [selected, setSelected] = useState<BoardEntry | null>(null)
  const [selfOffscreen, setSelfOffscreen] = useState(false)
  const selfRowRef = useRef<HTMLDivElement>(null)

  /* 赛季倒计时（tick 1s） */
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(t)
  }, [])
  const anchor = session?.createdAt ?? Date.now()
  const cd = getCountdown(anchor)
  const cycle = Math.floor((Date.now() - anchor) / (TOTAL_DAYS * DAY_MS)) + 1

  /* 榜单 */
  const board = useMemo(
    () => (session ? buildBoard({ nickname: session.nickname, records, tier }) : buildBoard(null)),
    [session, records, tier],
  )
  const sorted = useMemo(() => sortByTab(board, tab), [board, tab])
  const displayed = useMemo(
    () => (filter === 'blind' ? sorted : sorted.filter((e) => e.identity === filter)),
    [sorted, filter],
  )
  const revealed = revealSwitch || filter !== 'blind'

  /* 自己名次（基于当前 Tab 的全量榜） */
  const selfRank = sorted.findIndex((e) => e.isSelf) + 1
  const selfEntry = sorted.find((e) => e.isSelf)

  const top3 = displayed.slice(0, 3)
  const rest = displayed.slice(3)
  const selfInRest = rest.some((e) => e.isSelf)

  /* 自己行是否在屏外（sticky 影踪） */
  useEffect(() => {
    const el = selfRowRef.current
    if (!el || !selfInRest) {
      setSelfOffscreen(false)
      return
    }
    const io = new IntersectionObserver(([e]) => setSelfOffscreen(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [displayed, selfInRest])

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-20">
      {/* 页头 */}
      <header className="pt-12 pb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="gold-text font-serifsc font-black text-[40px] tracking-[.1em]">天梯</h1>
          <p className="text-dim text-[13px] tracking-[.25em] mt-2">
            第 {cycle} 个十日周期 · 终焉后积分重置
          </p>
        </div>
        {/* 赛季卡 */}
        <div className="panel-bg rounded-2xl px-5 py-3.5 flex items-center gap-4">
          <CountdownRing variant="mini" size={40} />
          <div>
            <p className="text-[11px] tracking-[.2em] text-faint">距赛季终焉</p>
            <p className={cn('font-mono text-[16px] leading-tight', cd.crisis ? 'text-cinnabar-hi' : 'text-gold-300')}>
              {formatHMS(cd.totalRemainMs)}
            </p>
          </div>
          <span className="w-px h-9 bg-[rgba(227,194,124,.14)]" />
          <div className="flex items-center gap-2.5">
            <EchoAvatar echo="baize" size={32} />
            <div>
              <p className="text-[10px] tracking-[.2em] text-faint flex items-center gap-1">
                <Crown size={10} className="text-gold-300" />
                上季魁首
              </p>
              <p className="text-[13px] text-bone font-serifsc">白泽</p>
            </div>
          </div>
        </div>
      </header>

      {/* 榜单 Tabs + 身份筛选 */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2">
          {GAME_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'h-9 px-5 rounded-full text-[13px] tracking-[.15em] border transition-all duration-200',
                tab === t.id
                  ? 'border-gold-300/60 text-gold-300 bg-gold-300/10 shadow-gold-glow'
                  : 'border-bone/10 text-dim hover:border-gold-300/30 hover:text-bone',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-bone/10 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'h-7 px-3.5 rounded-full text-[12px] tracking-[.1em] transition-all duration-200',
                  filter === f.id ? 'bg-gold-300/15 text-gold-300' : 'text-dim hover:text-bone',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* 揭盅开关 */}
          <button
            type="button"
            onClick={() => setRevealSwitch((v) => !v)}
            className={cn(
              'h-9 px-4 rounded-full border inline-flex items-center gap-2 text-[13px] tracking-[.15em] transition-all duration-300',
              revealed
                ? 'border-cinnabar/60 text-cinnabar-hi bg-cinnabar/10 shadow-[0_0_16px_rgba(216,68,60,.25)]'
                : 'border-gold-300/30 text-dim hover:text-gold-300 hover:border-gold-300/50',
            )}
            title="揭开所有身份牌"
          >
            {revealed ? <Eye size={15} /> : <VenetianMask size={15} />}
            {revealed ? '已揭盅' : '揭盅'}
          </button>
        </div>
      </div>
      <p className="text-faint text-[12px] tracking-[.15em] -mt-4 mb-8">
        盲盒模式是天梯的默认真相——在这里，战胜你的未必是人。
      </p>

      {/* 前三点将台 */}
      <section className="mb-10">
        <Podium key={`${tab}-${filter}`} top3={top3} tab={tab} revealed={revealed} />
      </section>

      {/* 榜单列表 */}
      <section className="relative">
        {/* sticky 我的名次 */}
        <AnimatePresence>
          {selfOffscreen && selfInRest && selfEntry && selfRank > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => selfRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="sticky top-[72px] z-30 mb-3 w-full h-11 rounded-xl border border-gold-300/40 bg-ink/90 backdrop-blur flex items-center justify-center gap-2 text-[13px] text-gold-300 shadow-gold-glow"
            >
              我的名次 #{selfRank}
              <span className="font-mono text-[11px] text-dim">点击定位</span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout">
            {rest.map((entry, i) => (
              <BoardRow
                key={entry.key}
                entry={entry}
                rank={i + 4}
                tab={tab}
                revealed={revealed}
                order={i + 3}
                onClick={() => setSelected(entry)}
                selfRef={entry.isSelf ? selfRowRef : undefined}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* 未上榜提示 */}
        {selfEntry && selfEntry.stats.overall.played === 0 && (
          <div className="mt-8 panel-bg rounded-2xl p-8 flex flex-col items-center gap-4">
            <p className="vertical-rl font-mashan text-faint text-[15px] h-[96px]">榜上无名，十日未记</p>
            <p className="text-dim text-[13px] tracking-[.1em]">榜上无名——赢三局，让十日记住你</p>
            <Link to="/lobby">
              <GoldButton variant="gold" size="sm">
                去开一局
              </GoldButton>
            </Link>
          </div>
        )}
      </section>

      {/* 往届名录（折叠占位） */}
      <details className="mt-12 panel-bg rounded-2xl px-6 py-4 group">
        <summary className="cursor-pointer text-[13px] tracking-[.2em] text-dim group-open:text-gold-300 select-none">
          往届名录 · 前 6 个十日周期
        </summary>
        <div className="pt-4 pb-2 grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[12px] text-faint font-mono">
          {[
            '第 6 周期 · 魁首 白泽 2840',
            '第 5 周期 · 魁首 璇玑 2791',
            '第 4 周期 · 魁首 白泽 2866',
            '第 3 周期 · 魁首 烛阴 2704',
            '第 2 周期 · 魁首 璇玑 2688',
            '第 1 周期 · 魁首 讹兽 2590',
          ].map((line) => (
            <p key={line} className="border-b border-bone/5 py-1.5">
              {line}
            </p>
          ))}
        </div>
      </details>

      {/* 牌风小传 Drawer */}
      <PlayerDrawer entry={selected} revealed={revealed} memories={memories} onClose={() => setSelected(null)} />
    </div>
  )
}

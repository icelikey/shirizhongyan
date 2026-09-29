/**
 * 联机终局结算弹层：名次表（冠军金光）+ 碎片云端入账提示 + 返回大厅。
 * v4 起花色/奖励/标题按游戏定义传入（默认 ♣ 50/25/5，兼容 guess-core）。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Crown, LoaderCircle, LogOut, Sparkles } from 'lucide-react'
import type { GuessRoomView } from '@contracts/room'
import type { Rewards } from '@contracts/gameSdk'
import GameModal from '@/components/game/GameModal'
import GoldButton from '@/components/GoldButton'
import SeatKindBadge from '@/components/online/SeatKindBadge'
import FragmentChip from '@/components/FragmentChip'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

const RANK_NUMERAL = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌']

export interface OnlineFinishedPanelProps {
  open: boolean
  /** 仅需名次/座位/本人座号（两模板视图结构一致） */
  view: Pick<GuessRoomView, 'rankings' | 'seats' | 'mySeat'>
  onClose: () => void
  onExit: () => void
  /** 结算花色（默认 ♣） */
  suit?: Suit
  /** 奖励池（默认 guess-core 50/25/5） */
  rewards?: Rewards
  title?: string
  /** 传入后，终局弹层会读取这局的公开证据战报。 */
  reportCode?: string
}

export default function OnlineFinishedPanel({
  open,
  view,
  onClose,
  onExit,
  suit = 'club',
  rewards = { winner: 50, runnerUp: 25, participation: 5 },
  title = '终局 · 算庭封盘',
  reportCode,
}: OnlineFinishedPanelProps) {
  const suitMeta = SUIT_META[suit]
  const rankings = view.rankings ?? []
  const myRank = view.mySeat != null ? rankings.indexOf(view.mySeat) : -1
  const [report, setReport] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  useEffect(() => {
    if (!open || !reportCode) return
    let cancelled = false
    setReportLoading(true)
    setReportError(null)
    fetch(`${import.meta.env.BASE_URL}world/v1/public/matches/${encodeURIComponent(reportCode)}/report`)
      .then(async (response) => {
        const payload = await response.json() as { report?: string; error?: { message?: string } }
        if (!response.ok) throw new Error(payload.error?.message || '战报暂时无法读取')
        if (!cancelled) setReport(payload.report || '这局没有可展示的战报正文。')
      })
      .catch((reason: unknown) => {
        if (!cancelled) setReportError(reason instanceof Error ? reason.message : '战报暂时无法读取')
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false)
      })
    return () => { cancelled = true }
  }, [open, reportCode])

  return (
    <GameModal open={open} title={title} onClose={onClose} className="max-w-[620px]">
      <div className="flex flex-col gap-4">
        {/* 名次 */}
        <div className="flex flex-col gap-1.5">
          {rankings.map((seatIdx, rank) => {
            const seat = view.seats.find((s) => s.index === seatIdx)
            if (!seat) return null
            const champion = rank === 0
            const mine = seatIdx === view.mySeat
            return (
              <motion.div
                key={seatIdx}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 * rank, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2',
                  champion
                    ? 'border-gold-300/70 bg-[rgba(227,194,124,.10)] shadow-[0_0_24px_rgba(227,194,124,.28)]'
                    : 'border-[rgba(227,194,124,.12)] bg-ink/40',
                  mine && !champion && 'border-[rgba(227,194,124,.35)]',
                )}
              >
                <span className={cn('font-mashan text-[18px] w-6 text-center', champion ? 'text-gold-300' : 'text-faint')}>
                  {RANK_NUMERAL[rank] ?? rank + 1}
                </span>
                {champion && <Crown size={16} className="text-gold-300 shrink-0" />}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className={cn('text-[14px] truncate', champion ? 'text-gold-300' : mine ? 'text-gold-100' : 'text-bone')}>
                    {seat.name}
                    {mine && <span className="text-[11px] text-faint">（你）</span>}
                  </span>
                  <SeatKindBadge kind={seat.kind} />
                </div>
                <span className="font-mono text-[15px] text-bone">{seat.score} 分</span>
              </motion.div>
            )
          })}
        </div>

        {/* 碎片入账提示 */}
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ borderColor: `${suitMeta.color}4D`, background: `${suitMeta.color}0F` }}
        >
          <Sparkles size={16} className="shrink-0" style={{ color: suitMeta.color }} />
          <p className="text-[12px] text-dim leading-relaxed flex-1">
            {myRank >= 0
              ? `本局名列第 ${RANK_NUMERAL[myRank] ?? myRank + 1} · ${suitMeta.symbol} 结算碎片已由服务端自动写入云端档案`
              : `${suitMeta.symbol} 结算碎片已由服务端按名次自动写入各入座者的云端档案`}
          </p>
          <FragmentChip
            suit={suit}
            count={myRank === 0 ? rewards.winner : myRank === 1 ? rewards.runnerUp : rewards.participation}
            size="sm"
          />
        </div>

        {reportCode && (
          <div className="rounded-xl border border-suit-diamond/25 bg-suit-diamond/[.05] px-4 py-3">
            <div className="flex items-center gap-2 text-suit-diamond">
              {reportLoading ? <LoaderCircle size={16} className="animate-spin" /> : <BookOpen size={16} />}
              <span className="text-[11px] tracking-[.2em]">Agent 智斗战报 · 公开证据版</span>
            </div>
            {reportLoading && <p className="mt-2 text-[11px] leading-5 text-dim">正在把真实事件流编成战报……</p>}
            {reportError && <p className="mt-2 text-[11px] leading-5 text-cinnabar-hi">{reportError}</p>}
            {report && (
              <pre className="mt-3 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg border border-white/[.07] bg-black/20 p-3 font-serifsc text-[12px] leading-6 text-bone/85">
                {report}
              </pre>
            )}
            <p className="mt-2 text-[10px] leading-4 text-faint">【事实】来自已落库事件；【推断】只来自 Agent 主动提交的策略摘要，不还原隐藏思维链。</p>
          </div>
        )}

        <div className="flex justify-center gap-4 mt-1">
          <GoldButton variant="gold" onClick={onExit}>
            <LogOut size={15} /> 返回大厅
          </GoldButton>
          <GoldButton variant="ghost" onClick={onClose}>留在算庭复盘</GoldButton>
        </div>
      </div>
    </GameModal>
  )
}

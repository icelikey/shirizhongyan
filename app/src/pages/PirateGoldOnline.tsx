/**
 * ============================================================================
 * 金壤分潮 · 海盗分金 · /game/online-pirate/:code
 * ----------------------------------------------------------------------------
 * 序号最小的存活者提案分金方案 → 全体存活者表决（赞成≥半数含提案人通过）→
 * 通过则终局按方案分得金币；否则提案人出局、提案权移交下一位存活者。
 *
 * 一轮拆两个子阶段（propose → vote），后端已用 phasesForRound 实现顺序博弈：
 * 表决者能看到 pending 里的提案内容再投票，而非同时密封盲投。
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Cloud, DoorOpen, Play, RotateCcw, Skull } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import type { PirateGoldRoomView } from '@contracts/gameSdk'
import GameTopBar from '@/components/game/GameTopBar'
import GoldButton from '@/components/GoldButton'
import SeatKindBadge from '@/components/online/SeatKindBadge'
import OnlineScorePanel from '@/components/online/OnlineScorePanel'
import OnlineFinishedPanel from '@/components/online/OnlineFinishedPanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

const PHASE_TEXT: Record<string, string> = {
  waiting: '待开局',
  submit: '提案 / 表决中',
  reveal: '揭晓中',
  finished: '已终局',
}

export default function PirateGoldOnline() {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [seatToken, setSeatToken] = useState<string | null>(() => sessionStorage.getItem(seatTokenKey(CODE)))

  const stateQuery = trpc.room.state.useQuery(
    { code: CODE, seatToken: seatToken ?? undefined },
    { refetchInterval: 1500, retry: 1 },
  )
  const view = stateQuery.data as PirateGoldRoomView | undefined

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(seatTokenKey(CODE), res.seatToken)
      setSeatToken(res.seatToken)
      toast('已入座', { description: `${res.seatIndex + 1} 号位 · 分金桌静候开局。` })
    },
    onError: (err) => toast('入座失败', { description: err.message }),
  })

  const joinTriedRef = useRef(false)
  useEffect(() => {
    if (seatToken || joinTriedRef.current || authLoading) return
    if (!view || view.status !== 'waiting' || !isAuthenticated) return
    joinTriedRef.current = true
    joinMutation.mutate({ code: CODE })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatToken, view?.status, isAuthenticated, authLoading])

  useEffect(() => {
    if (!seatToken || !view) return
    if (view.mySeat === null && view.status !== 'finished') {
      sessionStorage.removeItem(seatTokenKey(CODE))
      setSeatToken(null)
      joinTriedRef.current = false
    }
  }, [seatToken, view])

  const actMutation = trpc.room.act.useMutation({
    onSuccess: () => void stateQuery.refetch(),
    onError: (err) => toast('动作被拒绝', { description: err.message }),
  })

  const act = (
    action: { type: 'start' } | { type: 'propose'; allocation: number[] } | { type: 'vote'; approve: boolean },
  ) => {
    if (!seatToken) return
    actMutation.mutate({ code: CODE, seatToken, action })
  }

  const status = view?.status ?? 'waiting'
  const mySeat = view?.mySeat ?? null
  const isHost = mySeat === 0 && status === 'waiting'
  const coins = view?.coins ?? 20
  const aliveSeats = view?.aliveSeats ?? []
  const currentProposer = view?.currentProposer ?? null
  const iAmProposer = mySeat != null && mySeat === currentProposer
  const iAmAlive = mySeat != null && aliveSeats.includes(mySeat)
  const pending = view?.pending ?? null
  const iHaveVoted = mySeat != null && pending != null && pending.voted.includes(mySeat)
  const reveal = view?.lastReveal ?? null

  /** 提案草稿：默认自己独吞，随座位数变化重置 */
  const [draft, setDraft] = useState<number[]>([])
  useEffect(() => {
    if (!view) return
    const n = view.seats.length
    setDraft((prev) => {
      if (prev.length === n) return prev
      const next = new Array(n).fill(0)
      if (mySeat != null) next[mySeat] = coins
      return next
    })
  }, [view?.seats.length, mySeat, coins])

  const draftSum = draft.reduce((a, b) => a + b, 0)
  const draftValid = draftSum === coins && draft.every((v) => Number.isInteger(v) && v >= 0)

  const finishedShownRef = useRef(false)
  const [finishedOpen, setFinishedOpen] = useState(false)
  useEffect(() => {
    if (view?.status === 'finished' && !finishedShownRef.current) {
      finishedShownRef.current = true
      const t = setTimeout(() => setFinishedOpen(true), 900)
      return () => clearTimeout(t)
    }
  }, [view?.status])

  if (stateQuery.error) {
    return (
      <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col items-center justify-center gap-5">
        <span className="vertical-rl font-mashan text-[26px] text-suit-diamond/70">分金桌无处寻</span>
        <p className="text-[13px] text-dim">{stateQuery.error.message}</p>
        <GoldButton variant="gold" onClick={() => navigate('/lobby')}>返回大厅</GoldButton>
      </div>
    )
  }

  return (
    <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(242,169,59,.10), transparent)' }} />

      <GameTopBar
        suit="diamond"
        intro={GAME_INTROS.pirate}
        room={`金壤分潮 · ${view?.roomName ?? CODE} · ${CODE}`}
        phase={<span>{status === 'playing' ? PHASE_TEXT.submit : PHASE_TEXT[status]}</span>}
        pool={view ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation : 80}
        onExit={() => navigate('/lobby')}
      />

      <div className="relative z-10 flex-1 flex min-h-0">
        <aside className="w-[280px] shrink-0 hidden min-[1000px]:flex flex-col gap-4 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] overflow-y-auto">
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">存活座位</div>
            <div className="flex flex-col gap-1.5">
              {(view?.seats ?? []).map((s) => {
                const alive = aliveSeats.includes(s.index)
                const isProposer = s.index === currentProposer
                return (
                  <div
                    key={s.index}
                    className={cn(
                      'flex items-center gap-2 py-1 px-1.5 rounded-lg text-[12px]',
                      !alive && 'opacity-40 line-through',
                      isProposer && alive && 'bg-[rgba(242,169,59,.12)] border border-[rgba(242,169,59,.3)]',
                    )}
                  >
                    {!alive && <Skull size={12} className="shrink-0 text-faint" />}
                    <span className="flex-1 min-w-0 truncate text-bone">{s.name}</span>
                    <SeatKindBadge kind={s.kind} />
                    {isProposer && alive && <span className="text-[10px] text-gold-300 shrink-0">提案人</span>}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">规则速览</div>
            <p className="text-[12px] text-dim leading-relaxed">
              提案人分配全部 {coins} 金币 → 存活者表决（赞成≥半数含提案人通过）。
              通过即终局，按方案得分；否决则提案人出局，提案权移交下一位存活者；
              仅剩一人自动通过、独得全部金币。
            </p>
          </div>
        </aside>

        <main className="flex-1 relative min-w-0 flex flex-col p-4 gap-3">
          {status === 'waiting' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              {isHost ? (
                <>
                  <GoldButton variant="gold" size="lg" disabled={actMutation.isPending} onClick={() => act({ type: 'start' })}>
                    <Play size={16} /> 开局
                  </GoldButton>
                  <span className="text-[12px] text-dim">已入座 {view?.seats.length ?? 0}/{view ? view.seats.length : '?'} · 混沌之局需人机同席</span>
                </>
              ) : mySeat != null ? (
                <span className="text-[13px] text-dim tracking-[.2em]">已入座 · 静候房主开局</span>
              ) : isAuthenticated ? (
                <GoldButton
                  variant="suit"
                  suit="diamond"
                  size="lg"
                  disabled={joinMutation.isPending}
                  onClick={() => {
                    joinTriedRef.current = true
                    joinMutation.mutate({ code: CODE })
                  }}
                >
                  <DoorOpen size={16} /> {joinMutation.isPending ? '入座中…' : '入座此局'}
                </GoldButton>
              ) : (
                <GoldButton variant="gold" size="lg" onClick={() => navigate(LOGIN_PATH)}>
                  <Cloud size={16} /> 云登录后入座
                </GoldButton>
              )}
            </div>
          )}

          {status === 'playing' && (
            <>
              <div className="panel-bg rounded-xl p-3 text-[12px] text-dim">
                {currentProposer != null && (
                  <span>
                    当前提案人：<span className="text-gold-300">{view?.seats.find((s) => s.index === currentProposer)?.name ?? currentProposer}</span>
                  </span>
                )}
              </div>

              {/* 提案面板：仅本人是提案人且尚未提交时显示 */}
              {iAmProposer && !pending && (
                <div className="panel-bg rounded-xl p-4 flex flex-col gap-3">
                  <div className="text-[13px] text-bone">分配全部 {coins} 枚金币（含你自己）</div>
                  <div className="flex flex-col gap-2">
                    {(view?.seats ?? []).map((s) => {
                      const alive = aliveSeats.includes(s.index)
                      if (!alive) return null
                      return (
                        <div key={s.index} className="flex items-center gap-3">
                          <span className="w-24 shrink-0 truncate text-[12px] text-dim">{s.name}{s.index === mySeat ? '（你）' : ''}</span>
                          <input
                            type="number"
                            min={0}
                            max={coins}
                            value={draft[s.index] ?? 0}
                            onChange={(e) => {
                              const v = Math.max(0, Math.min(coins, Math.round(Number(e.target.value) || 0)))
                              setDraft((prev) => {
                                const next = [...prev]
                                next[s.index] = v
                                return next
                              })
                            }}
                            className="w-20 bg-transparent border-b border-[rgba(227,194,124,.3)] font-mono text-[16px] text-bone outline-none focus:border-gold-300"
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-[12px]', draftValid ? 'text-suit-club' : 'text-suit-heart')}>
                      合计 {draftSum} / {coins}
                    </span>
                    <GoldButton
                      variant="gold"
                      size="sm"
                      disabled={!draftValid || actMutation.isPending}
                      onClick={() => act({ type: 'propose', allocation: draft })}
                    >
                      提交方案
                    </GoldButton>
                  </div>
                </div>
              )}

              {/* 表决面板：可见提案，且本人存活、非提案人、尚未投票 */}
              {pending && (
                <div className="panel-bg rounded-xl p-4 flex flex-col gap-3">
                  <div className="text-[13px] text-bone">提案人 {view?.seats.find((s) => s.index === pending.proposer)?.name} 的方案：</div>
                  <div className="flex flex-wrap gap-2">
                    {(view?.seats ?? []).map((s) => {
                      const alive = aliveSeats.includes(s.index)
                      if (!alive) return null
                      return (
                        <span
                          key={s.index}
                          className="rounded-lg border border-[rgba(227,194,124,.2)] bg-ink/40 px-3 py-1.5 text-[12px] text-bone"
                        >
                          {s.name}：<span className="font-mono text-gold-300">{pending.allocation[s.index] ?? 0}</span>
                        </span>
                      )
                    })}
                  </div>
                  {iAmAlive && !iAmProposer && !iHaveVoted && (
                    <div className="flex items-center gap-3">
                      <GoldButton variant="suit" suit="diamond" size="sm" disabled={actMutation.isPending} onClick={() => act({ type: 'vote', approve: true })}>
                        赞成
                      </GoldButton>
                      <GoldButton variant="ghost" size="sm" disabled={actMutation.isPending} onClick={() => act({ type: 'vote', approve: false })}>
                        反对
                      </GoldButton>
                    </div>
                  )}
                  {iHaveVoted && <span className="text-[12px] text-faint">已投票 · 静候其余存活者表决</span>}
                  <span className="text-[11px] text-faint">已投票 {pending.voted.length} 人</span>
                </div>
              )}

              {!iAmProposer && !pending && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-[13px] text-dim tracking-[.2em]">提案人正在拟定方案…</span>
                </div>
              )}
            </>
          )}

          {reveal && status !== 'waiting' && (
            <div className="shrink-0 panel-bg rounded-xl p-3 text-[12px] text-dim">
              上轮：提案人 {view?.seats.find((s) => s.index === reveal.proposer)?.name} ·{' '}
              {reveal.passed ? <span className="text-suit-club">方案通过</span> : <span className="text-suit-heart">方案否决 · 提案人出局</span>}
            </div>
          )}

          {status === 'finished' && (
            <div className="shrink-0 flex items-center justify-center gap-4 py-2">
              <GoldButton variant="gold" onClick={() => setFinishedOpen(true)}>查看结算</GoldButton>
              <GoldButton variant="ghost" onClick={() => navigate('/lobby')}>
                <RotateCcw size={15} /> 返回大厅
              </GoldButton>
            </div>
          )}
        </main>

        <aside className="w-[300px] shrink-0 hidden min-[1000px]:flex flex-col gap-4 p-4 border-l border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] min-h-0 overflow-y-auto">
          <OnlineScorePanel seats={view?.seats ?? []} mySeat={mySeat} winner={view?.winner} />
        </aside>
      </div>

      {view && (
        <OnlineFinishedPanel
          open={finishedOpen && status === 'finished'}
          view={view}
          onClose={() => setFinishedOpen(false)}
          onExit={() => navigate('/lobby')}
          suit="diamond"
          rewards={view.rewards}
          title="终局 · 分金桌封盘"
        />
      )}
    </div>
  )
}

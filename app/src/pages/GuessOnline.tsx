/**
 * ============================================================================
 * 联机猜平均数 · /game/online/:code
 * ----------------------------------------------------------------------------
 * 视觉复用本地版青玉算庭语言（椭圆六座 / 浑天仪揭示 / 滑杆+印章提交 / 积分榜），
 * 状态全部来自服务端：trpc.room.state（1.5s 轮询），动作走 trpc.room.act。
 *
 * - seatToken 存 sessionStorage（tdg-seat-<code>）；
 * - 无 token 且房间 waiting 且已云登录 → 自动 room.join；未登录提示先去云登录；
 * - 座位徽标区分：旅人 / 影从 / 外来 Agent（联机房不搞身份盲盒）。
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Cloud, DoorOpen, Play, RotateCcw } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import type { GuessRoomView } from '@contracts/room'
import { ECHOES } from '@/data/echoes'
import SeatRing from '@/components/SeatRing'
import TimerRing from '@/components/TimerRing'
import GoldButton from '@/components/GoldButton'
import GameTopBar from '@/components/game/GameTopBar'
import SeatEllipse from '@/components/game/SeatEllipse'
import MaskIcon from '@/components/MaskIcon'
import OnlineArmillary from '@/components/online/OnlineArmillary'
import OnlineScorePanel from '@/components/online/OnlineScorePanel'
import OnlineFinishedPanel from '@/components/online/OnlineFinishedPanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

/** v3 默认：30s 提交窗 / ♣ 奖池 80（v4 起以服务端视图中的定义参数为准） */
const DEFAULT_WINDOW_SEC = 30
const DEFAULT_REWARD_POOL = 80

/** 每 200ms tick（倒计时环用） */
function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  return now
}

const PHASE_TEXT: Record<string, string> = {
  waiting: '待开局',
  submit: '落子中',
  reveal: '揭示中',
  finished: '已终局',
}

export default function GuessOnline() {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  /* ---------------- seatToken（sessionStorage） ---------------- */
  const [seatToken, setSeatToken] = useState<string | null>(() => sessionStorage.getItem(seatTokenKey(CODE)))

  /* ---------------- 房间状态（1.5s 轮询） ---------------- */
  const stateQuery = trpc.room.state.useQuery(
    { code: CODE, seatToken: seatToken ?? undefined },
    { refetchInterval: 1500, retry: 1 },
  )
  // 本页只进入 numberGuess 房间（pollDuel 房由 PollOnline 承接），窄化为猜数视图
  const view = stateQuery.data as GuessRoomView | undefined

  /* ---------------- 入座 ---------------- */
  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(seatTokenKey(CODE), res.seatToken)
      setSeatToken(res.seatToken)
      toast('已入座', { description: `${res.seatIndex + 1} 号位 · 算庭静候开局。` })
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

  /* token 失效（如房间已重建）：清除并重试 */
  useEffect(() => {
    if (!seatToken || !view) return
    if (view.mySeat === null && view.status !== 'finished') {
      sessionStorage.removeItem(seatTokenKey(CODE))
      setSeatToken(null)
      joinTriedRef.current = false
    }
  }, [seatToken, view])

  /* ---------------- 动作 ---------------- */
  const actMutation = trpc.room.act.useMutation({
    onSuccess: () => void stateQuery.refetch(),
    onError: (err) => toast('动作被拒绝', { description: err.message }),
  })

  const act = (action: { type: 'start' } | { type: 'submit'; value: number }) => {
    if (!seatToken) return
    actMutation.mutate({ code: CODE, seatToken, action })
  }

  /* ---------------- 控制台草稿 ---------------- */
  const [draft, setDraft] = useState(33)
  const round = view?.round ?? 0
  useEffect(() => {
    setDraft(33)
  }, [round])

  /* ---------------- 时钟（serverNow 校准） ---------------- */
  const now = useNow()
  const clockOffset = view ? view.serverNow - Date.now() : 0
  const submitWindowSec = view?.submitWindowSec ?? DEFAULT_WINDOW_SEC
  const rewardPool = view
    ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation
    : DEFAULT_REWARD_POOL
  const timeLeft =
    view?.phase === 'submit' && view.submitDeadlineAt != null
      ? Math.max(0, (view.submitDeadlineAt - (now + clockOffset)) / 1000)
      : submitWindowSec

  /* ---------------- 终局弹层 ---------------- */
  const [finishedOpen, setFinishedOpen] = useState(false)
  const finishedShownRef = useRef(false)
  useEffect(() => {
    if (view?.status === 'finished' && !finishedShownRef.current) {
      finishedShownRef.current = true
      const t = setTimeout(() => setFinishedOpen(true), 900)
      return () => clearTimeout(t)
    }
  }, [view?.status])

  /* ---------------- 渲染数据 ---------------- */
  const status = view?.status ?? 'waiting'
  const phase = view?.phase ?? null
  const mySeat = view?.mySeat ?? null
  const revealing = status === 'playing' && phase === 'reveal' && view?.lastReveal != null
  const reveal = view?.lastReveal ?? null
  const mySeatView = mySeat != null ? view?.seats.find((s) => s.index === mySeat) : undefined
  const isHost = mySeat === 0 && status === 'waiting'

  const seatNames = useMemo(() => {
    const map: Record<number, string> = {}
    view?.seats.forEach((s) => {
      map[s.index] = s.name
    })
    return map
  }, [view?.seats])

  /* 六座节点（等待期空席渲染占位） */
  const seatNodes = Array.from({ length: 6 }).map((_, i) => {
    const seat = view?.seats.find((s) => s.index === i)
    if (!seat) {
      return (
        <motion.div
          key={`empty-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 * i, duration: 0.5 }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="w-[72px] h-[72px] rounded-full border border-dashed border-[rgba(227,194,124,.22)] bg-ink/40 flex items-center justify-center">
            <span className="text-faint text-[10px] tracking-widest">空席</span>
          </span>
          <span className="text-[11px] text-faint">待入座</span>
        </motion.div>
      )
    }
    const mine = seat.index === mySeat
    const echo = seat.kind === 'echo-bot' ? ECHOES.find((e) => e.name === seat.name) : undefined
    const seatStatus =
      status === 'playing' && phase === 'submit'
        ? seat.submitted
          ? 'submitted'
          : 'thinking'
        : 'idle'
    const isWinner = revealing && reveal?.winnerSeat === seat.index
    const kindTag = seat.kind === 'human' ? '旅人' : seat.kind === 'echo-bot' ? '影从' : '外来 Agent'
    return (
      <motion.div
        key={seat.index}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 * seat.index, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn('relative', isWinner && 'rounded-full shadow-[0_0_28px_rgba(78,203,156,.55)]')}
      >
        {seat.kind === 'external-agent' && (
          <span className="absolute -top-1 -left-1 z-30 w-6 h-6 rounded-full bg-ink border border-[#9B7FE8]/60 flex items-center justify-center">
            <MaskIcon src="/icon-mask.svg" size={12} color="#9B7FE8" alt="Agent" />
          </span>
        )}
        <SeatRing
          name={mine ? `你 · ${seat.name}` : seat.name}
          echo={echo}
          avatarUrl={seat.kind === 'external-agent' ? '/icon-mask.svg' : '/avatar-traveler.png'}
          tag={kindTag}
          status={seatStatus}
          active={isWinner === true}
          suit="club"
          isSelf={mine}
        />
        {/* 揭示时座位前翻出数字 */}
        {revealing && reveal && reveal.values[seat.index] != null && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: 0.1 + seat.index * 0.06, duration: 0.42, ease: [0.83, 0, 0.17, 1] }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-9 rounded-md border bg-ink/95 px-2 py-0.5 font-mono text-[13px]',
              isWinner ? 'border-gold-300 text-gold-300' : 'border-[rgba(78,203,156,.35)] text-bone',
            )}
          >
            {reveal.values[seat.index].toFixed(1)}
          </motion.div>
        )}
      </motion.div>
    )
  })

  /* ---------------- 错误态 ---------------- */
  if (stateQuery.error) {
    return (
      <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col items-center justify-center gap-5">
        <span className="vertical-rl font-mashan text-[26px] text-suit-club/70">算庭无处寻</span>
        <p className="text-[13px] text-dim">{stateQuery.error.message}</p>
        <GoldButton variant="gold" onClick={() => navigate('/lobby')}>返回大厅</GoldButton>
      </div>
    )
  }

  return (
    <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col">
      {/* 背景：青野算庭 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/bg-abacus-court.png")', filter: 'brightness(.55)' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(78,203,156,.10), transparent)' }} />

      <GameTopBar
        suit="club"
        room={`联机算庭 · ${view?.roomName ?? CODE} · ${CODE}`}
        phase={
          <span className="flex items-center gap-3">
            <span>
              {status === 'playing' ? `第 ${round} / ${view?.totalRounds ?? 5} 轮` : PHASE_TEXT[status]}
            </span>
            <span className="flex items-center gap-1">
              {Array.from({ length: view?.totalRounds ?? 5 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-500',
                    i < round - 1 && 'bg-suit-club',
                    i === round - 1 && status === 'playing' && 'bg-gold-300 animate-breathe',
                    i >= round && 'bg-[rgba(227,194,124,.18)]',
                  )}
                />
              ))}
            </span>
          </span>
        }
        pool={rewardPool}
        onExit={() => navigate('/lobby')}
      />

      {/* 三栏 */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* 左栏：轮次史 + 规则 */}
        <aside className="w-[280px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] overflow-y-auto">
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">轮次史</div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: view?.totalRounds ?? 5 }).map((_, i) => {
                const current = status === 'playing' && round === i + 1
                const done = round > i + 1 || status === 'finished'
                return (
                  <div key={i} className={cn('flex items-center gap-2 text-[12px] py-1', done ? 'text-dim' : 'text-faint', current && 'border-l-2 border-gold-300 pl-2 -ml-2 text-bone')}>
                    <span className="font-cinzel w-6">R{i + 1}</span>
                    <span>{current ? (phase === 'reveal' ? '揭示中…' : '演算中…') : done ? '已封盘' : '——'}</span>
                    {reveal && reveal.round === i + 1 && (
                      <span className="ml-auto font-mono text-[11px] text-gold-300/80">μ{reveal.average.toFixed(1)} → {reveal.target.toFixed(1)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">规则速览</div>
            <p className="text-[12px] text-dim leading-relaxed">
              0–100 出数 · 取均值 2/3 · 最近者 +2 分 · 次近 +1 分 · 5 轮总分定胜负 · 平局先提交者胜。
              30s 提交窗，超时按 50 兜底。空位由服务端影从填充；终局 ♣ 碎片自动写入云端档案（冠军 +50 / 亚军 +25 / 参与 +5）。
            </p>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">房码</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[18px] text-gold-300 tracking-[.25em]">{CODE}</span>
              <GoldButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(CODE).then(
                    () => toast('房码已复制', { description: '邀旅人或 Agent 凭码入座。' }),
                    () => undefined,
                  )
                }}
              >
                复制
              </GoldButton>
            </div>
          </div>
        </aside>

        {/* 中央牌桌 */}
        <main className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            {view ? (
              <SeatEllipse seats={seatNodes} suit="club">
                <OnlineArmillary revealing={revealing === true} round={round} reveal={reveal} seatNames={seatNames} size={250} />
              </SeatEllipse>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="vertical-rl font-mashan text-[26px] text-suit-club/60">星网接驳中</span>
              </div>
            )}
            {status === 'waiting' && view && (
              <div className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
                <span className="vertical-rl font-mashan text-[24px] text-[rgba(78,203,156,.75)]">旅人落座 · 算庭将启</span>
              </div>
            )}
          </div>

          {/* 上轮揭示带 */}
          <div className="h-16 shrink-0 mx-4 mb-1 rounded-xl border border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.6)] flex items-center gap-3 px-4 overflow-x-auto">
            {reveal ? (
              <>
                <span className="font-cinzel text-suit-club text-[14px] shrink-0">R{reveal.round}</span>
                {Object.entries(reveal.values)
                  .map(([seat, value]) => ({ seat: Number(seat), value }))
                  .sort((a, b) => a.seat - b.seat)
                  .map((e) => (
                    <span
                      key={e.seat}
                      className={cn(
                        'font-mono text-[12px] px-1.5 py-0.5 rounded border shrink-0',
                        e.seat === reveal.winnerSeat ? 'border-gold-300 text-gold-300' : 'border-[rgba(78,203,156,.25)] text-dim',
                      )}
                      title={seatNames[e.seat]}
                    >
                      {e.value.toFixed(1)}
                    </span>
                  ))}
                <span className="font-mono text-[12px] text-faint shrink-0 ml-auto">
                  均值 {reveal.average.toFixed(2)} → 目标 <span className="text-gold-300">{reveal.target.toFixed(2)}</span>
                  {reveal.tieWin && <span className="text-suit-club"> · 同距先交者胜</span>}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-faint">首轮演算尚未揭示</span>
            )}
          </div>

          {/* 底部控制台 */}
          <div className="shrink-0 border-t border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.78)] backdrop-blur-[12px] px-4 py-3">
            <div className="flex items-center gap-5 h-[72px] max-w-[1100px] mx-auto">
              {/* waiting：房主开局 / 入座引导 */}
              {status === 'waiting' && (
                <>
                  {isHost ? (
                    <div className="flex items-center gap-4 mx-auto">
                      <GoldButton variant="gold" size="lg" disabled={actMutation.isPending} onClick={() => act({ type: 'start' })}>
                        <Play size={16} /> 开局 · 影从补席
                      </GoldButton>
                      <span className="text-[12px] text-dim">已入座 {view?.seats.length ?? 0}/6 · 空位由影从填充</span>
                    </div>
                  ) : mySeat != null ? (
                    <span className="mx-auto text-[13px] text-dim tracking-[.2em]">已入座 · 静候房主开局</span>
                  ) : isAuthenticated ? (
                    <div className="flex items-center gap-4 mx-auto">
                      <GoldButton
                        variant="suit"
                        suit="club"
                        size="lg"
                        disabled={joinMutation.isPending}
                        onClick={() => {
                          joinTriedRef.current = true
                          joinMutation.mutate({ code: CODE })
                        }}
                      >
                        <DoorOpen size={16} /> {joinMutation.isPending ? '入座中…' : '入座此局'}
                      </GoldButton>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 mx-auto">
                      <GoldButton variant="gold" size="lg" onClick={() => navigate(LOGIN_PATH)}>
                        <Cloud size={16} /> 云登录后入座
                      </GoldButton>
                      <span className="text-[12px] text-dim">旁观中 · 联机入座以 Kimi 云端档案为凭</span>
                    </div>
                  )}
                </>
              )}

              {/* submit：滑杆 + 印章提交 */}
              {status === 'playing' && phase === 'submit' && mySeatView && (
                <>
                  <div className="flex flex-col gap-1.5 w-[300px]">
                    <div className="flex items-end gap-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={Number.isFinite(draft) ? draft : 0}
                        disabled={mySeatView.submitted}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          if (Number.isFinite(v)) setDraft(Math.max(0, Math.min(100, v)))
                        }}
                        className="w-[110px] bg-transparent border-b border-[rgba(227,194,124,.3)] font-cinzel font-bold text-[34px] text-bone outline-none focus:border-suit-club disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[11px] text-faint mb-2">0 – 100 · 可取一位小数</span>
                    </div>
                    <Slider
                      value={[draft]}
                      min={0}
                      max={100}
                      step={1}
                      disabled={mySeatView.submitted}
                      onValueChange={(v) => setDraft(v[0])}
                      className="w-full [&_[data-slot=slider-track]]:bg-[rgba(78,203,156,.15)] [&_[data-slot=slider-range]]:bg-suit-club [&_[data-slot=slider-thumb]]:border-suit-club [&_[data-slot=slider-thumb]]:bg-ink"
                    />
                  </div>
                  <div className="flex-1" />
                  {mySeatView.submitted ? (
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] text-faint tracking-[.2em]">已落子</span>
                        <span className="font-cinzel font-bold text-[24px] text-suit-club">待揭示</span>
                      </div>
                      <TimerRing total={submitWindowSec} left={timeLeft} size={52} />
                    </div>
                  ) : (
                    <>
                      <GoldButton variant="suit" suit="club" size="lg" disabled={actMutation.isPending} onClick={() => act({ type: 'submit', value: Math.round(draft * 10) / 10 })}>
                        落子无悔
                      </GoldButton>
                      <TimerRing total={submitWindowSec} left={timeLeft} size={52} />
                    </>
                  )}
                </>
              )}
              {status === 'playing' && phase === 'submit' && !mySeatView && (
                <span className="mx-auto text-[13px] text-dim tracking-[.2em]">旁观中 · 第 {round} 轮落子</span>
              )}
              {status === 'playing' && phase === 'reveal' && (
                <span className="mx-auto text-[13px] text-dim tracking-[.2em]">浑天仪揭示中…</span>
              )}

              {/* finished */}
              {status === 'finished' && (
                <div className="flex items-center gap-4 mx-auto">
                  <GoldButton variant="gold" onClick={() => setFinishedOpen(true)}>查看结算</GoldButton>
                  <GoldButton variant="ghost" onClick={() => navigate('/lobby')}>
                    <RotateCcw size={15} /> 返回大厅
                  </GoldButton>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 右栏：积分榜 */}
        <aside className="w-[320px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-l border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] min-h-0 overflow-y-auto">
          <OnlineScorePanel seats={view?.seats ?? []} mySeat={mySeat} winner={view?.winner} />
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">星网状态</div>
            <p className="text-[12px] text-dim leading-relaxed">
              状态每 1.5s 自服务端同步
              {status === 'playing' && phase === 'submit' && (
                <> · 本轮已落子 <span className="font-mono text-suit-club">{view?.submittedCount ?? 0}</span>/{view?.seats.length ?? 6}</>
              )}
            </p>
          </div>
        </aside>
      </div>

      {/* 终局结算 */}
      {view && (
        <OnlineFinishedPanel
          open={finishedOpen && status === 'finished'}
          view={view}
          onClose={() => setFinishedOpen(false)}
          onExit={() => navigate('/lobby')}
        />
      )}
    </div>
  )
}

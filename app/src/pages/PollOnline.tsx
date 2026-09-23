/**
 * ============================================================================
 * 联机「红眼病」少数派票决 · /game/online-poll/:code（PollDuel 模板游玩页）
 * ----------------------------------------------------------------------------
 * 复用联机组件壳（SeatRing / TimerRing / GameTopBar / OnlineScorePanel /
 * OnlineFinishedPanel），视觉延续墨色 + ♥ 朱红花色语言：
 * 中央为 2–4 枚大玺印选项按钮；揭晓时中央演出各选项分布柱状图，
 * 少数派（唯一最少票）金色加冕。状态来自服务端 trpc.room.state（1.5s 轮询）。
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Cloud, DoorOpen, Play, RotateCcw } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import type { PollRoomView } from '@contracts/gameSdk'
import { ECHOES, SUIT_META } from '@/data/echoes'
import SeatRing from '@/components/SeatRing'
import TimerRing from '@/components/TimerRing'
import GoldButton from '@/components/GoldButton'
import GameTopBar from '@/components/game/GameTopBar'
import MaskIcon from '@/components/MaskIcon'
import OnlineScorePanel from '@/components/online/OnlineScorePanel'
import OnlineFinishedPanel from '@/components/online/OnlineFinishedPanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

const DEFAULT_WINDOW_SEC = 30
/** 选项玺印配色（红/紫/青/金） */
const SEAL_COLORS = ['#EE6A72', '#8B93F8', '#4ECB9C', '#F2A93B']

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
  submit: '投票中',
  reveal: '揭晓中',
  finished: '已终局',
}

/** N 座椭圆均布：0 号座固定底部（90°），逆时针均布 */
function seatPos(i: number, n: number): { left: string; top: string } {
  const rad = ((90 - (360 / n) * i) * Math.PI) / 180
  return { left: `${50 + 46 * Math.cos(rad)}%`, top: `${50 - 44 * Math.sin(rad)}%` }
}

export default function PollOnline() {
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
  // 本页只承接 pollDuel 房间（猜数房由 GuessOnline 承接）
  const view = stateQuery.data as PollRoomView | undefined

  /* ---------------- 入座 ---------------- */
  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(seatTokenKey(CODE), res.seatToken)
      setSeatToken(res.seatToken)
      toast('已入座', { description: `${res.seatIndex + 1} 号位 · 票庭静候开局。` })
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

  /* ---------------- 动作 ---------------- */
  const actMutation = trpc.room.act.useMutation({
    onSuccess: () => void stateQuery.refetch(),
    onError: (err) => toast('动作被拒绝', { description: err.message }),
  })

  const act = (action: { type: 'start' } | { type: 'choose'; choice: number }) => {
    if (!seatToken) return
    actMutation.mutate({ code: CODE, seatToken, action })
  }

  /* ---------------- 时钟 ---------------- */
  const now = useNow()
  const clockOffset = view ? view.serverNow - Date.now() : 0
  const submitWindowSec = view?.submitWindowSec ?? DEFAULT_WINDOW_SEC
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
  const reveal = view?.lastReveal ?? null
  const revealing = status === 'playing' && phase === 'reveal' && reveal != null
  const mySeatView = mySeat != null ? view?.seats.find((s) => s.index === mySeat) : undefined
  const isHost = mySeat === 0 && status === 'waiting'
  const choices = view?.choices ?? []
  const rewardPool = view
    ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation
    : 80

  /* 座位节点（2–8 座椭圆均布，按已入座席位渲染） */
  const seatNodes = (view?.seats ?? []).map((seat) => {
    const mine = seat.index === mySeat
    const echo = seat.kind === 'echo-bot' ? ECHOES.find((e) => e.name === seat.name) : undefined
    const seatStatus =
      status === 'playing' && phase === 'submit'
        ? seat.submitted
          ? 'submitted'
          : 'thinking'
        : 'idle'
    const isWinner = revealing && reveal?.winnerSeats.includes(seat.index) === true
    const kindTag = seat.kind === 'human' ? '旅人' : seat.kind === 'echo-bot' ? '影从' : '外来 Agent'
    const myChoice = revealing && reveal ? reveal.values[seat.index] : undefined
    return (
      <motion.div
        key={seat.index}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12 * seat.index, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn('relative', isWinner && 'rounded-full shadow-[0_0_28px_rgba(238,106,114,.55)]')}
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
          suit="heart"
          isSelf={mine}
        />
        {/* 揭晓时座位前翻出所选玺印 */}
        {revealing && myChoice != null && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: 0.1 + seat.index * 0.06, duration: 0.42, ease: [0.83, 0, 0.17, 1] }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-9 rounded-[6px] border px-2 py-0.5 font-mashan text-[14px] bg-ink/95',
              isWinner ? 'border-gold-300 text-gold-300' : 'border-[rgba(238,106,114,.35)] text-bone',
            )}
          >
            {choices[myChoice] ?? myChoice}
          </motion.div>
        )}
      </motion.div>
    )
  })

  /* ---------------- 错误态 ---------------- */
  if (stateQuery.error) {
    return (
      <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col items-center justify-center gap-5">
        <span className="vertical-rl font-mashan text-[26px] text-suit-heart/70">票庭无处寻</span>
        <p className="text-[13px] text-dim">{stateQuery.error.message}</p>
        <GoldButton variant="gold" onClick={() => navigate('/lobby')}>返回大厅</GoldButton>
      </div>
    )
  }

  const maxCount = reveal ? Math.max(...reveal.counts, 1) : 1

  return (
    <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col">
      {/* 背景：丹丘心理票庭 */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/bg-abacus-court.png")', filter: 'brightness(.45) hue-rotate(-24deg)' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(238,106,114,.10), transparent)' }} />

      <GameTopBar
        suit="heart"
        intro={GAME_INTROS.poll}
        room={`联机票庭 · ${view?.roomName ?? CODE} · ${CODE}`}
        phase={
          <span className="flex items-center gap-3">
            <span>
              {status === 'playing' ? `第 ${view?.round ?? 0} / ${view?.totalRounds ?? 0} 轮` : PHASE_TEXT[status]}
            </span>
            <span className="flex items-center gap-1">
              {Array.from({ length: view?.totalRounds ?? 0 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-500',
                    i < (view?.round ?? 0) - 1 && 'bg-suit-heart',
                    i === (view?.round ?? 0) - 1 && status === 'playing' && 'bg-gold-300 animate-breathe',
                    i >= (view?.round ?? 0) && 'bg-[rgba(227,194,124,.18)]',
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
        {/* 左栏：轮次史 + 规则 + 房码 */}
        <aside className="w-[280px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] overflow-y-auto">
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">轮次史</div>
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: view?.totalRounds ?? 0 }).map((_, i) => {
                const current = status === 'playing' && view?.round === i + 1
                const done = (view?.round ?? 0) > i + 1 || status === 'finished'
                return (
                  <div key={i} className={cn('flex items-center gap-2 text-[12px] py-1', done ? 'text-dim' : 'text-faint', current && 'border-l-2 border-gold-300 pl-2 -ml-2 text-bone')}>
                    <span className="font-cinzel w-6">R{i + 1}</span>
                    <span>{current ? (phase === 'reveal' ? '揭晓中…' : '投票中…') : done ? '已封盘' : '——'}</span>
                    {reveal && reveal.round === i + 1 && (
                      <span className="ml-auto font-mono text-[11px] text-gold-300/80">
                        {reveal.minorityChoice >= 0 ? `少数派·${choices[reveal.minorityChoice]}` : '流局'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="text-[11px] tracking-[.25em] text-faint mb-2">规则速览</div>
            <p className="text-[12px] text-dim leading-relaxed">
              全员同时秘选 {choices.map((c, i) => (
                <span key={i} className="font-mashan" style={{ color: SEAL_COLORS[i] }}>「{c}」</span>
              ))} 之一；揭晓后选中最少人选项（少数派）者得分，并列最少则流局。
              {view?.totalRounds ?? 0} 轮总分定胜负 · {submitWindowSec}s 投票窗，超时按座位轮转兜底。
              终局 {SUIT_META[view?.entryFee.suit ?? 'heart'].symbol} 碎片自动写入云端档案。
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

        {/* 中央票庭 */}
        <main className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            {view ? (
              <div className="relative w-full h-full">
                {/* 椭圆桌面 */}
                <div
                  className="absolute rounded-[50%] border border-[rgba(227,194,124,.14)]"
                  style={{
                    left: '6%',
                    right: '6%',
                    top: '8%',
                    bottom: '8%',
                    background: 'radial-gradient(60% 60% at 50% 50%, rgba(238,106,114,.10), transparent 75%), url("/texture-felt.png")',
                    backgroundSize: 'auto, 512px',
                    boxShadow: 'inset 0 0 80px rgba(7,6,11,.85), 0 24px 80px rgba(0,0,0,.55)',
                  }}
                />
                {/* 中央：投票玺印阵 / 揭晓分布柱状 */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  {revealing ? (
                    /* 揭晓分布柱状演出 */
                    <div className="flex items-end gap-4 rounded-2xl border border-[rgba(227,194,124,.15)] bg-[rgba(12,10,19,.72)] px-6 pb-3 pt-5 backdrop-blur-[8px]">
                      {reveal.counts.map((c, i) => {
                        const minority = reveal.minorityChoice === i
                        return (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <span className={cn('font-mono text-[13px]', minority ? 'text-gold-300' : 'text-dim')}>{c} 票</span>
                            <motion.div
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                              className="w-10 origin-bottom rounded-t-md"
                              style={{
                                height: `${28 + (c / maxCount) * 96}px`,
                                background: `linear-gradient(180deg, ${SEAL_COLORS[i]} 0%, ${SEAL_COLORS[i]}55 100%)`,
                                boxShadow: minority ? `0 0 20px ${SEAL_COLORS[i]}` : 'none',
                                border: minority ? '1px solid rgba(248,233,192,.7)' : '1px solid transparent',
                              }}
                            />
                            <span
                              className={cn(
                                'flex h-9 w-9 rotate-2 items-center justify-center rounded-[6px] font-mashan text-[17px] text-white',
                                minority && 'shadow-[0_0_16px_rgba(227,194,124,.5)]',
                              )}
                              style={{ background: SEAL_COLORS[i] }}
                            >
                              {choices[i] ?? i}
                            </span>
                            {minority && <span className="text-[10px] tracking-[.2em] text-gold-300">少数派</span>}
                          </div>
                        )
                      })}
                    </div>
                  ) : status === 'playing' && phase === 'submit' && mySeatView && !mySeatView.submitted ? (
                    /* 2–4 枚大玺印按钮 */
                    <div className="flex items-center gap-5">
                      {choices.map((c, i) => (
                        <motion.button
                          key={i}
                          type="button"
                          disabled={actMutation.isPending}
                          onClick={() => act({ type: 'choose', choice: i })}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                          whileHover={{ scale: 1.06, rotate: i % 2 === 0 ? -3 : 3 }}
                          whileTap={{ scale: 0.92 }}
                          className="flex h-24 w-24 items-center justify-center rounded-[12px] font-mashan text-[30px] text-white disabled:opacity-50"
                          style={{
                            background: `linear-gradient(160deg, ${SEAL_COLORS[i]} 0%, ${SEAL_COLORS[i]}99 100%)`,
                            boxShadow: `0 8px 28px rgba(0,0,0,.55), 0 0 24px ${SEAL_COLORS[i]}44, inset 0 1px 0 rgba(255,255,255,.3)`,
                          }}
                        >
                          {c}
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <span className="vertical-rl font-mashan text-[22px] text-[rgba(238,106,114,.55)]">
                      {status === 'waiting' ? '旅人落座 · 票庭将启' : mySeatView?.submitted ? '印已落 · 候揭晓' : '票庭寂寂'}
                    </span>
                  )}
                </div>
                {/* 座位（2–8 均布） */}
                {seatNodes.map((node, i) => (
                  <div
                    key={view.seats[i].index}
                    className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
                    style={seatPos(i, Math.max(view.seats.length, 2))}
                  >
                    {node}
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="vertical-rl font-mashan text-[26px] text-suit-heart/60">星网接驳中</span>
              </div>
            )}
          </div>

          {/* 上轮揭晓带 */}
          <div className="h-16 shrink-0 mx-4 mb-1 rounded-xl border border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.6)] flex items-center gap-3 px-4 overflow-x-auto">
            {reveal ? (
              <>
                <span className="font-cinzel text-suit-heart text-[14px] shrink-0">R{reveal.round}</span>
                {reveal.counts.map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      'font-mono text-[12px] px-1.5 py-0.5 rounded border shrink-0',
                      reveal.minorityChoice === i ? 'border-gold-300 text-gold-300' : 'border-[rgba(238,106,114,.25)] text-dim',
                    )}
                  >
                    {choices[i]}×{c}
                  </span>
                ))}
                <span className="font-mono text-[12px] text-faint shrink-0 ml-auto">
                  {reveal.minorityChoice >= 0 ? (
                    <>少数派 <span className="text-gold-300">「{choices[reveal.minorityChoice]}」</span> · {reveal.winnerSeats.length} 席得分</>
                  ) : (
                    '并列最少 · 本轮流局'
                  )}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-faint">首轮票决尚未揭晓</span>
            )}
          </div>

          {/* 底部控制台 */}
          <div className="shrink-0 border-t border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.78)] backdrop-blur-[12px] px-4 py-3">
            <div className="flex items-center gap-5 h-[72px] max-w-[1100px] mx-auto">
              {status === 'waiting' && (
                <>
                  {isHost ? (
                    <div className="flex items-center gap-4 mx-auto">
                      <GoldButton variant="gold" size="lg" disabled={actMutation.isPending} onClick={() => act({ type: 'start' })}>
                        <Play size={16} /> 开局 · 影从补席
                      </GoldButton>
                      <span className="text-[12px] text-dim">已入座 {view?.seats.length ?? 0} 席 · 空位由影从填充</span>
                    </div>
                  ) : mySeat != null ? (
                    <span className="mx-auto text-[13px] text-dim tracking-[.2em]">已入座 · 静候房主开局</span>
                  ) : isAuthenticated ? (
                    <div className="flex items-center gap-4 mx-auto">
                      <GoldButton
                        variant="suit"
                        suit="heart"
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

              {status === 'playing' && phase === 'submit' && mySeatView && (
                <div className="flex items-center gap-4 mx-auto">
                  <span className="text-[13px] text-dim tracking-[.2em]">
                    {mySeatView.submitted ? '已落印 · 静候揭晓' : '点中央玺印 · 投出你的一票'}
                  </span>
                  <TimerRing total={submitWindowSec} left={timeLeft} size={52} />
                </div>
              )}
              {status === 'playing' && phase === 'submit' && !mySeatView && (
                <span className="mx-auto text-[13px] text-dim tracking-[.2em]">旁观中 · 第 {view?.round ?? 0} 轮投票</span>
              )}
              {status === 'playing' && phase === 'reveal' && (
                <span className="mx-auto text-[13px] text-dim tracking-[.2em]">票型揭晓中…</span>
              )}

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
                <> · 本轮已落印 <span className="font-mono text-suit-heart">{view?.submittedCount ?? 0}</span>/{view?.seats.length ?? 0}</>
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
          suit={view.entryFee.suit}
          rewards={view.rewards}
          title="终局 · 票庭封盘"
          onClose={() => setFinishedOpen(false)}
          onExit={() => navigate('/lobby')}
        />
      )}
    </div>
  )
}

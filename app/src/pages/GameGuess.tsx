/**
 * ============================================================================
 * 猜平均数对局页 · /game/guess/:roomId（design game-guess.md）
 * ♣ 青玉算庭：六座椭圆石桌 + 中央浑天仪 + 数字提交控制台 + 5 轮积分结算。
 * 100dvh 应用壳（覆盖 AppShell 的 TopHUD），三栏：左信息 / 中央牌桌 / 右记录。
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Bot, ChevronDown, History, Trophy } from 'lucide-react'
import { ECHOES, getEcho } from '@/data/echoes'
import type { Echo } from '@/data/echoes'
import { useProfile } from '@/store/profile'
import type { Seat } from '@/engine/types'
import { Rng, hashSeed } from '@/engine/rng'
import { deriveAgentParams, levelKAnchor } from '@/engine/agents'
import { guessWhisper } from '@/engine/speech'
import {
  GuessEngine,
  GUESS_ROUNDS,
  GUESS_TICKET,
  GUESS_SUBMIT_TIMEOUT_SEC,
} from '@/engine/guessEngine'
import type { GuessState } from '@/engine/guessEngine'
import SeatRing from '@/components/SeatRing'
import TimerRing from '@/components/TimerRing'
import GoldButton from '@/components/GoldButton'
import EchoAvatar from '@/components/EchoAvatar'
import GameTopBar from '@/components/game/GameTopBar'
import SeatEllipse from '@/components/game/SeatEllipse'
import GameModal from '@/components/game/GameModal'
import LogStream from '@/components/game/LogStream'
import RewardFly from '@/components/game/RewardFly'
import TicketModal from '@/components/game/TicketModal'
import ArmillarySphere from '@/components/game/ArmillarySphere'
import GuessSettlement from '@/components/game/GuessSettlement'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const CLUB = '#4ECB9C'

/** 空状态（useSyncExternalStore 兜底） */
const EMPTY_STATE: GuessState = {
  phase: 'waiting', round: 0, seats: [], thinking: [], submitted: [], values: {},
  scores: {}, history: [], log: [], rankings: null, awaiting: null, retractUntil: null,
  phaseEndsAt: null, version: -1,
}

/** 抽取 5 位影从对手（避开契约影从，同桌彩蛋：如仍抽到则保留） */
function buildSeats(nickname: string, companionId: string | undefined, gameNo: number, roomId: string): Seat[] {
  const rng = new Rng(hashSeed(`${roomId}#${gameNo}#seats`))
  const pool = ECHOES.filter((e) => e.id !== companionId)
  const picked = rng.shuffle(pool).slice(0, 5)
  return [
    { seat: 0, kind: 'human', name: nickname },
    ...picked.map((e, i) => ({ seat: i + 1, kind: 'echo' as const, name: e.name, echoId: e.id })),
  ]
}

/** 每秒 tick（倒计时环用） */
function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function GameGuess() {
  const { roomId = 'UNKNOWN' } = useParams()
  const navigate = useNavigate()
  const session = useProfile((s) => s.session)
  const clubBalance = useProfile((s) => s.fragments.club)
  const companion = useProfile((s) => s.companion)
  const addFragments = useProfile((s) => s.addFragments)
  const recordResult = useProfile((s) => s.recordResult)
  const addWin = useProfile((s) => s.addWin)
  const touchEcho = useProfile((s) => s.touchEcho)

  const companionEcho: Echo = useMemo(
    () => getEcho(companion?.echoId ?? '') ?? ECHOES[0],
    [companion?.echoId],
  )
  const companionStyle = deriveAgentParams(companionEcho).style

  /* ---------------- 局次 / 门票 ---------------- */
  const [gameNo, setGameNo] = useState(0)
  const [ticket, setTicket] = useState<'pending' | 'ranked' | 'friendly'>('pending')
  const [ticketModal, setTicketModal] = useState(false)
  const [exitModal, setExitModal] = useState(false)

  useEffect(() => {
    setTicket('pending')
    if (useProfile.getState().spendFragments('club', GUESS_TICKET)) {
      setTicket('ranked')
    } else {
      setTicketModal(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameNo])

  const seats = useMemo(
    () => buildSeats(session?.nickname ?? '旅人', companion?.echoId, gameNo, roomId),
    [session?.nickname, companion?.echoId, gameNo, roomId],
  )

  /* ---------------- 引擎 ---------------- */
  const [delegated, setDelegated] = useState(false)
  const delegatedRef = useRef(delegated)
  delegatedRef.current = delegated
  const [engine, setEngine] = useState<GuessEngine | null>(null)

  useEffect(() => {
    if (ticket === 'pending') return
    const eng = new GuessEngine({
      seats,
      humanSeat: 0,
      seed: (hashSeed(roomId) ^ (Date.now() & 0xffffffff)) >>> 0,
      companion: companionEcho,
      isDelegated: () => delegatedRef.current,
    })
    setEngine(eng)
    void eng.start()
    return () => {
      eng.destroy()
      setEngine(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, gameNo])

  const subscribe = engine ? engine.subscribe : () => () => {}
  const getState = engine ? engine.getState : () => EMPTY_STATE
  const state = useSyncExternalStore(subscribe, getState)
  const now = useNow()

  /* ---------------- 控制台草稿 ---------------- */
  const [draft, setDraft] = useState(33)
  useEffect(() => {
    engine?.setHumanDraft(draft)
  }, [draft, engine])
  // 每轮开始重置草稿与已落子显示
  const [submittedDraft, setSubmittedDraft] = useState<number | null>(null)
  useEffect(() => {
    setDraft(33)
    setSubmittedDraft(null)
  }, [state.round])

  const humanSubmitted = state.submitted.includes(0)
  const awaitingNum = state.awaiting?.kind === 'guessNumber'
  const timeLeft = state.awaiting
    ? Math.max(0, state.awaiting.timeoutSec - (now - state.awaiting.startedAt) / 1000)
    : GUESS_SUBMIT_TIMEOUT_SEC
  const retractLeft = state.retractUntil ? Math.max(0, (state.retractUntil - now) / 1000) : 0

  /* ---------------- 影从低语 ---------------- */
  const whisper = useMemo(() => {
    const hist = state.history
    if (hist.length === 0) return `${companionEcho.name}：均值即人心。第一层从 33 开始想。`
    const last = hist[hist.length - 1]
    const leader = [...state.seats].sort((a, b) => (state.scores[b.seat] ?? 0) - (state.scores[a.seat] ?? 0))[0]
    const rng = new Rng(hashSeed(`whisper#${gameNo}#${hist.length}`))
    const line = guessWhisper(
      companionStyle,
      {
        round: state.round,
        target: last.target,
        average: last.average,
        myDelta: last.deltas[0],
        leaderName: leader?.name,
        meLeading: leader?.seat === 0,
      },
      rng,
    )
    return `${companionEcho.name}：${line}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.history.length, state.round])

  /* ---------------- 结算 ---------------- */
  const settledRef = useRef(-1)
  const [showFly, setShowFly] = useState(false)
  const rewards = useMemo(() => {
    const map: Record<number, number> = {}
    if (!state.rankings) return map
    state.rankings.forEach((seat, rank) => {
      map[seat] = GuessEngine.rewardFor(rank, ticket === 'ranked')
    })
    return map
  }, [state.rankings, ticket])

  useEffect(() => {
    if (state.phase !== 'finished' || !state.rankings || settledRef.current === gameNo) return
    settledRef.current = gameNo
    const myRank = state.rankings.indexOf(0)
    const won = myRank === 0
    if (ticket === 'ranked') {
      addFragments('club', GuessEngine.rewardFor(myRank, true))
      if (won) {
        const lit = addWin('club')
        if (lit) toast('生肖印记 · 点亮', { description: '青野大陆的生肖星图亮起一枚。' })
      }
    }
    recordResult('guess', won, won)
    for (const s of state.seats) {
      if (s.kind === 'echo' && s.echoId) {
        touchEcho(s.echoId, myRank < state.rankings.indexOf(s.seat) ? 'win' : 'lose')
      }
    }
    const t = setTimeout(() => setShowFly(true), 1800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.rankings, gameNo, ticket])

  const companionComment = useMemo(() => {
    if (state.phase !== 'finished') return ''
    const comments: Record<string, string> = {
      calc: '均值收敛得比我预演快 0.4 轮。',
      deep: '星盘早已写下这个名次，你只是按时抵达。',
      deceit: '下次试试报一个连你自己都不信的数。',
      intuition: '你的心跳在第三轮乱了一拍，不然能更高。',
      silent: '……不错。',
      warm: '辛苦了。输赢之外，你的呼吸一直很稳。',
      merchant: '这一局的收益，符合长期持有你的预期。',
      info: '对手的层级分布图，我已经替你记下了。',
    }
    return `${companionEcho.name}：${comments[companionStyle] ?? comments.calc}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  /* ---------------- 渲染 ---------------- */
  const latest = state.history.length > 0 ? state.history[state.history.length - 1] : null
  const countdownNum = state.phase === 'countdown' && state.phaseEndsAt ? Math.max(1, Math.ceil((state.phaseEndsAt - now) / 800)) : 0

  const seatNodes = state.seats.map((s) => {
    const echo = s.echoId ? getEcho(s.echoId) : undefined
    const status = !s.echoId && delegated && state.phase === 'submit' && !humanSubmitted
      ? 'thinking'
      : state.thinking.includes(s.seat)
        ? 'thinking'
        : state.submitted.includes(s.seat)
          ? 'submitted'
          : 'idle'
    const isWinner = state.phase === 'reveal' && latest?.winnerSeat === s.seat
    return (
      <motion.div
        key={s.seat}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 * s.seat, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn(isWinner && 'rounded-full', isWinner && 'shadow-[0_0_28px_rgba(78,203,156,.55)]')}
      >
        <SeatRing
          name={s.seat === 0 ? `你 · ${s.name}` : s.name}
          echo={echo}
          avatarUrl="/avatar-traveler.png"
          tag={s.seat === 0 ? '1 号位' : echo?.persona}
          status={status}
          active={isWinner}
          suit="club"
          isSelf={s.seat === 0}
        />
        {/* 揭示时座位前翻出数字 */}
        {state.phase === 'reveal' && state.values[s.seat] != null && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: 0.1 + latest!.entries.find((e) => e.seat === s.seat)!.order * 0.06, duration: 0.42, ease: [0.83, 0, 0.17, 1] }}
            className={cn(
              'absolute left-1/2 -translate-x-1/2 -top-9 rounded-md border bg-ink/95 px-2 py-0.5 font-mono text-[13px]',
              isWinner ? 'border-gold-300 text-gold-300' : 'border-[rgba(78,203,156,.35)] text-bone',
            )}
          >
            {state.values[s.seat].toFixed(1)}
          </motion.div>
        )}
      </motion.div>
  )})

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
        room={`青野演算场 · ${roomId}`}
        phase={
          <span className="flex items-center gap-3">
            <span>第 {Math.max(1, state.round)} / {GUESS_ROUNDS} 轮</span>
            {/* 轮次算珠 */}
            <span className="flex items-center gap-1">
              {Array.from({ length: GUESS_ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  className={cn('w-2 h-2 rounded-full transition-all duration-500', i < state.round - 1 && 'bg-suit-club', i === state.round - 1 && 'bg-gold-300 animate-breathe', i >= state.round && 'bg-[rgba(227,194,124,.18)]')}
                />
              ))}
            </span>
          </span>
        }
        pool={GUESS_TICKET * 6}
        onExit={() => setExitModal(true)}
      />

      {/* 三栏 */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {/* 左栏（<1100px 隐藏） */}
        <aside className="w-[280px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] overflow-y-auto">
          <GuessHistoryPanel state={state} />
        </aside>

        {/* 中央牌桌 */}
        <main className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            {state.seats.length === 6 && (
              <SeatEllipse seats={seatNodes} suit="club">
                <ArmillarySphere phase={state.phase} round={state.round} latest={latest} seats={state.seats} size={250} />
              </SeatEllipse>
            )}
            {/* 等待室 / 倒计时 */}
            {state.phase === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="vertical-rl font-mashan text-[30px] text-[rgba(78,203,156,.8)]">影从落座 · 算庭将启</span>
              </div>
            )}
            {state.phase === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.span
                  key={countdownNum}
                  className="font-cinzel font-bold text-[96px] text-suit-club"
                  style={{ textShadow: '0 0 40px rgba(78,203,156,.6)' }}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {countdownNum}
                </motion.span>
              </div>
            )}
          </div>

          {/* 上轮揭示带 */}
          <div className="h-16 shrink-0 mx-4 mb-1 rounded-xl border border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.6)] flex items-center gap-3 px-4 overflow-x-auto">
            {latest ? (
              <>
                <span className="font-cinzel text-suit-club text-[14px] shrink-0">R{latest.round}</span>
                {latest.entries.map((e) => (
                  <span
                    key={e.seat}
                    className={cn(
                      'font-mono text-[12px] px-1.5 py-0.5 rounded border shrink-0',
                      e.seat === latest.winnerSeat ? 'border-gold-300 text-gold-300' : 'border-[rgba(78,203,156,.25)] text-dim',
                    )}
                    title={state.seats.find((s) => s.seat === e.seat)?.name}
                  >
                    {e.value.toFixed(1)}
                  </span>
                ))}
                <span className="font-mono text-[12px] text-faint shrink-0 ml-auto">
                  均值 {latest.average.toFixed(2)} → 目标 <span className="text-gold-300">{latest.target.toFixed(2)}</span>
                </span>
              </>
            ) : (
              <span className="text-[12px] text-faint">首轮演算尚未揭示</span>
            )}
          </div>

          {/* 底部控制台 */}
          <div className="shrink-0 border-t border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.78)] backdrop-blur-[12px] px-4 py-3">
            <GuessConsole
              phase={state.phase}
              humanSubmitted={humanSubmitted}
              submittedDraft={submittedDraft}
              draft={draft}
              setDraft={setDraft}
              onSubmit={() => {
                engine?.submitHuman(draft)
                setSubmittedDraft(draft)
              }}
              onRetract={() => {
                engine?.retractHuman()
                setSubmittedDraft(null)
              }}
              retractLeft={retractLeft}
              awaiting={awaitingNum}
              timeLeft={timeLeft}
              delegated={delegated}
              setDelegated={setDelegated}
              companionName={companionEcho.name}
            />
          </div>
        </main>

        {/* 右栏（<1100px 隐藏） */}
        <aside className="w-[320px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-l border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] min-h-0">
          <GuessScorePanel state={state} />
          {/* 影从低语 */}
          <div className="panel-bg rounded-xl p-3 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <EchoAvatar echo={companionEcho} size={32} />
              <span className="text-[11px] tracking-[.25em] text-suit-club">影从低语</span>
            </div>
            <p className="text-[12px] leading-relaxed text-dim min-h-[36px]">{whisper}</p>
          </div>
          {/* 记录流 */}
          <div className="panel-bg rounded-xl p-3 flex-1 min-h-0 flex flex-col">
            <span className="text-[11px] tracking-[.25em] text-faint mb-2 shrink-0">记录流</span>
            <LogStream items={state.log} accent={CLUB} className="flex-1 min-h-0" />
          </div>
        </aside>
      </div>

      {/* <1100px 抽屉触发 */}
      <MiniDrawers state={state} />

      {/* 弹层 */}
      <TicketModal
        open={ticketModal}
        suit="club"
        cost={GUESS_TICKET}
        balance={clubBalance}
        gameName="青野演算场"
        onFriendly={() => {
          setTicketModal(false)
          setTicket('friendly')
        }}
        onExit={() => navigate('/lobby')}
      />
      <GameModal open={exitModal} title="中途离场" onClose={() => setExitModal(false)}>
        <p className="text-[14px] text-dim text-center mb-6 leading-relaxed">
          牌局尚未终了，此刻离场将损失门票{ticket === 'ranked' ? ` ${GUESS_TICKET} ♣` : ''}，且本局不计战绩。确定离场？
        </p>
        <div className="flex justify-center gap-4">
          <GoldButton variant="danger" onClick={() => navigate('/lobby')}>确认离场</GoldButton>
          <GoldButton variant="ghost" onClick={() => setExitModal(false)}>继续对局</GoldButton>
        </div>
      </GameModal>

      <GuessSettlement
        open={state.phase === 'finished'}
        state={state}
        humanSeat={0}
        ranked={ticket === 'ranked'}
        rewards={rewards}
        companionComment={companionComment}
        onRestart={() => {
          settledRef.current = -1
          setShowFly(false)
          setGameNo((n) => n + 1)
        }}
        onExit={() => navigate('/lobby')}
      />
      {ticket === 'ranked' && state.phase === 'finished' && (
        <RewardFly suit="club" show={showFly} pieces={10} onDone={() => setShowFly(false)} />
      )}
    </div>
  )
}

/* ============================================================================
 * 页面内子组件
 * ========================================================================== */

import type { GamePhase } from '@/engine/types'

/* ---------------- 左栏：轮次史 / 均值轨迹 / 规则速览 ---------------- */
function GuessHistoryPanel({ state }: { state: GuessState }) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const hist = state.history
  return (
    <>
      {/* 轮次史 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="text-[11px] tracking-[.25em] text-faint mb-2">轮次史</div>
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: GUESS_ROUNDS }).map((_, i) => {
            const r = hist[i]
            const current = state.round === i + 1 && state.phase !== 'finished'
            if (!r) {
              return (
                <div key={i} className={cn('flex items-center gap-2 text-[12px] text-faint py-1', current && 'border-l-2 border-gold-300 pl-2 -ml-2')}>
                  <span className="font-cinzel w-6">R{i + 1}</span>
                  <span>{current ? '演算中…' : '——'}</span>
                </div>
              )
            }
            const winner = state.seats.find((s) => s.seat === r.winnerSeat)
            const echo = winner?.echoId ? getEcho(winner.echoId) : undefined
            const myDelta = r.deltas[0]
            return (
              <div key={i} className="flex items-center gap-2 text-[12px] py-1">
                <span className="font-cinzel w-6 text-suit-club">R{i + 1}</span>
                <span className="font-mono text-dim">μ{r.average.toFixed(1)}</span>
                <span className="font-mono text-gold-300/80">→{r.target.toFixed(1)}</span>
                {winner && (
                  <span className="ml-auto flex items-center gap-1">
                    {echo ? <EchoAvatar echo={echo} size={32} className="!w-5 !h-5" /> : <img src="/avatar-traveler.png" alt="你" className="w-5 h-5 rounded-full" />}
                  </span>
                )}
                <span className={cn('font-mono', myDelta <= 5 ? 'text-suit-club' : 'text-cinnabar-hi')}>Δ{myDelta.toFixed(1)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 均值轨迹 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="text-[11px] tracking-[.25em] text-faint mb-2">均值轨迹</div>
        <GuessSparkline state={state} />
      </div>

      {/* 规则速览 */}
      <div className="panel-bg rounded-xl p-3">
        <button type="button" className="flex items-center justify-between w-full text-[11px] tracking-[.25em] text-faint" onClick={() => setRulesOpen((v) => !v)}>
          规则速览
          <ChevronDown size={14} className={cn('transition-transform', rulesOpen && 'rotate-180')} />
        </button>
        {rulesOpen && (
          <p className="text-[12px] text-dim leading-relaxed mt-2">
            0–100 出数 · 取均值 2/3 · 最近者 +2 分 · 次近 +1 分 · 5 轮总分定胜负 · 平局先提交者胜。
            门票 {GUESS_TICKET}♣ · 冠军 +50♣ / 亚军 +25♣ / 参与 +5♣。
          </p>
        )}
      </div>
    </>
  )
}

/** 迷你均值折线（纯 SVG） */
function GuessSparkline({ state }: { state: GuessState }) {
  const hist = state.history
  const W = 240
  const H = 72
  const pt = (v: number, i: number, n: number) => ({
    x: n <= 1 ? W / 2 : (i / (GUESS_ROUNDS - 1)) * (W - 20) + 10,
    y: H - 8 - (v / 100) * (H - 16),
  })
  const avgPts = hist.map((r, i) => pt(r.average, i, hist.length))
  const path = avgPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[72px]">
      {[0, 25, 50, 75, 100].map((v) => (
        <line key={v} x1="10" x2={W - 10} y1={H - 8 - (v / 100) * (H - 16)} y2={H - 8 - (v / 100) * (H - 16)} stroke="rgba(227,194,124,.08)" strokeWidth="0.5" />
      ))}
      {hist.length > 0 && <path d={path} fill="none" stroke="#4ECB9C" strokeWidth="1.6" strokeLinecap="round" />}
      {hist.map((r, i) => {
        const p = pt(r.target, i, hist.length)
        return <circle key={i} cx={p.x} cy={p.y} r="2.4" fill="#E3C27C" />
      })}
    </svg>
  )
}

/* ---------------- 右栏：积分榜 ---------------- */
function GuessScorePanel({ state }: { state: GuessState }) {
  const sorted = [...state.seats].sort((a, b) => (state.scores[b.seat] ?? 0) - (state.scores[a.seat] ?? 0))
  return (
    <div className="panel-bg rounded-xl p-3 shrink-0">
      <div className="text-[11px] tracking-[.25em] text-faint mb-2">积分榜</div>
      <div className="flex flex-col gap-1">
        {sorted.map((s, rank) => {
          const echo = s.echoId ? getEcho(s.echoId) : undefined
          return (
            <motion.div
              key={s.seat}
              layout="position"
              className={cn('flex items-center gap-2 py-1 px-1.5 rounded-lg', s.seat === 0 && 'bg-[rgba(227,194,124,.08)] border border-[rgba(227,194,124,.15)]')}
            >
              <span className="font-cinzel text-[13px] w-4 text-dim">{rank + 1}</span>
              {echo ? <EchoAvatar echo={echo} size={32} /> : <img src="/avatar-traveler.png" alt="你" className="w-8 h-8 rounded-full border border-gold-300/40" />}
              <span className={cn('text-[13px] flex-1 truncate', s.seat === 0 ? 'text-gold-300' : 'text-bone')}>{s.name}</span>
              {/* 各轮小分 */}
              <span className="flex gap-0.5">
                {Array.from({ length: GUESS_ROUNDS }).map((_, i) => {
                  const r = state.history[i]
                  const p = r?.points[s.seat] ?? 0
                  return (
                    <span
                      key={i}
                      className={cn('w-2.5 h-2.5 rounded-[2px]', p === 2 && 'bg-gold-300', p === 1 && 'bg-suit-club/70', p === 0 && 'bg-[rgba(227,194,124,.14)]')}
                    />
                  )
                })}
              </span>
              <span className="font-mono text-[15px] text-bone w-6 text-right">{state.scores[s.seat] ?? 0}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- 底部控制台 ---------------- */
interface GuessConsoleProps {
  phase: GamePhase
  humanSubmitted: boolean
  submittedDraft: number | null
  draft: number
  setDraft: (v: number) => void
  onSubmit: () => void
  onRetract: () => void
  retractLeft: number
  awaiting: boolean
  timeLeft: number
  delegated: boolean
  setDelegated: (v: boolean) => void
  companionName: string
}

const LEVELS = [0, 1, 2, 3, 4]

function GuessConsole(p: GuessConsoleProps) {
  const inputEnabled = p.phase === 'submit' && !p.humanSubmitted && !p.delegated
  const nearLevel = LEVELS.reduce((best, l) => (Math.abs(levelKAnchor(l) - p.draft) < Math.abs(levelKAnchor(best) - p.draft) ? l : best), 0)

  return (
    <div className="flex items-center gap-5 h-[72px] max-w-[1100px] mx-auto">
      {/* 数字输入组 */}
      <div className="flex flex-col gap-1.5 w-[300px]">
        <div className="flex items-end gap-3">
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={Number.isFinite(p.draft) ? p.draft : 0}
            disabled={!inputEnabled}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) p.setDraft(Math.max(0, Math.min(100, v)))
            }}
            className="w-[110px] bg-transparent border-b border-[rgba(227,194,124,.3)] font-cinzel font-bold text-[34px] text-bone outline-none focus:border-suit-club disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[11px] text-faint mb-2">0 – 100 · 可取一位小数</span>
        </div>
        <Slider
          value={[p.draft]}
          min={0}
          max={100}
          step={1}
          disabled={!inputEnabled}
          onValueChange={(v) => p.setDraft(v[0])}
          className="w-full [&_[data-slot=slider-track]]:bg-[rgba(78,203,156,.15)] [&_[data-slot=slider-range]]:bg-suit-club [&_[data-slot=slider-thumb]]:border-suit-club [&_[data-slot=slider-thumb]]:bg-ink"
        />
      </div>

      {/* 思考层级指示（彩蛋） */}
      <div className="hidden md:flex items-center gap-1.5">
        {LEVELS.map((l) => (
          <div
            key={l}
            title={`第 ${l} 层思维 ≈ ${levelKAnchor(l).toFixed(0)}`}
            className={cn(
              'w-6 h-6 rounded-[4px] border flex items-center justify-center text-[9px] font-mono transition-all duration-300',
              l === nearLevel ? 'border-suit-club text-suit-club shadow-[0_0_10px_rgba(78,203,156,.4)]' : 'border-[rgba(227,194,124,.15)] text-faint',
            )}
          >
            L{l}
          </div>
        ))}
      </div>

      <div className="flex-1" />

      {/* 提交区 */}
      {p.phase === 'submit' && !p.humanSubmitted && !p.delegated && (
        <>
          <GoldButton variant="suit" suit="club" size="lg" onClick={p.onSubmit} disabled={!p.awaiting}>
            落子无悔
          </GoldButton>
          <TimerRing total={GUESS_SUBMIT_TIMEOUT_SEC} left={p.timeLeft} size={52} />
        </>
      )}
      {p.phase === 'submit' && !p.humanSubmitted && p.delegated && (
        <div className="flex items-center gap-2 text-suit-club text-[13px]">
          <Bot size={16} className="animate-breathe" />
          {p.companionName}思量中…
        </div>
      )}
      {p.phase === 'submit' && p.humanSubmitted && (
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-faint tracking-[.2em]">已落子</span>
            <span className="font-cinzel font-bold text-[24px] text-suit-club">{(p.submittedDraft ?? 0).toFixed(1)}</span>
          </div>
          {p.retractLeft > 0 && (
            <GoldButton variant="danger" size="sm" onClick={p.onRetract}>
              反悔（{Math.ceil(p.retractLeft)}s）
            </GoldButton>
          )}
          <TimerRing total={GUESS_SUBMIT_TIMEOUT_SEC} left={p.timeLeft} size={52} />
        </div>
      )}
      {p.phase === 'reveal' && <span className="text-[13px] text-dim tracking-[.2em]">浑天仪揭示中…</span>}
      {(p.phase === 'waiting' || p.phase === 'countdown') && <span className="text-[13px] text-dim tracking-[.2em]">算庭将启…</span>}
      {p.phase === 'finished' && <span className="text-[13px] text-gold-300 tracking-[.2em]">本局终 · 查看结算</span>}

      {/* 委托影从 */}
      <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
        <Switch checked={p.delegated} onCheckedChange={p.setDelegated} disabled={p.phase !== 'submit' && p.phase !== 'reveal'} />
        <span className="text-[12px] text-dim">委托影从</span>
      </label>
    </div>
  )
}

/* ---------------- <1100px 抽屉 ---------------- */
function MiniDrawers({ state }: { state: GuessState }) {
  const [open, setOpen] = useState<'left' | 'right' | null>(null)
  return (
    <div className="min-[1100px]:hidden">
      <div className="fixed left-3 top-20 z-40 flex flex-col gap-2">
        <button type="button" onClick={() => setOpen(open === 'left' ? null : 'left')} className="w-10 h-10 rounded-full bg-ink/85 border border-[rgba(227,194,124,.25)] flex items-center justify-center text-gold-300">
          <History size={17} />
        </button>
        <button type="button" onClick={() => setOpen(open === 'right' ? null : 'right')} className="w-10 h-10 rounded-full bg-ink/85 border border-[rgba(227,194,124,.25)] flex items-center justify-center text-gold-300">
          <Trophy size={17} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(null)}>
          <div
            className="absolute left-0 top-14 bottom-0 w-[300px] bg-ink/95 border-r border-[rgba(227,194,124,.18)] p-4 overflow-y-auto flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {open === 'left' ? <GuessHistoryPanel state={state} /> : (
              <>
                <GuessScorePanel state={state} />
                <div className="panel-bg rounded-xl p-3 flex-1 min-h-[200px] flex flex-col">
                  <span className="text-[11px] tracking-[.25em] text-faint mb-2">记录流</span>
                  <LogStream items={state.log} accent={CLUB} className="flex-1" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

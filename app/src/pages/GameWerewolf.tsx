/**
 * ============================================================================
 * 月影狼人杀对局页 · /game/werewolf/:roomId（design game-werewolf.md）
 * ♠ 玄渊圆桌：全页昼夜色温切换、身份翻牌演出、夜晚角色行动、白天发言投票、
 * 开票与遗言、终局阵营结算。
 * 100dvh 应用壳（覆盖 AppShell 的 TopHUD），三栏：左身份 / 中央圆桌 / 右记录。
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Moon, Sun, MessageSquare, ListOrdered, Send } from 'lucide-react'
import { ECHOES, getEcho } from '@/data/echoes'
import type { Echo } from '@/data/echoes'
import { useProfile } from '@/store/profile'
import type { Seat } from '@/engine/types'
import { Rng, hashSeed } from '@/engine/rng'
import { deriveAgentParams } from '@/engine/agents'
import { wolfWhisper } from '@/engine/speech'
import type { SpeechIntent } from '@/engine/speech'
import {
  WerewolfEngine,
  WOLF_TICKET,
  WOLF_REWARDS,
  ROLE_META,
} from '@/engine/werewolfEngine'
import type { Role, WolfState } from '@/engine/werewolfEngine'
import SeatRing from '@/components/SeatRing'
import TimerRing from '@/components/TimerRing'
import GoldButton from '@/components/GoldButton'
import EchoAvatar from '@/components/EchoAvatar'
import SpeechBubble from '@/components/SpeechBubble'
import PlayingCard from '@/components/PlayingCard'
import GameTopBar from '@/components/game/GameTopBar'
import { GAME_INTROS } from '@/data/gameIntros'
import SeatEllipse from '@/components/game/SeatEllipse'
import GameModal from '@/components/game/GameModal'
import RewardFly from '@/components/game/RewardFly'
import TicketModal from '@/components/game/TicketModal'
import PhaseBanner from '@/components/game/PhaseBanner'
import WerewolfSettlement from '@/components/game/WerewolfSettlement'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const MOONLIGHT = '#B9C8FF'
const DAWN_GOLD = '#F1D9A2'

const EMPTY_STATE: WolfState = {
  phase: 'deal', day: 1, seats: [], killTarget: null, wolfSuggestion: null,
  humanSeerRecords: [], witch: { saveUsed: false, poisonUsed: false },
  pendingVictim: null, lastNightDeaths: [], dawnText: '', speeches: [],
  currentSpeaker: null, speakerQueue: [], votes: {}, voteResult: null,
  lastWordsSeat: null, seerClaimants: [], winner: null, mvpSeat: null,
  mvpNote: '', keyActions: {}, awaiting: null, topSuspect: null, phaseEndsAt: null, version: -1,
}

function buildSeats(nickname: string, companionId: string | undefined, gameNo: number, roomId: string): Seat[] {
  const rng = new Rng(hashSeed(`wolf#${roomId}#${gameNo}#seats`))
  const pool = ECHOES.filter((e) => e.id !== companionId)
  const picked = rng.shuffle(pool).slice(0, 5)
  return [
    { seat: 0, kind: 'human', name: nickname },
    ...picked.map((e, i) => ({ seat: i + 1, kind: 'echo' as const, name: e.name, echoId: e.id })),
  ]
}

function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  return now
}

/** 狼爪印（朱砂） */
function PawMark({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="#F0655A" style={{ filter: 'drop-shadow(0 0 4px rgba(240,101,90,.7))' }}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="4" cy="13" r="2.4" />
      <circle cx="20" cy="13" r="2.4" />
      <path d="M12 11c-3.4 0-6 2.8-6 5.4 0 1.8 1.4 3 3.2 3 1.1 0 1.9-.5 2.8-.5s1.7.5 2.8.5c1.8 0 3.2-1.2 3.2-3C18 13.8 15.4 11 12 11Z" />
    </svg>
  )
}

export default function GameWerewolf() {
  const { roomId = 'UNKNOWN' } = useParams()
  const navigate = useNavigate()
  const session = useProfile((s) => s.session)
  const spadeBalance = useProfile((s) => s.fragments.spade)
  const companion = useProfile((s) => s.companion)
  const addFragments = useProfile((s) => s.addFragments)
  const recordResult = useProfile((s) => s.recordResult)
  const addWin = useProfile((s) => s.addWin)
  const touchEcho = useProfile((s) => s.touchEcho)

  const companionEcho: Echo = useMemo(() => getEcho(companion?.echoId ?? '') ?? ECHOES[0], [companion?.echoId])
  const companionStyle = deriveAgentParams(companionEcho).style

  /* ---------------- 局次 / 门票 ---------------- */
  const [gameNo, setGameNo] = useState(0)
  const [ticket, setTicket] = useState<'pending' | 'ranked' | 'friendly'>('pending')
  const [ticketModal, setTicketModal] = useState(false)
  const [exitModal, setExitModal] = useState(false)

  useEffect(() => {
    setTicket('pending')
    if (useProfile.getState().spendFragments('spade', WOLF_TICKET)) {
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
  const [engine, setEngine] = useState<WerewolfEngine | null>(null)

  useEffect(() => {
    if (ticket === 'pending') return
    const eng = new WerewolfEngine({
      seats,
      humanSeat: 0,
      seed: (hashSeed(`wolf#${roomId}`) ^ (Date.now() & 0xffffffff)) >>> 0,
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

  /* ---------------- 阶段横幅 ---------------- */
  const [banner, setBanner] = useState<{ text: string; tone: 'gold' | 'moon' | 'cinnabar' } | null>(null)
  const lastBannerPhase = useRef<string>('')
  useEffect(() => {
    const key = `${state.phase}#${state.day}`
    if (lastBannerPhase.current === key) return
    lastBannerPhase.current = key
    const map: Partial<Record<string, { text: string; tone: 'gold' | 'moon' | 'cinnabar' }>> = {
      nightWolf: { text: '夜 · 狼人睁眼', tone: 'moon' },
      nightSeer: { text: '预言家 · 请验人', tone: 'moon' },
      nightWitch: { text: '女巫 · 今夜是TA', tone: 'moon' },
      dawn: { text: '清晨 · 昨夜死讯', tone: 'gold' },
      daySpeech: { text: '白日 · 自由发言', tone: 'gold' },
      dayVote: { text: '放逐 · 投票', tone: 'cinnabar' },
      lastWords: { text: '遗言', tone: 'cinnabar' },
    }
    const b = map[state.phase]
    if (b) setBanner(b)
  }, [state.phase, state.day])

  /* ---------------- 真人信息 ---------------- */
  const human = state.seats[0]
  const humanRole: Role | null = human?.role ?? null
  const humanAlive = human?.alive ?? true
  const humanIsWolf = humanRole === 'werewolf'
  const isNight = state.phase === 'nightWolf' || state.phase === 'nightSeer' || state.phase === 'nightWitch' || state.phase === 'deal'
  const awaiting = state.awaiting
  const timeLeft = awaiting ? Math.max(0, awaiting.timeoutSec - (now - awaiting.startedAt) / 1000) : 0

  /* ---------------- 目标点选 ---------------- */
  const [pickTarget, setPickTarget] = useState<number | null>(null)
  useEffect(() => {
    setPickTarget(null)
  }, [state.phase, state.day])

  const clickableSeat = (seat: number): boolean => {
    if (!engine || !humanAlive) return false
    if (seat === 0) return false
    const s = state.seats[seat]
    if (!s?.alive) return false
    if (awaiting?.kind === 'wolfKill') return humanIsWolf && state.seats[seat].role !== 'werewolf'
    if (awaiting?.kind === 'seerCheck') return humanRole === 'seer'
    if (awaiting?.kind === 'witchAction') return humanRole === 'witch' && !state.witch.poisonUsed
    if (awaiting?.kind === 'vote') return true
    return false
  }

  const onSeatClick = (seat: number) => {
    if (!clickableSeat(seat)) return
    if (awaiting?.kind === 'seerCheck') {
      engine?.submitSeerCheck(seat)
      return
    }
    setPickTarget(seat)
  }

  /* ---------------- 影从低语 ---------------- */
  const whisper = useMemo(() => {
    const suspectSeat = state.topSuspect
    const suspect = suspectSeat != null ? state.seats[suspectSeat] : null
    const claimer = state.seerClaimants.length > 0 ? state.seats[state.seerClaimants[0]] : null
    const rng = new Rng(hashSeed(`ww#${gameNo}#${state.day}#${state.speeches.length}`))
    const line = wolfWhisper(
      companionStyle,
      {
        suspect: suspect ? `${WerewolfEngine.displaySeat(suspect.seat)} 号${suspect.name}` : undefined,
        claimer: claimer?.name,
      },
      rng,
    )
    return `${companionEcho.name}：${line}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.topSuspect, state.day, state.speeches.length, gameNo])

  /* ---------------- 结算 ---------------- */
  const settledRef = useRef(-1)
  const [showFly, setShowFly] = useState(false)
  const humanWon = state.winner != null && (humanIsWolf ? 'wolf' : 'good') === state.winner
  const humanMvp = state.mvpSeat === 0
  const reward = {
    base: ticket === 'ranked' ? (humanWon ? WOLF_REWARDS.win : WOLF_REWARDS.lose) : 0,
    mvp: ticket === 'ranked' && humanMvp && humanWon ? WOLF_REWARDS.mvp : 0,
  }

  useEffect(() => {
    if (state.phase !== 'finished' || !state.winner || settledRef.current === gameNo) return
    settledRef.current = gameNo
    const won = (humanIsWolf ? 'wolf' : 'good') === state.winner
    const mvp = state.mvpSeat === 0
    if (ticket === 'ranked') {
      addFragments('spade', (won ? WOLF_REWARDS.win : WOLF_REWARDS.lose) + (mvp && won ? WOLF_REWARDS.mvp : 0))
      if (won) {
        const lit = addWin('spade')
        if (lit) toast('生肖印记 · 点亮', { description: '玄渊大陆的生肖星图亮起一枚。' })
      }
    }
    recordResult('werewolf', won, mvp && won)
    for (const s of state.seats) {
      if (s.kind === 'echo' && s.echoId) touchEcho(s.echoId, won ? 'win' : 'lose')
    }
    const t = setTimeout(() => setShowFly(true), 2200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.winner, gameNo, ticket])

  /* ---------------- 座位渲染 ---------------- */
  const lastSpeech = useMemo(() => {
    const speeches = state.speeches.filter((sp) => sp.kind === 'speech')
    return speeches.length > 0 ? speeches[speeches.length - 1] : null
  }, [state.speeches])

  const seatNodes = state.seats.map((s) => {
    const echo = s.echoId ? getEcho(s.echoId) : undefined
    const isWolfMate = humanIsWolf && s.role === 'werewolf' && s.seat !== 0
    const clickable = clickableSeat(s.seat)
    const picked = pickTarget === s.seat
    const tallyCount = state.phase === 'voteReveal' && state.voteResult ? (state.voteResult.tally[s.seat] ?? 0) : 0
    return (
      <motion.div
        key={s.seat}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12 * s.seat, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn('relative', clickable && 'cursor-crosshair')}
      >
        {/* 号位徽章 */}
        <span className="absolute -top-2 -left-2 z-20 w-6 h-6 rounded-full bg-ink border border-[rgba(227,194,124,.35)] flex items-center justify-center font-cinzel text-[11px] text-gold-300">
          {s.seat + 1}
        </span>
        {/* 狼爪印（仅真人狼可见队友） */}
        {isWolfMate && (
          <span className="absolute -bottom-1 -right-1 z-20">
            <PawMark />
          </span>
        )}
        {/* 票签 */}
        {tallyCount > 0 && (
          <motion.div
            className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 flex"
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
          >
            {Array.from({ length: tallyCount }).map((_, i) => (
              <span key={i} className="w-4 h-5 rounded-[3px] bg-cinnabar text-[10px] text-bone font-cinzel flex items-center justify-center border border-cinnabar-hi shadow-[0_0_8px_rgba(240,101,90,.5)] -ml-1 first:ml-0">
                {s.seat + 1}
              </span>
            ))}
          </motion.div>
        )}
        {/* 点选光圈 */}
        {picked && <span className="absolute -inset-2 rounded-full border-2 border-cinnabar-hi shadow-[0_0_18px_rgba(240,101,90,.6)] animate-breathe pointer-events-none" />}
        {clickable && !picked && <span className="absolute -inset-2 rounded-full border border-cinnabar/40 pointer-events-none" />}
        <div onClick={() => onSeatClick(s.seat)}>
          <SeatRing
            name={s.seat === 0 ? `你 · ${s.name}` : s.name}
            echo={echo}
            avatarUrl="/avatar-traveler.png"
            tag={s.seat === 0 ? '1 号位' : echo?.persona}
            status={s.alive ? 'idle' : 'dead'}
            active={state.currentSpeaker === s.seat || state.lastWordsSeat === s.seat}
            suit="spade"
            isSelf={s.seat === 0}
          />
        </div>
        {/* 死亡小幽灵 */}
        {!s.alive && (
          <span className="absolute -top-3 right-0 text-[13px] animate-float-y" style={{ animationDuration: '3s' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="rgba(242,234,216,.5)">
              <path d="M12 3c-4 0-7 3-7 7v9l2.4-2 2.3 2 2.3-2 2.3 2 2.3-2 2.3 2v-9c0-4-3-7-7-7Z" />
              <circle cx="9.5" cy="10" r="1.2" fill="#07060B" />
              <circle cx="14.5" cy="10" r="1.2" fill="#07060B" />
            </svg>
          </span>
        )}
      </motion.div>
    )
  })

  /* ---------------- 主渲染 ---------------- */
  return (
    <div className="relative z-[55] -mt-16 h-[100dvh] overflow-hidden bg-abyss flex flex-col">
      {/* 背景：月影村庄 */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("/bg-village-night.png")', filter: 'brightness(.6)' }} />
      {/* 昼夜色温蒙版（1200ms crossfade，design.md §2.6） */}
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms]"
        style={{
          opacity: isNight ? 1 : 0,
          background: 'linear-gradient(180deg, rgba(20,16,48,.55), rgba(7,6,11,.75))',
        }}
      />
      <div
        className="absolute inset-0 transition-opacity duration-[1200ms]"
        style={{
          opacity: isNight ? 0 : 1,
          background: 'linear-gradient(180deg, rgba(216,170,80,.12), rgba(7,6,11,.45))',
        }}
      />
      {/* 夜雾（仅夜晚，3 团漂移雾） */}
      {isNight && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full animate-float-y"
              style={{
                width: 420 + i * 120,
                height: 220,
                left: `${8 + i * 30}%`,
                top: `${30 + i * 16}%`,
                background: 'radial-gradient(50% 50% at 50% 50%, rgba(185,200,255,.08), transparent)',
                filter: 'blur(40px)',
                animationDuration: `${34 + i * 6}s`,
              }}
            />
          ))}
        </div>
      )}
      {/* 天象：日/月沿弧线升落 */}
      <motion.div
        className="absolute right-8 z-10 pointer-events-none"
        animate={{ top: isNight ? 64 : '72%', opacity: isNight ? 1 : 0.25, x: isNight ? 0 : 60 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {isNight ? <Moon size={30} color={MOONLIGHT} style={{ filter: 'drop-shadow(0 0 12px rgba(185,200,255,.6))' }} /> : <Sun size={30} color={DAWN_GOLD} />}
      </motion.div>

      <GameTopBar
        suit="spade"
        intro={GAME_INTROS.werewolf}
        room={`月影村 · ${roomId}`}
        phase={
          <span>
            第 {state.day} 天 · {PHASE_LABEL[state.phase] ?? ''}
          </span>
        }
        pool={WOLF_TICKET * 6}
        onExit={() => setExitModal(true)}
        extra={
          <label className="hidden sm:flex items-center gap-2 cursor-pointer select-none mr-2" title="委托契约影从全程代打（于下一环节生效）">
            <Switch checked={delegated} onCheckedChange={setDelegated} />
            <span className="text-[12px] text-dim">委托影从</span>
          </label>
        }
      />

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* 左栏 */}
        <aside className="w-[264px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] overflow-y-auto">
          <WolfLeftPanel state={state} />
        </aside>

        {/* 中央圆桌 */}
        <main className="flex-1 relative min-w-0 flex flex-col">
          <div className="flex-1 relative min-h-0">
            {state.seats.length === 6 && (
              <SeatEllipse seats={seatNodes} suit="spade">
                <WolfStage state={state} isNight={isNight} lastSpeechText={state.phase === 'daySpeech' || state.phase === 'lastWords' ? lastSpeech?.text ?? null : null} lastSpeechSeat={lastSpeech?.seat ?? null} />
              </SeatEllipse>
            )}
            {/* 预言家验人印章 */}
            {humanRole === 'seer' && state.humanSeerRecords.length > 0 && state.humanSeerRecords[state.humanSeerRecords.length - 1].day === state.day && (state.phase === 'nightSeer' || state.phase === 'nightWitch') && (
              <SeerStamp record={state.humanSeerRecords[state.humanSeerRecords.length - 1]} />
            )}
          </div>

          {/* 底部操作带 */}
          <div className="shrink-0 min-h-[112px] border-t border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.78)] backdrop-blur-[12px] px-4 py-3">
            <WolfActionBand
              state={state}
              engine={engine}
              humanRole={humanRole}
              humanAlive={humanAlive}
              awaiting={awaiting ?? null}
              timeLeft={timeLeft}
              pickTarget={pickTarget}
              setPickTarget={setPickTarget}
              companionEcho={companionEcho}
              delegated={delegated}
            />
          </div>
        </main>

        {/* 右栏 */}
        <aside className="w-[336px] shrink-0 hidden min-[1100px]:flex flex-col gap-4 p-4 border-l border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] min-h-0">
          <WolfSpeechLog state={state} className="flex-1 min-h-0" />
          {/* 影从低语 */}
          <div className="panel-bg rounded-xl p-3 shrink-0" style={{ borderColor: 'rgba(139,147,248,.3)' }}>
            <div className="flex items-center gap-2 mb-2">
              <EchoAvatar echo={companionEcho} size={32} />
              <span className="text-[11px] tracking-[.25em] text-suit-spade">影从低语</span>
            </div>
            <p className="text-[12px] leading-relaxed text-dim min-h-[36px]">{whisper}</p>
          </div>
        </aside>
      </div>

      {/* <1100px 抽屉 */}
      <WolfMiniDrawers state={state} whisper={whisper} companionEcho={companionEcho} />

      {/* 阶段横幅 */}
      <PhaseBanner text={banner?.text ?? null} tone={banner?.tone ?? 'gold'} />

      {/* 身份发放翻牌演出 */}
      {state.phase === 'deal' && humanRole && <DealShow role={humanRole} phaseEndsAt={state.phaseEndsAt} />}

      {/* 弹层 */}
      <TicketModal
        open={ticketModal}
        suit="spade"
        cost={WOLF_TICKET}
        balance={spadeBalance}
        gameName="月影狼人杀"
        onFriendly={() => {
          setTicketModal(false)
          setTicket('friendly')
        }}
        onExit={() => navigate('/lobby')}
      />
      <GameModal open={exitModal} title="中途离场" onClose={() => setExitModal(false)}>
        <p className="text-[14px] text-dim text-center mb-6 leading-relaxed">
          长夜未明，此刻离场将损失门票{ticket === 'ranked' ? ` ${WOLF_TICKET} ♠` : ''}，且本局不计战绩。确定离场？
        </p>
        <div className="flex justify-center gap-4">
          <GoldButton variant="danger" onClick={() => navigate('/lobby')}>确认离场</GoldButton>
          <GoldButton variant="ghost" onClick={() => setExitModal(false)}>继续对局</GoldButton>
        </div>
      </GameModal>

      <WerewolfSettlement
        open={state.phase === 'finished'}
        state={state}
        humanSeat={0}
        ranked={ticket === 'ranked'}
        reward={reward}
        onRestart={() => {
          settledRef.current = -1
          setShowFly(false)
          setGameNo((n) => n + 1)
        }}
        onExit={() => navigate('/lobby')}
      />
      {ticket === 'ranked' && state.phase === 'finished' && (
        <RewardFly suit="spade" show={showFly} pieces={10} onDone={() => setShowFly(false)} />
      )}
    </div>
  )
}

const PHASE_LABEL: Record<string, string> = {
  deal: '身份发放',
  nightWolf: '夜 · 狼人行动',
  nightSeer: '夜 · 预言家',
  nightWitch: '夜 · 女巫',
  dawn: '清晨',
  daySpeech: '白天发言',
  dayVote: '放逐投票',
  voteReveal: '开票',
  lastWords: '遗言',
  finished: '终局',
}

/* ============================================================================
 * 页面内子组件
 * ========================================================================== */

/* ---------------- 左栏：身份卡 / 角色池 / 存活名单 ---------------- */
function WolfLeftPanel({ state }: { state: WolfState }) {
  const me = state.seats[0]
  const role = me?.role ?? 'villager'
  const meta = ROLE_META[role]
  const campColor = meta.camp === 'wolf' ? '#F0655A' : '#4ECB9C'
  const pool: Role[] = ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager']
  return (
    <>
      {/* 我的身份卡 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="text-[11px] tracking-[.25em] text-faint mb-2">我的身份</div>
        <div className="flex items-center gap-3">
          <div className="card-frame rounded-lg overflow-hidden w-[72px] h-[108px] shrink-0">
            <img src={meta.image} alt={meta.name} className="w-full h-full object-cover object-top" draggable={false} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-serifsc font-black text-[18px] text-bone">{meta.name}</span>
            <span
              className="text-[10px] tracking-[.2em] px-2 py-0.5 rounded-full border w-fit"
              style={{ color: campColor, borderColor: `${campColor}66`, background: `${campColor}14` }}
            >
              {meta.camp === 'wolf' ? '狼人阵营' : '好人阵营'}
            </span>
            <span className="text-[11px] text-faint leading-snug">{meta.motto}</span>
          </div>
        </div>
        {/* 技能状态 */}
        {role === 'witch' && (
          <div className="flex gap-3 mt-3">
            <span className={cn('text-[11px] px-2 py-1 rounded border', state.witch.saveUsed ? 'text-faint border-[rgba(227,194,124,.15)] line-through' : 'text-suit-club border-suit-club/40')}>
              解药 {state.witch.saveUsed ? '已用' : '在手'}
            </span>
            <span className={cn('text-[11px] px-2 py-1 rounded border', state.witch.poisonUsed ? 'text-faint border-[rgba(227,194,124,.15)] line-through' : 'text-cinnabar-hi border-cinnabar/40')}>
              毒药 {state.witch.poisonUsed ? '已用' : '在手'}
            </span>
          </div>
        )}
        {role === 'seer' && state.humanSeerRecords.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-[10px] tracking-[.2em] text-faint">我的查验</span>
            {state.humanSeerRecords.map((r) => (
              <span key={r.day} className="text-[12px] text-dim">
                第 {r.day} 夜 · {WerewolfEngine.displaySeat(r.target)} 号 →{' '}
                <span style={{ color: r.isWolf ? '#F0655A' : '#4ECB9C' }}>{r.isWolf ? '狼人' : '好人'}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 角色池 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="text-[11px] tracking-[.25em] text-faint mb-2">角色池</div>
        <div className="grid grid-cols-6 gap-1.5">
          {pool.map((r, i) => {
            // 已被放逐者公开身份 → 灰化对应角色池格
            const revealedDead = state.seats.filter((s) => !s.alive && s.role === r).length
            const total = pool.filter((x) => x === r).length
            const idxAmong = pool.slice(0, i + 1).filter((x) => x === r).length
            const deadThis = revealedDead >= idxAmong
            return (
              <div
                key={i}
                title={ROLE_META[r].name}
                className={cn('relative aspect-[2/3] rounded border overflow-hidden', deadThis ? 'border-cinnabar/50 grayscale' : 'border-[rgba(227,194,124,.2)]')}
              >
                <img src={ROLE_META[r].image} alt={ROLE_META[r].name} className="w-full h-full object-cover object-top" draggable={false} />
                {deadThis && <span className="absolute inset-0 flex items-center justify-center"><span className="w-[130%] h-[2px] bg-cinnabar-hi rotate-[-30deg]" /></span>}
                <span className="sr-only">{ROLE_META[r].name}（{idxAmong}/{total}）</span>
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-faint mt-2">狼×2 · 预言家 · 女巫 · 平民×2</p>
      </div>

      {/* 存活名单 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="text-[11px] tracking-[.25em] text-faint mb-2">存活名单</div>
        <div className="flex flex-col gap-1">
          {state.seats.map((s) => (
            <div key={s.seat} className={cn('flex items-center gap-2 py-1 px-1.5 rounded', s.seat === 0 && 'border border-[rgba(227,194,124,.25)] bg-[rgba(227,194,124,.06)]')}>
              <span className="font-cinzel text-[12px] text-dim w-4">{s.seat + 1}</span>
              <span className={cn('text-[13px] flex-1 truncate', s.alive ? (s.seat === 0 ? 'text-gold-300' : 'text-bone') : 'text-faint line-through')}>{s.name}</span>
              {s.role === 'werewolf' && state.seats[0]?.role === 'werewolf' && s.seat !== 0 && <PawMark size={12} />}
              <span className={cn('w-2 h-2 rounded-full', s.alive ? 'bg-gold-300 shadow-[0_0_6px_rgba(227,194,124,.7)]' : 'bg-faint')} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ---------------- 中央舞台：烛火 / 月相 / 发言气泡 / 开票祭坛 ---------------- */
function WolfStage({ state, isNight, lastSpeechText, lastSpeechSeat }: { state: WolfState; isNight: boolean; lastSpeechText: string | null; lastSpeechSeat: number | null }) {
  const flameColor = state.phase === 'dayVote' || state.phase === 'voteReveal' ? '#F0655A' : isNight ? MOONLIGHT : DAWN_GOLD
  const moonPhase = Math.min(1, state.day / 6)
  return (
    <div className="relative w-[300px] h-[300px] rounded-full flex items-center justify-center">
      {/* 桌面内圈号位刻字 */}
      {state.seats.map((s) => {
        const a = ((90 - s.seat * 60) * Math.PI) / 180
        return (
          <span
            key={s.seat}
            className="absolute font-cinzel text-[12px] text-[rgba(242,234,216,.25)]"
            style={{ left: `${50 + 42 * Math.cos(a)}%`, top: `${50 - 42 * Math.sin(a)}%`, transform: 'translate(-50%,-50%)' }}
          >
            {s.seat + 1}
          </span>
        )
      })}
      {/* 烛火 / 月相 */}
      {isNight ? (
        <div className="relative w-[72px] h-[72px]">
          <svg viewBox="0 0 72 72" className="w-full h-full">
            <circle cx="36" cy="36" r="30" fill="rgba(185,200,255,.12)" stroke="rgba(185,200,255,.4)" strokeWidth="1" />
            <circle cx={36 + 18 * moonPhase} cy="36" r="26" fill="rgba(7,6,11,.85)" />
            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(185,200,255,.25)" strokeWidth="0.5" />
          </svg>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[.3em] text-[rgba(185,200,255,.6)]">第 {state.day} 夜</span>
        </div>
      ) : (
        <div className="relative flex flex-col items-center">
          <span
            className="block w-8 h-12 rounded-[50%] animate-breathe"
            style={{
              background: `radial-gradient(50% 60% at 50% 70%, ${flameColor} 0%, transparent 70%)`,
              filter: `drop-shadow(0 0 18px ${flameColor})`,
              animationDuration: '4s',
            }}
          />
          <span className="w-10 h-2 rounded-full bg-[rgba(227,194,124,.3)] mt-1" />
        </div>
      )}
      {/* 当前发言气泡（从舞台升起） */}
      {lastSpeechText != null && lastSpeechSeat != null && (
        <motion.div
          key={`${lastSpeechSeat}-${lastSpeechText}`}
          className="absolute -top-16 left-1/2 -translate-x-1/2 z-20"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <SpeechBubble text={lastSpeechText} tail="bottom" variant={lastSpeechSeat === 0 ? 'self' : 'default'} suit="spade" typing />
          <div className="text-center text-[10px] text-faint mt-1">{WerewolfEngine.displaySeat(lastSpeechSeat)} 号 · {state.seats[lastSpeechSeat]?.name}</div>
        </motion.div>
      )}
    </div>
  )
}

/* ---------------- 预言家验人印章 ---------------- */
function SeerStamp({ record }: { record: { target: number; isWolf: boolean } }) {
  const wolf = record.isWolf
  return (
    <motion.div
      className="absolute left-1/2 top-[16%] -translate-x-1/2 z-30"
      initial={{ scale: 1.5, opacity: 0, rotate: 10 }}
      animate={{ scale: 1, opacity: 1, rotate: -3 }}
      transition={{ type: 'spring', stiffness: 280, damping: 15 }}
    >
      <span
        className="seal-stamp px-4 py-2 text-[20px] tracking-[.15em]"
        style={wolf ? undefined : { background: '#1F6E54', boxShadow: '0 2px 8px rgba(78,203,156,.4), inset 0 0 0 1px rgba(248,233,192,.25)' }}
      >
        {WerewolfEngine.displaySeat(record.target)} 号 · {wolf ? '狼人' : '好人'}
      </span>
    </motion.div>
  )
}

/* ---------------- 身份发放翻牌演出 ---------------- */
function DealShow({ role, phaseEndsAt }: { role: Role; phaseEndsAt: number | null }) {
  const meta = ROLE_META[role]
  const [stage, setStage] = useState<'shuffle' | 'reveal'>('shuffle')
  useEffect(() => {
    const t = setTimeout(() => setStage('reveal'), 1800)
    return () => clearTimeout(t)
  }, [])
  const remainMs = phaseEndsAt ? phaseEndsAt - Date.now() : 0
  void remainMs
  return (
    <div className="fixed inset-0 z-[68] flex items-center justify-center bg-[rgba(7,6,11,.78)] backdrop-blur-[4px]">
      {stage === 'shuffle' ? (
        /* 六张牌背洗混 */
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ x: [0, (i % 2 === 0 ? 26 : -26), (i % 3 === 0 ? -18 : 18), 0], rotate: [0, 4, -3, 0] }}
              transition={{ duration: 0.6, repeat: 2, delay: i * 0.05 }}
            >
              <PlayingCard suit="spade" faceDown width={72} tilt={false} />
            </motion.div>
          ))}
        </div>
      ) : (
        /* 自己的身份翻开 */
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ rotateY: 90, scale: 0.8 }}
          animate={{ rotateY: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.83, 0, 0.17, 1] }}
        >
          <PlayingCard suit="spade" rank={meta.name} image={meta.image} width={190} tilt={false} />
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <span className="font-mashan text-[40px]" style={{ color: meta.camp === 'wolf' ? '#F0655A' : '#4ECB9C' }}>{meta.name}</span>
            <span className="text-[13px] text-dim tracking-[.2em]">{meta.motto}</span>
            <span className="text-[11px] text-faint mt-1">你的身份已加密下发 · 牌局即将开始</span>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}

/* ---------------- 底部操作带 ---------------- */
interface WolfBandProps {
  state: WolfState
  engine: WerewolfEngine | null
  humanRole: Role | null
  humanAlive: boolean
  awaiting: WolfState['awaiting']
  timeLeft: number
  pickTarget: number | null
  setPickTarget: (s: number | null) => void
  companionEcho: Echo
  delegated: boolean
}

const SPEECH_TEMPLATES: { id: string; label: string; text: string; intent: SpeechIntent; needsTarget?: boolean }[] = [
  { id: 'biaoshui', label: '表水', text: '我是好人，过。', intent: 'biaoshui' },
  { id: 'accuse', label: '质疑', text: '我怀疑 {X} 号，他发言有问题。', intent: 'accuse', needsTarget: true },
  { id: 'seerClaim', label: '悍跳', text: '我是预言家，昨晚验了 {X} 号。', intent: 'seerClaim', needsTarget: true },
  { id: 'bandwagon', label: '冲锋', text: '跟 {X} 号走，今天出他。', intent: 'bandwagon', needsTarget: true },
  { id: 'pass', label: '划水', text: '再听听。', intent: 'pass' },
  { id: 'defend', label: '倒钩', text: '我觉得 {X} 说得对。', intent: 'defend', needsTarget: true },
]

function WolfActionBand(p: WolfBandProps) {
  const { state, engine, awaiting } = p
  const [speechText, setSpeechText] = useState('')
  const [usedTemplate, setUsedTemplate] = useState<(typeof SPEECH_TEMPLATES)[number] | null>(null)
  const [saveOn, setSaveOn] = useState(false)
  const [nudged, setNudged] = useState(false)

  /* 环节切换重置本地状态 */
  const awaitKey = awaiting ? `${awaiting.kind}#${state.day}#${awaiting.startedAt}` : 'none'
  useEffect(() => {
    setSpeechText('')
    setUsedTemplate(null)
    setSaveOn(false)
  }, [awaitKey])

  const name = (seat: number) => state.seats[seat]?.name ?? ''
  const disp = WerewolfEngine.displaySeat

  /* ---- 观战 ---- */
  if (!p.humanAlive) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-[13px] text-faint tracking-[.2em]">
        观战中 · 你已出局，可继续旁观发言与投票
      </div>
    )
  }

  /* ---- 夜晚行动 ---- */
  if (awaiting?.kind === 'wolfKill') {
    const sug = state.wolfSuggestion
    return (
      <div className="flex items-center gap-4 h-full max-w-[1100px] mx-auto">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-bone">与队友商议后，选择今夜的目标。</span>
          {sug && (
            <div className="flex items-center gap-2 text-[12px] text-cinnabar-hi">
              <span className="w-1.5 h-1.5 rounded-full bg-cinnabar-hi" />
              {name(sug.fromSeat)}：{sug.text}
            </div>
          )}
          <span className="text-[11px] text-faint">{p.pickTarget != null ? `已选 ${disp(p.pickTarget)} 号 ${name(p.pickTarget)}` : '点击座位点选目标（朱砂十字星）'}</span>
        </div>
        <div className="flex-1" />
        <GoldButton
          variant="danger"
          size="lg"
          disabled={p.pickTarget == null}
          onClick={() => {
            if (p.pickTarget != null) engine?.submitWolfKill(p.pickTarget)
          }}
        >
          落刀
        </GoldButton>
        <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
      </div>
    )
  }

  if (awaiting?.kind === 'seerCheck') {
    return (
      <div className="flex items-center gap-4 h-full max-w-[1100px] mx-auto">
        <span className="text-[13px] text-bone">选择一人，窥其真容。</span>
        <span className="text-[11px] text-faint">点击任意存活座位（结果仅你可见）</span>
        <div className="flex-1" />
        <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
      </div>
    )
  }

  if (awaiting?.kind === 'witchAction') {
    const victim = state.pendingVictim
    const canSave = !state.witch.saveUsed && victim != null
    const canPoison = !state.witch.poisonUsed
    return (
      <div className="flex items-center gap-4 h-full max-w-[1100px] mx-auto">
        {/* 解药瓶 */}
        <button
          type="button"
          disabled={!canSave}
          onClick={() => setSaveOn((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2 transition-all',
            saveOn ? 'border-suit-club bg-suit-club/15 shadow-[0_0_14px_rgba(78,203,156,.35)]' : 'border-[rgba(78,203,156,.3)]',
            !canSave && 'opacity-35',
          )}
        >
          <PotionBottle color="#4ECB9C" empty={state.witch.saveUsed} tilt={saveOn} />
          <span className="text-[12px] text-bone text-left">
            解药
            <span className="block text-[10px] text-faint">{victim != null ? `今夜 ${disp(victim)} 号 将死` : '今夜无人待救'}</span>
          </span>
        </button>
        {/* 毒药瓶 */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2',
            p.pickTarget != null ? 'border-cinnabar-hi bg-cinnabar/15 shadow-[0_0_14px_rgba(240,101,90,.35)]' : 'border-[rgba(240,101,90,.3)]',
            !canPoison && 'opacity-35',
          )}
        >
          <PotionBottle color="#F0655A" empty={state.witch.poisonUsed} tilt={p.pickTarget != null} />
          <span className="text-[12px] text-bone text-left">
            毒药
            <span className="block text-[10px] text-faint">
              {canPoison ? (p.pickTarget != null ? `毒杀 ${disp(p.pickTarget)} 号 ${name(p.pickTarget)}` : '点选座位选择目标') : '已用尽'}
            </span>
          </span>
        </div>
        <div className="flex-1" />
        <GoldButton
          variant="gold"
          size="lg"
          onClick={() => engine?.submitWitchAction(saveOn && canSave, canPoison ? p.pickTarget : null)}
        >
          {saveOn || p.pickTarget != null ? '调配完毕' : '今夜不用药'}
        </GoldButton>
        <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
      </div>
    )
  }

  /* ---- 发言 ---- */
  if (awaiting?.kind === 'speech') {
    const target = p.pickTarget ?? state.topSuspect ?? state.seats.find((s) => s.seat !== 0 && s.alive)?.seat ?? 1
    return (
      <div className="flex flex-col gap-2 h-full max-w-[1100px] mx-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          {SPEECH_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                const txt = t.text.replaceAll('{X}', String(disp(target)))
                setSpeechText(txt)
                setUsedTemplate(t)
              }}
              className={cn(
                'h-7 px-3 rounded-full border text-[12px] transition-all',
                usedTemplate?.id === t.id ? 'border-gold-300 text-gold-300 bg-[rgba(227,194,124,.1)]' : 'border-[rgba(139,147,248,.35)] text-dim hover:text-bone',
              )}
            >
              {t.label}{t.needsTarget ? `·${disp(target)}` : ''}
            </button>
          ))}
          <span className="text-[10px] text-faint ml-1">（含对象的模板取「点选座位/嫌疑榜首」为目标）</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={speechText}
            onChange={(e) => setSpeechText(e.target.value.slice(0, 160))}
            placeholder="自由发言（160 字内）…"
            className="flex-1 h-10 rounded-lg bg-ink/80 border border-[rgba(227,194,124,.2)] px-3 text-[13px] text-bone outline-none focus:border-suit-spade"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && speechText.trim()) {
                engine?.submitSpeech(speechText.trim())
                if (usedTemplate) engine?.applyHumanSpeech(usedTemplate.intent, usedTemplate.needsTarget ? target : undefined)
              }
            }}
          />
          <GoldButton
            variant="gold"
            size="md"
            disabled={!speechText.trim()}
            onClick={() => {
              engine?.submitSpeech(speechText.trim())
              if (usedTemplate) engine?.applyHumanSpeech(usedTemplate.intent, usedTemplate.needsTarget ? target : undefined)
            }}
          >
            <Send size={15} />
            发言
          </GoldButton>
          <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
        </div>
      </div>
    )
  }

  /* ---- 投票 ---- */
  if (awaiting?.kind === 'vote') {
    return (
      <div className="flex items-center gap-4 h-full max-w-[1100px] mx-auto">
        <span className="text-[13px] text-bone">放逐一名玩家。</span>
        <span className="text-[11px] text-faint">{p.pickTarget != null ? `已选 ${disp(p.pickTarget)} 号 ${name(p.pickTarget)}` : '点击座位点选（不可自投）'}</span>
        <div className="flex-1" />
        <GoldButton
          variant="gold"
          size="lg"
          disabled={p.pickTarget == null}
          onClick={() => {
            if (p.pickTarget != null) engine?.submitVote(p.pickTarget)
          }}
        >
          投票
        </GoldButton>
        <GoldButton variant="ghost" size="md" onClick={() => engine?.submitVote(null)}>
          弃权
        </GoldButton>
        <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
      </div>
    )
  }

  /* ---- 遗言 ---- */
  if (awaiting?.kind === 'lastWords') {
    return (
      <div className="flex items-center gap-3 h-full max-w-[1100px] mx-auto">
        <input
          value={speechText}
          onChange={(e) => setSpeechText(e.target.value.slice(0, 60))}
          placeholder="留下你的遗言（60 字内）…"
          className="flex-1 h-10 rounded-lg bg-ink/80 border border-[rgba(240,101,90,.35)] px-3 text-[13px] text-bone outline-none focus:border-cinnabar-hi"
        />
        <GoldButton variant="danger" size="md" onClick={() => engine?.submitLastWords(speechText.trim() || '……保重。')}>
          留下遗言
        </GoldButton>
        <TimerRing total={awaiting.timeoutSec} left={p.timeLeft} size={52} />
      </div>
    )
  }

  /* ---- 非输入环节的状态条 ---- */
  const speaker = state.currentSpeaker
  return (
    <div className="flex items-center gap-4 h-full max-w-[1100px] mx-auto">
      {state.phase === 'daySpeech' && speaker != null ? (
        <>
          <span className="text-[13px] text-dim">
            正在发言：<span className="text-bone">{disp(speaker)} 号 {name(speaker)}</span>
          </span>
          <span className="flex-1 h-1 rounded-full bg-[rgba(139,147,248,.15)] overflow-hidden">
            <motion.span className="block h-full bg-suit-spade" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 3.2, ease: 'linear' }} key={speaker} />
          </span>
          <GoldButton
            variant="danger"
            size="sm"
            disabled={nudged}
            onClick={() => {
              setNudged(true)
              toast('你已催过一次，本局不能再催')
            }}
          >
            催一下
          </GoldButton>
        </>
      ) : (
        <span className="text-[13px] text-faint tracking-[.15em]">
          {state.phase.startsWith('night') && (p.delegated ? `${p.companionEcho.name}代你行动中…` : '夜深了，月影村只剩风声。')}
          {state.phase === 'deal' && '身份发放中…'}
          {state.phase === 'dawn' && state.dawnText}
          {state.phase === 'dayVote' && '各怀心思，计票中…'}
          {state.phase === 'voteReveal' && '开票中…'}
          {state.phase === 'lastWords' && '聆听遗言…'}
          {state.phase === 'finished' && '长夜已尽 · 查看结算'}
        </span>
      )}
    </div>
  )
}

/** CSS 药瓶（液面即余量） */
function PotionBottle({ color, empty, tilt }: { color: string; empty: boolean; tilt: boolean }) {
  return (
    <span
      className="relative inline-block w-6 h-9 rounded-b-full rounded-t-[4px] border transition-transform duration-500"
      style={{
        borderColor: `${color}88`,
        background: empty ? 'transparent' : `linear-gradient(180deg, transparent 30%, ${color}55 45%, ${color}AA 100%)`,
        boxShadow: empty ? 'none' : `0 0 10px ${color}55`,
        transform: tilt ? 'rotate(-18deg)' : undefined,
        opacity: empty ? 0.4 : 1,
      }}
    >
      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-1.5 rounded-sm" style={{ background: `${color}88` }} />
    </span>
  )
}

/* ---------------- 右栏：发言记录 ---------------- */
function WolfSpeechLog({ state, className }: { state: WolfState; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state.speeches.length])

  /* 按天分组 */
  const rows: ({ sep: string } | { entry: WolfState['speeches'][number] })[] = []
  let lastDay = 0
  for (const sp of state.speeches) {
    if (sp.day !== lastDay) {
      lastDay = sp.day
      rows.push({ sep: `第 ${sp.day} 天` })
    }
    rows.push({ entry: sp })
  }

  return (
    <div className={cn('panel-bg rounded-xl p-3 flex flex-col min-h-0', className)}>
      <span className="text-[11px] tracking-[.25em] text-faint mb-2 shrink-0">发言记录</span>
      <div ref={ref} className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {rows.map((r, i) => {
          if ('sep' in r) {
            return (
              <div key={`sep-${i}`} className="flex items-center gap-2 mt-1">
                <span className="h-px flex-1 bg-[rgba(227,194,124,.18)]" />
                <span className="text-[10px] tracking-[.25em] text-gold-300/80">{r.sep}</span>
                <span className="h-px flex-1 bg-[rgba(227,194,124,.18)]" />
              </div>
            )
          }
          const e = r.entry
          if (e.kind === 'system') {
            return (
              <div key={e.id} className="text-[11px] text-faint text-center leading-relaxed">
                {e.text}
              </div>
            )
          }
          const seat = e.seat ?? 0
          const s = state.seats[seat]
          const echo = s?.echoId ? getEcho(s.echoId) : undefined
          return (
            <div key={e.id} className="flex items-start gap-2">
              {echo ? (
                <EchoAvatar echo={echo} size={32} className="!w-7 !h-7 mt-0.5" />
              ) : (
                <img src="/avatar-traveler.png" alt="你" className="w-7 h-7 rounded-full border border-gold-300/40 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <span className={cn('text-[11px]', seat === 0 ? 'text-gold-300' : 'text-dim')}>
                  {seat + 1} 号 {s?.name}
                </span>
                <p className={cn('text-[12px] leading-relaxed rounded-lg px-2 py-1 mt-0.5 border', seat === 0 ? 'border-[rgba(227,194,124,.35)] bg-elevated text-bone' : 'border-[rgba(139,147,248,.22)] bg-elevated/60 text-bone/90')}>
                  {e.text}
                </p>
              </div>
            </div>
          )
        })}
        {state.speeches.length === 0 && <span className="text-[12px] text-faint">长夜未启，尚无记录。</span>}
      </div>
    </div>
  )
}

/* ---------------- <1100px 抽屉 ---------------- */
function WolfMiniDrawers({ state, whisper, companionEcho }: { state: WolfState; whisper: string; companionEcho: Echo }) {
  const [open, setOpen] = useState<'log' | 'info' | null>(null)
  return (
    <div className="min-[1100px]:hidden">
      <div className="fixed left-3 top-20 z-40 flex flex-col gap-2">
        <button type="button" onClick={() => setOpen(open === 'log' ? null : 'log')} className="w-10 h-10 rounded-full bg-ink/85 border border-[rgba(227,194,124,.25)] flex items-center justify-center text-gold-300">
          <MessageSquare size={17} />
        </button>
        <button type="button" onClick={() => setOpen(open === 'info' ? null : 'info')} className="w-10 h-10 rounded-full bg-ink/85 border border-[rgba(227,194,124,.25)] flex items-center justify-center text-gold-300">
          <ListOrdered size={17} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-[60]" onClick={() => setOpen(null)}>
          <div className="absolute left-0 top-14 bottom-0 w-[320px] bg-ink/95 border-r border-[rgba(227,194,124,.18)] p-4 overflow-y-auto flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            {open === 'log' ? (
              <>
                <WolfSpeechLog state={state} className="flex-1 min-h-[300px]" />
                <div className="panel-bg rounded-xl p-3 shrink-0" style={{ borderColor: 'rgba(139,147,248,.3)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <EchoAvatar echo={companionEcho} size={32} />
                    <span className="text-[11px] tracking-[.25em] text-suit-spade">影从低语</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-dim">{whisper}</p>
                </div>
              </>
            ) : (
              <WolfLeftPanel state={state} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

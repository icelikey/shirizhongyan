/** 赛马 / 十二席狼人杀共用的联机牌桌；状态与动作都来自公共 Game SDK。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cloud, DoorOpen, Play, RotateCcw, Send, Swords } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import type { BeastRaceRoomView, GameRoomView, WerewolfRoomView } from '@contracts/gameSdk'
import type { GameAction } from '@contracts/room'
import GameTopBar from '@/components/game/GameTopBar'
import GoldButton from '@/components/GoldButton'
import SeatKindBadge from '@/components/online/SeatKindBadge'
import OnlineScorePanel from '@/components/online/OnlineScorePanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

type OfficialTemplate = 'beastRace' | 'werewolf'

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [])
  return now
}

const PHASE_LABEL: Record<string, string> = {
  'night-wolf': '夜 · 群狼落刀',
  'night-seer': '夜 · 预言查验',
  'night-witch': '夜 · 巫药裁量',
  'day-speech': '昼 · 依次发言',
  'day-vote': '昼 · 公投放逐',
  'last-words': '遗言 · 留下证词',
}

export default function OfficialTemplateOnline({ template }: { template: OfficialTemplate }) {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [seatToken, setSeatToken] = useState<string | null>(() => sessionStorage.getItem(seatTokenKey(CODE)))
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [targetSeat, setTargetSeat] = useState(0)
  const [speech, setSpeech] = useState('')
  const [finishedOpen, setFinishedOpen] = useState(false)
  const finishedShownRef = useRef(false)
  const triedJoin = useRef(false)
  const now = useNow()

  const stateQuery = trpc.room.state.useQuery(
    { code: CODE, seatToken: seatToken ?? undefined },
    { refetchInterval: 1000, retry: 1 },
  )
  const view = stateQuery.data as GameRoomView | undefined
  const raceView = view?.template === 'beastRace' ? view as BeastRaceRoomView : null
  const werewolfView = view?.template === 'werewolf' ? view as WerewolfRoomView : null
  const isExpectedTemplate = view?.template === template
  const status = view?.status ?? 'waiting'
  const mySeat = view?.mySeat ?? null
  const phase = view?.phase ?? null
  const subPhase = werewolfView?.subPhase ?? raceView?.subPhase ?? null
  const timeLeft = view?.submitDeadlineAt
    ? Math.max(0, (view.submitDeadlineAt - (now + (view.serverNow - Date.now()))) / 1000)
    : 0

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (result) => {
      sessionStorage.setItem(seatTokenKey(CODE), result.seatToken)
      setSeatToken(result.seatToken)
      toast('已入座', { description: `${result.seatIndex + 1} 号位 · 规则内核已绑定。` })
    },
    onError: (error) => toast('入座失败', { description: error.message }),
  })
  useEffect(() => {
    if (seatToken || triedJoin.current || authLoading || !isAuthenticated || view?.status !== 'waiting') return
    triedJoin.current = true
    joinMutation.mutate({ code: CODE })
  }, [CODE, authLoading, isAuthenticated, joinMutation, seatToken, view?.status])
  useEffect(() => {
    if (view?.mySeat === null && seatToken && view.status !== 'finished') {
      sessionStorage.removeItem(seatTokenKey(CODE))
      setSeatToken(null)
      triedJoin.current = false
    }
  }, [CODE, seatToken, view])
  useEffect(() => {
    if (status === 'finished' && !finishedShownRef.current) {
      finishedShownRef.current = true
      const timer = setTimeout(() => setFinishedOpen(true), 600)
      return () => clearTimeout(timer)
    }
  }, [status])

  const actMutation = trpc.room.act.useMutation({
    onSuccess: () => {
      setSelectedCard(null)
      setSpeech('')
      void stateQuery.refetch()
    },
    onError: (error) => toast('动作被规则内核拒绝', { description: error.message }),
  })
  const act = (action: GameAction) => {
    if (seatToken) actMutation.mutate({ code: CODE, seatToken, action })
  }

  const race = raceView?.race ?? null
  const myRacer = race?.racers.find((racer) => racer.seat === mySeat)
  const wolf = werewolfView?.werewolf ?? null
  const aliveTargets = useMemo(
    () => (wolf?.seats ?? []).filter((seat) => seat.alive && seat.index !== mySeat),
    [mySeat, wolf?.seats],
  )
  const isHost = mySeat === 0 && status === 'waiting'

  if (stateQuery.error || (view && !isExpectedTemplate)) {
    return (
      <div className="min-h-[100dvh] bg-abyss flex items-center justify-center text-bone">
        <div className="panel-bg rounded-2xl p-8 text-center">
          <p className="mb-4 text-dim">{stateQuery.error?.message ?? '该房间与此页面的玩法不匹配'}</p>
          <GoldButton variant="gold" onClick={() => navigate('/lobby')}>返回大厅</GoldButton>
        </div>
      </div>
    )
  }

  const renderRaceBoard = () => (
    <section className="panel-bg rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] tracking-[.2em] text-gold-300"><Swords size={15} /> 金壤 · 赛道状态</div>
        <span className="font-mono text-[11px] text-faint">{race?.trackLength ?? 48} 格终点</span>
      </div>
      <div className="relative h-28 rounded-xl border border-gold-300/15 bg-[#1a1220] p-4">
        <div className="absolute inset-x-5 top-1/2 h-px bg-gradient-to-r from-gold-300/20 via-gold-300/60 to-suit-club" />
        {(race?.racers ?? []).map((racer) => (
          <div key={racer.seat} className="absolute top-1/2 -translate-y-1/2 transition-all duration-700" style={{ left: `calc(20px + ${(Math.min(racer.visiblePosition, race?.trackLength ?? 48) / (race?.trackLength ?? 48)) * 88}%)` }}>
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold', racer.seat === mySeat ? 'border-gold-100 bg-gold-300/20 text-gold-100' : 'border-[#9B7FE8]/70 bg-[#2b2360] text-[#e2dcff]')}>{racer.beastId.slice(0, 2)}</div>
            <span className="absolute left-1/2 top-9 -translate-x-1/2 whitespace-nowrap text-[9px] text-faint">{racer.position}格 · {racer.finishRank ? `第${racer.finishRank}` : `席${racer.seat + 1}`}</span>
          </div>
        ))}
        <span className="absolute right-3 top-2 text-[9px] tracking-[.2em] text-suit-club">终点</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(race?.racers ?? []).map((racer) => (
          <div key={racer.seat} className={cn('rounded-xl border p-3 text-[11px]', racer.seat === mySeat ? 'border-gold-100/40 bg-gold-300/5' : 'border-bone/10 bg-ink/30')}>
            <div className="flex items-center justify-between"><span className="text-bone">席位 {racer.seat + 1} · {racer.beastId}</span><span className="font-mono text-gold-300">{racer.handCount} 张牌</span></div>
            <p className="mt-1 text-dim">{racer.position}/{race?.trackLength ?? 48} 格 · {racer.stunnedRounds ? '停行' : racer.slowedNextRound ? '下轮减速' : '可行动'}</p>
          </div>
        ))}
      </div>
    </section>
  )

  const renderRaceControls = () => {
    if (status !== 'playing' || phase !== 'submit' || !myRacer || myRacer.hand.length === 0) return null
    const needsTarget = selectedCard?.includes('-d') ?? false
    const targets = (race?.racers ?? []).filter((racer) => racer.seat !== mySeat && racer.finishRank === null)
    return (
      <section className="panel-bg rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serifsc text-[17px] text-gold-100">提交赛马手牌</h2><span className="text-[11px] text-faint">窗口 {Math.ceil(timeLeft)}s · 盘外招只改信息</span></div>
        <div className="flex flex-wrap gap-2">
          {myRacer.hand.map((cardId) => <button key={cardId} type="button" onClick={() => setSelectedCard(cardId)} className={cn('rounded-lg border px-3 py-2 text-[11px]', selectedCard === cardId ? 'border-gold-100 bg-gold-300/10 text-gold-100' : 'border-bone/10 text-dim')}>{cardId}</button>)}
        </div>
        {needsTarget && <div className="mt-3 flex flex-wrap gap-2"><span className="py-1 text-[11px] text-faint">目标：</span>{targets.map((racer) => <button key={racer.seat} type="button" onClick={() => setTargetSeat(racer.seat)} className={cn('rounded-full border px-3 py-1 text-[11px]', targetSeat === racer.seat ? 'border-suit-heart text-suit-heart' : 'border-bone/10 text-dim')}>席位 {racer.seat + 1}</button>)}</div>}
        <div className="mt-4 flex justify-end"><GoldButton variant="gold" disabled={!selectedCard || (needsTarget && !targets.some((racer) => racer.seat === targetSeat)) || actMutation.isPending} onClick={() => selectedCard && act({ type: 'play', cardId: selectedCard, ...(needsTarget ? { targetSeat } : {}) })}><Send size={14} /> 封牌落子</GoldButton></div>
      </section>
    )
  }

  const renderWerewolfBoard = () => (
    <section className="panel-bg rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-[12px] tracking-[.2em] text-[#bda8ff]"><Swords size={15} /> 月影村 · 证言席</div><span className="text-[11px] text-faint">第 {wolf?.day ?? 1} 日 · {PHASE_LABEL[subPhase ?? ''] ?? subPhase ?? '等待阶段'}</span></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(wolf?.seats ?? []).map((seat) => (
          <div key={seat.index} className={cn('rounded-xl border p-3', seat.alive ? 'border-bone/10 bg-ink/30' : 'border-suit-heart/20 bg-suit-heart/5 opacity-60')}>
            <div className="flex items-center gap-2"><span className="font-mono text-gold-300">{seat.index + 1}</span><span className="min-w-0 flex-1 truncate text-[12px] text-bone">{seat.name}</span><SeatKindBadge kind={seat.kind} /></div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-faint"><span>{seat.alive ? '存活' : '已出局'}</span>{seat.index === mySeat && <span className="text-gold-100">{seat.role ?? '身份隐去'}</span>}</div>
          </div>
        ))}
      </div>
      {wolf?.events?.length ? <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-bone/10 bg-ink/30 p-3 text-[11px] text-dim">{wolf.events.slice(-8).map((event, index) => <p key={`${event.t}-${index}`} className="mb-1">{event.t} · {event.secret ? '密态事件' : '公开事件'}</p>)}</div> : null}
    </section>
  )

  const renderWerewolfControls = () => {
    if (status !== 'playing' || phase !== 'submit' || mySeat == null) return null
    const target = (targetSeat >= 0 ? targetSeat : aliveTargets[0]?.index) ?? 0
    const buttons = aliveTargets.map((seat) => <button key={seat.index} type="button" onClick={() => setTargetSeat(seat.index)} className={cn('rounded-full border px-3 py-1.5 text-[11px]', targetSeat === seat.index ? 'border-[#bda8ff] text-[#d9d0ff]' : 'border-bone/10 text-dim')}>{seat.index + 1}号 · {seat.name}</button>)
    return (
      <section className="panel-bg rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-serifsc text-[17px] text-gold-100">提交证言与裁量</h2><span className="text-[11px] text-faint">窗口 {Math.ceil(timeLeft)}s</span></div>
        {subPhase === 'day-speech' && <div className="flex gap-2"><input value={speech} onChange={(event) => setSpeech(event.target.value)} maxLength={600} placeholder="留下可被未来复盘的证言……" className="min-w-0 flex-1 rounded-lg border border-bone/10 bg-ink/40 px-3 py-2 text-[12px] text-bone outline-none focus:border-[#bda8ff]" /><GoldButton variant="gold" disabled={!speech.trim() || actMutation.isPending} onClick={() => act({ type: 'speak', text: speech })}><Send size={14} /> 发言</GoldButton></div>}
        {subPhase === 'night-wolf' && <div className="flex flex-wrap gap-2">{buttons}<GoldButton variant="gold" disabled={actMutation.isPending} onClick={() => act({ type: 'play', cardId: `wolf-kill-${target}` })}>落刀</GoldButton></div>}
        {subPhase === 'night-seer' && <div className="flex flex-wrap gap-2">{buttons}<GoldButton variant="gold" disabled={actMutation.isPending} onClick={() => act({ type: 'play', cardId: `seer-check-${target}` })}>查验</GoldButton></div>}
        {subPhase === 'night-witch' && <div className="flex flex-wrap gap-2"><GoldButton variant="gold" onClick={() => act({ type: 'play', cardId: 'witch-save' })}>救人</GoldButton><GoldButton variant="ghost" onClick={() => act({ type: 'play', cardId: `witch-poison-${target}` })}>施毒 {target + 1}号</GoldButton><GoldButton variant="ghost" onClick={() => act({ type: 'play', cardId: 'witch-pass' })}>留药</GoldButton></div>}
        {subPhase === 'day-vote' && <div className="flex flex-wrap gap-2">{buttons}<GoldButton variant="gold" onClick={() => act({ type: 'play', cardId: `vote-${target}` })}>投票放逐</GoldButton><GoldButton variant="ghost" onClick={() => act({ type: 'play', cardId: 'vote-abstain' })}>弃票</GoldButton></div>}
        {subPhase === 'last-words' && <GoldButton variant="gold" onClick={() => act({ type: 'play', cardId: 'last-words' })}>留下遗言</GoldButton>}
      </section>
    )
  }

  return (
    <div className="relative z-[55] -mt-16 flex h-[100dvh] flex-col overflow-hidden bg-abyss text-bone">
      <GameTopBar suit={template === 'beastRace' ? 'diamond' : 'heart'} intro={template === 'beastRace' ? GAME_INTROS.guess : GAME_INTROS.werewolf} room={`${template === 'beastRace' ? '金壤·超能力赛马' : '月影村·十二席证言'} · ${view?.roomName ?? CODE} · ${CODE}`} phase={<span>{status === 'playing' ? `${PHASE_LABEL[subPhase ?? ''] ?? '行动窗口'} · ${Math.ceil(timeLeft)}s` : status === 'waiting' ? '待开局' : '已终局'}</span>} pool={view ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation : 130} onExit={() => navigate('/lobby')} />
      <main className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        {status === 'waiting' && <section className="panel-bg rounded-2xl p-5 text-center"><p className="mb-4 text-[13px] tracking-[.18em] text-dim">{template === 'beastRace' ? '六兽已在金壤边界列阵' : '十二席已封入月影村，等待影从落座'}</p>{isHost ? <GoldButton variant="gold" size="lg" disabled={actMutation.isPending} onClick={() => act({ type: 'start' })}><Play size={16} /> 开局 · 由影从补席</GoldButton> : mySeat != null ? <span className="text-[13px] text-dim">已入座 · 静候房主开局</span> : isAuthenticated ? <GoldButton variant="suit" suit={template === 'beastRace' ? 'diamond' : 'heart'} size="lg" onClick={() => { triedJoin.current = true; joinMutation.mutate({ code: CODE }) }}><DoorOpen size={16} /> 入座此局</GoldButton> : <GoldButton variant="gold" size="lg" onClick={() => navigate(LOGIN_PATH)}><Cloud size={16} /> 云登录后入座</GoldButton>}</section>}
        {template === 'beastRace' ? renderRaceBoard() : renderWerewolfBoard()}
        {template === 'beastRace' ? renderRaceControls() : renderWerewolfControls()}
        {status === 'finished' && <section className="panel-bg rounded-2xl p-6 text-center"><h2 className="font-serifsc text-[20px] text-gold-100">这一局已经封存</h2><p className="mt-2 text-[12px] text-dim">终局事实已进入战报与世界贡献流。</p><div className="mt-4 flex justify-center gap-3"><GoldButton variant="gold" onClick={() => setFinishedOpen(true)}>查看终局</GoldButton><GoldButton variant="ghost" onClick={() => navigate('/lobby')}><RotateCcw size={14} /> 返回大厅</GoldButton></div></section>}
        <aside className="panel-bg rounded-2xl p-4"><OnlineScorePanel seats={view?.seats ?? []} mySeat={mySeat} winner={view?.winner} /><p className="mt-3 text-[10px] leading-5 text-faint">状态每秒从服务端同步；所有动作先进入确定性规则内核，再产生公开揭示。</p></aside>
      </main>
      {finishedOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setFinishedOpen(false)}><div className="panel-bg max-h-[80vh] w-full max-w-2xl overflow-auto rounded-2xl p-6" onClick={(event) => event.stopPropagation()}><h2 className="font-serifsc text-[20px] text-gold-100">终局揭示</h2><pre className="mt-4 whitespace-pre-wrap break-words text-[11px] leading-5 text-dim">{JSON.stringify(view?.lastReveal, null, 2)}</pre></div></div>}
    </div>
  )
}

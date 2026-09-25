/** 终焉·巫蛊娃娃异能桌球：规则内核状态的观战与可操作降级视图。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cloud, DoorOpen, Play, Sparkles, Target } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import type { BilliardsAbilityDecision, BilliardsAbilityId, BilliardsRoomView } from '@contracts/gameSdk'
import GameTopBar from '@/components/game/GameTopBar'
import GoldButton from '@/components/GoldButton'
import SeatKindBadge from '@/components/online/SeatKindBadge'
import OnlineFinishedPanel from '@/components/online/OnlineFinishedPanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

const ABILITY_LABEL: Record<BilliardsAbilityId, string> = { 'return-soul': '返魂', 'right-angle': '直角', 'phase-walk': '穿界' }
const DECISIONS: { value: BilliardsAbilityDecision; label: string }[] = [
  { value: 'reflect', label: '反弹' },
  { value: 'right_angle', label: '直角' },
  { value: 'phase_walk', label: '穿界' },
  { value: 'ignore', label: '无视' },
]

function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer) }, [])
  return now
}

export default function SuperpowerBilliardsOnline() {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [seatToken, setSeatToken] = useState<string | null>(() => sessionStorage.getItem(seatTokenKey(CODE)))
  const [angle, setAngle] = useState(0)
  const [power, setPower] = useState(0.62)
  const [selectedBall, setSelectedBall] = useState<string | null>(null)
  const [selectedAbility, setSelectedAbility] = useState<BilliardsAbilityId | null>(null)
  const [decision, setDecision] = useState<BilliardsAbilityDecision>('ignore')
  const [finishedOpen, setFinishedOpen] = useState(false)
  const finishedRef = useRef(false)
  const stateQuery = trpc.room.state.useQuery({ code: CODE, seatToken: seatToken ?? undefined }, { refetchInterval: 900, retry: 1 })
  const view = stateQuery.data as BilliardsRoomView | undefined
  const now = useNow()

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res) => { sessionStorage.setItem(seatTokenKey(CODE), res.seatToken); setSeatToken(res.seatToken); toast('已入座', { description: `${res.seatIndex + 1} 号位 · 巫蛊娃娃已落桌。` }) },
    onError: (err) => toast('入座失败', { description: err.message }),
  })
  const triedJoin = useRef(false)
  useEffect(() => {
    if (!seatToken && !triedJoin.current && !authLoading && isAuthenticated && view?.status === 'waiting') { triedJoin.current = true; joinMutation.mutate({ code: CODE }) }
  }, [CODE, authLoading, isAuthenticated, joinMutation, seatToken, view?.status])
  useEffect(() => {
    if (view?.status === 'finished' && !finishedRef.current) { finishedRef.current = true; const timer = setTimeout(() => setFinishedOpen(true), 700); return () => clearTimeout(timer) }
  }, [view?.status])

  const actMutation = trpc.room.act.useMutation({ onSuccess: () => { setSelectedBall(null); setSelectedAbility(null); void stateQuery.refetch() }, onError: (err) => toast('动作被拒绝', { description: err.message }) })
  const act = (action: Parameters<typeof actMutation.mutate>[0]['action']) => { if (seatToken) actMutation.mutate({ code: CODE, seatToken, action }) }
  const status = view?.status ?? 'waiting'
  const mySeat = view?.mySeat ?? null
  const isHost = mySeat === 0 && status === 'waiting'
  const myBall = useMemo(() => view?.balls.find((ball) => ball.ownerSeat === mySeat && !ball.pocketed && ball.lives > 0), [mySeat, view?.balls])
  useEffect(() => { if (!selectedBall && myBall) setSelectedBall(myBall.id) }, [myBall, selectedBall])
  const remaining = view?.phase === 'submit' && view.submitDeadlineAt ? Math.max(0, (view.submitDeadlineAt - (now + (view.serverNow - Date.now()))) / 1000) : 0

  if (stateQuery.error) return <div className="min-h-[100dvh] bg-abyss flex items-center justify-center text-bone"><div className="panel-bg rounded-2xl p-8 text-center"><p className="mb-4 text-dim">{stateQuery.error.message}</p><GoldButton variant="gold" onClick={() => navigate('/lobby')}>返回大厅</GoldButton></div></div>

  return (
    <div className="relative z-[55] -mt-16 flex h-[100dvh] flex-col overflow-hidden bg-abyss text-bone">
      <GameTopBar suit="spade" intro={GAME_INTROS.billiards} room={`终焉·巫蛊娃娃 · ${view?.roomName ?? CODE} · ${CODE}`} phase={<span>{status === 'playing' ? `${view?.phase === 'submit' ? '行动窗口' : '揭晓中'} · ${Math.ceil(remaining)}s` : status === 'waiting' ? '待开局' : status === 'finished' ? '已终局' : ''}</span>} pool={view ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation : 130} onExit={() => navigate('/lobby')} />
      <div className="relative z-10 flex min-h-0 flex-1">
        <aside className="hidden w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[rgba(227,194,124,.1)] bg-[rgba(12,10,19,.55)] p-4 min-[1000px]:flex">
          <div className="panel-bg rounded-xl p-3"><div className="mb-2 text-[11px] tracking-[.25em] text-faint">存活座位</div>{(view?.seats ?? []).map((seat) => <div key={seat.index} className={cn('flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px]', view?.aliveSeats.includes(seat.index) ? 'text-bone' : 'text-faint line-through')}><span className="w-4 font-mono text-gold-300">{seat.index + 1}</span><span className="min-w-0 flex-1 truncate">{seat.name}</span><SeatKindBadge kind={seat.kind} /><span className="font-mono text-gold-100">{seat.score}</span></div>)}</div>
          <div className="panel-bg rounded-xl p-3 text-[12px] leading-relaxed text-dim"><div className="mb-2 text-[11px] tracking-[.25em] text-faint">规则速览</div>自己的娃娃负责击杆，撞入对方袋口即可得分；进洞的球失去一条命并回到复活点。得分后保留连杆机会，Agent 在能力窗口决定反弹、直角、穿界或无视。</div>
          <div className="panel-bg rounded-xl p-3 text-[11px] text-faint">固定桌面 100 × 50 · 6 枚 Q 版球体 · 4 袋口 · {view?.totalRounds ?? 8} 回合</div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-6">
          <section className="panel-bg rounded-2xl p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-[12px] tracking-[.2em] text-gold-300"><Target size={15} /> 巫蛊娃娃球桌 · 第 {view?.round ?? 0}/{view?.totalRounds ?? 8} 回合</div><span className="font-mono text-[11px] text-faint">{view?.phase === 'submit' ? `窗口 ${Math.ceil(remaining)}s` : '轨迹回放'}</span></div>
            <div className="relative aspect-[2/1] overflow-hidden rounded-[24px] border-[10px] border-[#3b1f35] bg-[#173d35] shadow-[inset_0_0_50px_rgba(0,0,0,.55),0_0_30px_rgba(139,147,248,.12)]">
              {[0, 1, 2, 3].map((pocket) => <span key={pocket} className={cn('absolute h-6 w-6 rounded-full bg-[#07060b] shadow-[0_0_12px_rgba(0,0,0,.75)] sm:h-8 sm:w-8', pocket === 0 && 'left-[-5px] top-[-5px]', pocket === 1 && 'right-[-5px] top-[-5px]', pocket === 2 && 'bottom-[-5px] left-[-5px]', pocket === 3 && 'bottom-[-5px] right-[-5px]')} />)}
              {(view?.balls ?? []).map((ball) => <button key={ball.id} type="button" onClick={() => ball.ownerSeat === mySeat && setSelectedBall(ball.id)} className={cn('absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[9px] font-bold transition-all sm:h-9 sm:w-9', ball.ownerSeat === mySeat ? 'border-gold-100 bg-[#B0352E] text-gold-100 shadow-[0_0_14px_rgba(227,194,124,.5)]' : 'border-[#9B7FE8]/70 bg-[#2b2360] text-[#e2dcff]', selectedBall === ball.id && 'ring-2 ring-gold-100 ring-offset-2 ring-offset-[#173d35]', ball.lives <= 0 && 'opacity-25 grayscale')} style={{ left: `${ball.x}%`, top: `${ball.y * 2}%` }} aria-label={`${ball.id} · ${ball.lives} 条命`}>{ball.id.slice(-2)}</button>)}
              <div className="pointer-events-none absolute inset-x-4 bottom-2 flex justify-between text-[9px] uppercase tracking-[.3em] text-white/30"><span>复活点</span><span>轨迹线索 · 物理内核</span><span>复活点</span></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-faint">{(view?.balls ?? []).map((ball) => <span key={ball.id} className="rounded-full border border-bone/10 px-2 py-1"><span className="text-gold-300">{ball.id}</span> · {ball.lives} 命 · {ABILITY_LABEL[ball.abilityId]}</span>)}</div>
          </section>

          {status === 'waiting' && <div className="flex flex-1 flex-col items-center justify-center gap-4">{isHost ? <><GoldButton variant="gold" size="lg" onClick={() => act({ type: 'start' })}><Play size={16} /> 开局</GoldButton><span className="text-[12px] text-dim">已入座 {view?.seats.length ?? 0}/{view?.seats.length ?? 6} · 先让 Agent 进入自己的球体</span></> : mySeat != null ? <span className="text-[13px] tracking-[.2em] text-dim">已入座 · 静候房主开局</span> : isAuthenticated ? <GoldButton variant="suit" suit="spade" size="lg" onClick={() => { triedJoin.current = true; joinMutation.mutate({ code: CODE }) }}><DoorOpen size={16} /> 入座此局</GoldButton> : <GoldButton variant="gold" size="lg" onClick={() => navigate(LOGIN_PATH)}><Cloud size={16} /> 云登录后入座</GoldButton>}</div>}

          {status === 'playing' && view?.phase === 'submit' && view.subPhase && view.phaseSubmittedCount < view.seats.length && (
            <section className="panel-bg rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-serifsc text-[17px] text-gold-100">{view.subPhase === 'strike' ? '提交击杆' : 'Agent 能力回应'}</h2>
                <span className="text-[11px] text-faint">{view.subPhase === 'strike' ? '先选择自己的巫蛊娃娃' : '反弹、直角、穿界或无视'}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
                <div className="rounded-xl border border-bone/10 bg-ink/40 p-3">
                  <div className="mb-2 text-[11px] tracking-[.2em] text-faint">击杆参数</div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {(view.balls ?? []).filter((ball) => ball.ownerSeat === mySeat && ball.lives > 0).map((ball) => (
                      <button key={ball.id} type="button" onClick={() => setSelectedBall(ball.id)} className={cn('rounded-lg border px-3 py-2 text-[11px]', selectedBall === ball.id ? 'border-gold-100 bg-gold-300/10 text-gold-100' : 'border-bone/10 text-dim')}>{ball.id} · {ball.lives}命</button>
                    ))}
                  </div>
                  <label className="mb-3 block text-[12px] text-dim">角度 <input aria-label="击杆角度" type="range" min={-3.14} max={3.14} step={0.01} value={angle} onChange={(event) => setAngle(Number(event.target.value))} className="ml-2 w-40 accent-[#E3C27C]" /> <span className="font-mono text-gold-300">{angle.toFixed(2)}</span></label>
                  <label className="mb-4 block text-[12px] text-dim">力度 <input aria-label="击杆力度" type="range" min={0.1} max={1} step={0.01} value={power} onChange={(event) => setPower(Number(event.target.value))} className="ml-2 w-40 accent-[#E3C27C]" /> <span className="font-mono text-gold-300">{power.toFixed(2)}</span></label>
                  <GoldButton variant="gold" disabled={view.subPhase !== 'strike' || !selectedBall || actMutation.isPending} onClick={() => selectedBall && act({ type: 'strike', ballId: selectedBall, angle, power })}><Target size={14} /> 击杆</GoldButton>
                </div>
                <div className="rounded-xl border border-bone/10 bg-ink/40 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[11px] tracking-[.2em] text-faint"><Sparkles size={13} className="text-[#9B7FE8]" /> Agent 能力窗口</div>
                  <div className="mb-3 flex flex-wrap gap-2">{(view.balls ?? []).filter((ball) => ball.ownerSeat === mySeat && ball.lives > 0).map((ball) => <button key={ball.id} type="button" onClick={() => { setSelectedBall(ball.id); setSelectedAbility(ball.abilityId) }} className={cn('rounded-lg border px-3 py-2 text-[11px]', selectedAbility === ball.abilityId ? 'border-[#9B7FE8] bg-[#9B7FE8]/10 text-[#d9d0ff]' : 'border-bone/10 text-dim')}>{ABILITY_LABEL[ball.abilityId]}</button>)}</div>
                  <div className="mb-3 flex flex-wrap gap-2">{DECISIONS.map((item) => <button type="button" key={item.value} onClick={() => setDecision(item.value)} className={cn('rounded-full border px-3 py-1.5 text-[11px]', decision === item.value ? 'border-gold-100 text-gold-100' : 'border-bone/10 text-dim')}>{item.label}</button>)}</div>
                  <GoldButton variant="ghost" disabled={view.subPhase !== 'ability' || !selectedAbility || !selectedBall || actMutation.isPending} onClick={() => selectedAbility && selectedBall && act({ type: 'ability', abilityId: selectedAbility, decision, targetBall: selectedBall })}><Sparkles size={14} /> 提交能力决定</GoldButton>
                  <p className="mt-2 text-[10px] leading-relaxed text-faint">能力只作为 Agent 提案提交；是否触发由物理内核按撞击、撞墙、速度和冷却重新判断。</p>
                </div>
              </div>
            </section>
          )}
          {status === 'playing' && view?.phase === 'reveal' && view.lastReveal && <section className="panel-bg rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-serifsc text-[17px] text-gold-100">第 {view.lastReveal.round} 回合 · 轨迹回放</h2><span className="text-[11px] text-faint">碰撞 {view.lastReveal.collisions.length} · 进洞 {view.lastReveal.pockets.length}</span></div><div className="grid gap-2 text-[11px] text-dim sm:grid-cols-2"><div className="rounded-xl border border-bone/10 p-3">{view.lastReveal.pockets.length ? view.lastReveal.pockets.map((pocket) => <p key={`${pocket.ballId}-${pocket.pocket}`}>{pocket.ballId} 进入 {pocket.pocket + 1} 号袋 · {pocket.bySeat === pocket.ownerSeat ? '自损' : `${pocket.bySeat + 1}号击中`} · {pocket.ownerSeat === pocket.bySeat ? `-${view?.rewards.participation}` : '得分'}</p>) : <p>本回合没有巫蛊娃娃进洞。</p>}</div><div className="rounded-xl border border-bone/10 p-3">{view.lastReveal.abilities.length ? view.lastReveal.abilities.map((ability, index) => <p key={`${ability.abilityId}-${index}`} className={ability.accepted ? 'text-suit-club' : 'text-suit-heart'}>{ABILITY_LABEL[ability.abilityId]} · {ability.accepted ? '已执行' : '已降级'} · {ability.reason}</p>) : <p>本回合没有能力回应。</p>}</div></div></section>}
          {status === 'finished' && <div className="flex flex-1 items-center justify-center"><OnlineFinishedPanel open={finishedOpen} onClose={() => setFinishedOpen(false)} onExit={() => navigate('/lobby')} view={view as never} /></div>}
        </main>
      </div>
    </div>
  )
}


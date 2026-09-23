/**
 * ============================================================================
 * 联机「果蝇大脑 · 逗蛐蛐」· /game/online-fly/:code
 * ----------------------------------------------------------------------------
 * 页面本身只做三件事，与模板的因果链一一对应：
 *
 *   提交阶段 → 牌桌（读表）      ：52 张牌的六行为分布全摊开，选一张
 *   揭晓阶段 → 结算板（看因果）  ：牌 → 行为 → 打中 → 拥挤 → 怒气 → 得分
 *   随时     → 脉冲雨（看证据）  ：点座位看那张牌的真实放电
 *
 * 复用联机组件壳（SeatRing / TimerRing / GameTopBar / OnlineScorePanel /
 * OnlineFinishedPanel），视觉延续墨色语言，归入 ♠ 玄渊（本局 entryFee 花色）。
 * 状态来自服务端 trpc.room.state（1.5s 轮询），本轮偏好由服务端下发。
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Cloud, DoorOpen, FlaskConical, Play, RotateCcw } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import {
  FLY_BEHAVIOR_META,
  FLY_HIT_FLOOR,
  type FlyBehavior,
  type FlyTeaseRoomView,
} from '@contracts/flyTease'
import { FLY_TABLE } from '@/data/flyAtlas'
import { ECHOES, SUIT_META } from '@/data/echoes'
import SeatRing from '@/components/SeatRing'
import TimerRing from '@/components/TimerRing'
import GoldButton from '@/components/GoldButton'
import GameTopBar from '@/components/game/GameTopBar'
import MaskIcon from '@/components/MaskIcon'
import OnlineScorePanel from '@/components/online/OnlineScorePanel'
import OnlineFinishedPanel from '@/components/online/OnlineFinishedPanel'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import FlyCardDeck from '@/components/fly/FlyCardDeck'
import FlyRevealBoard from '@/components/fly/FlyRevealBoard'
import { FLY_BEHAVIOR_COLOR, FLY_BEHAVIOR_GLYPH, FLY_TIER_NOTE } from '@/components/fly/flyMeta'
import { GAME_INTROS } from '@/data/gameIntros'
import { cn } from '@/lib/utils'

const DEFAULT_WINDOW_SEC = 45

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
  submit: '择牌中',
  reveal: '揭晓中',
  finished: '已终局',
}

/** N 座椭圆均布：0 号座固定底部（90°），逆时针均布 */
function seatPos(i: number, n: number): { left: string; top: string } {
  const rad = ((90 - (360 / n) * i) * Math.PI) / 180
  return { left: `${50 + 46 * Math.cos(rad)}%`, top: `${50 - 44 * Math.sin(rad)}%` }
}

export default function FlyOnline() {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [seatToken, setSeatToken] = useState<string | null>(() =>
    sessionStorage.getItem(seatTokenKey(CODE)),
  )
  const [selected, setSelected] = useState<number | null>(null)

  const stateQuery = trpc.room.state.useQuery(
    { code: CODE, seatToken: seatToken ?? undefined },
    { refetchInterval: 1500, retry: 1 },
  )
  const view = stateQuery.data as FlyTeaseRoomView | undefined

  /* ---------------- 入座 ---------------- */
  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(seatTokenKey(CODE), res.seatToken)
      setSeatToken(res.seatToken)
      toast('已入座', { description: `${res.seatIndex + 1} 号位 · 驯虫师就位。` })
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
    onSuccess: () => {
      setSelected(null)
      void stateQuery.refetch()
    },
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

  /* ---------------- 派生数据 ---------------- */
  const status = view?.status ?? 'waiting'
  const phase = view?.phase ?? null
  const mySeat = view?.mySeat ?? null
  const reveal = view?.lastReveal ?? null
  const revealing = status === 'playing' && phase === 'reveal' && reveal != null
  const mySeatView = mySeat != null ? view?.seats.find((s) => s.index === mySeat) : undefined
  const isHost = mySeat === 0 && status === 'waiting'
  /** 本轮偏好：服务端下发；未开局时退化成一个占位（不会被用到） */
  const mood: FlyBehavior = view?.fly.mood ?? 'freeze'
  const moodColor = FLY_BEHAVIOR_COLOR[mood]
  const moodMeta = FLY_BEHAVIOR_META[mood]

  const seatNames = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of view?.seats ?? []) {
      m.set(s.index, s.index === mySeat ? `你 · ${s.name}` : s.name)
    }
    return m
  }, [view?.seats, mySeat])

  /** 已选牌在本轮的命中概率——提交前给玩家一个诚实的预览 */
  const picked = selected != null ? FLY_TABLE.cards[selected] : null
  const pickedHit = picked ? (picked.behavior[mood] ?? 0) : 0
  /** 同主导行为的牌有多少张（撞车风险的粗略提示；真实撞车看别人怎么选） */
  const sameTopCount = picked
    ? FLY_TABLE.cards.filter((c) => c.top === picked.top).length
    : 0
  const rewardPool = view
    ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation
    : 80

  /* ---------------- 座位节点 ---------------- */
  const seatNodes = (view?.seats ?? []).map((seat) => {
    const mine = seat.index === mySeat
    const echo = seat.kind === 'echo-bot' ? ECHOES.find((e) => e.name === seat.name) : undefined
    const seatStatus =
      status === 'playing' && phase === 'submit'
        ? seat.submitted
          ? 'submitted'
          : 'thinking'
        : 'idle'
    const myCardIdx = revealing && reveal ? reveal.values[seat.index] : undefined
    const myGain = revealing && reveal ? (reveal.gains[seat.index] ?? 0) : 0
    const isWinner = revealing && myGain > 0
    const kindTag = seat.kind === 'human' ? '旅人' : seat.kind === 'echo-bot' ? '影从' : '外来 Agent'
    return (
      <motion.div
        key={seat.index}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.12 * seat.index, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className={cn('relative', isWinner && 'rounded-full shadow-[0_0_28px_rgba(227,194,124,.5)]')}
      >
        {seat.kind === 'external-agent' && (
          <span className="absolute -top-1 -left-1 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-[#9B7FE8]/60 bg-ink">
            <MaskIcon src="/icon-mask.svg" size={12} color="#9B7FE8" alt="Agent" />
          </span>
        )}
        <SeatRing
          name={mine ? `你 · ${seat.name}` : seat.name}
          echo={echo}
          avatarUrl={seat.kind === 'external-agent' ? '/icon-mask.svg' : '/avatar-traveler.png'}
          tag={kindTag}
          status={seatStatus}
          active={isWinner}
          suit="spade"
          isSelf={mine}
        />
        {/* 揭晓时座位前翻出所出的牌与得分 */}
        {revealing && myCardIdx != null && (
          <motion.div
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ delay: 0.1 + seat.index * 0.06, duration: 0.42, ease: [0.83, 0, 0.17, 1] }}
            className={cn(
              'absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-[6px] border bg-ink/95 px-2 py-0.5',
              isWinner ? 'border-gold-300' : 'border-[rgba(227,194,124,.3)]',
            )}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded-[3px] font-mashan text-[10px] text-ink"
              style={{ background: FLY_BEHAVIOR_COLOR[reveal.tops[seat.index]] }}
            >
              {FLY_BEHAVIOR_GLYPH[reveal.tops[seat.index]]}
            </span>
            <span className="font-mono text-[10px] text-faint">
              {(FLY_TABLE.cards[myCardIdx]?.rate ?? 0)}Hz
            </span>
            <span
              className={cn('font-mono text-[12px]', isWinner ? 'text-gold-300' : 'text-dim')}
            >
              +{myGain}
            </span>
          </motion.div>
        )}
      </motion.div>
    )
  })

  /* ---------------- 错误态 ---------------- */
  if (stateQuery.error) {
    return (
      <div className="relative z-[55] -mt-16 flex h-[100dvh] flex-col items-center justify-center gap-5 overflow-hidden bg-abyss">
        <span className="vertical-rl font-mashan text-[26px] text-suit-spade/70">虫室无处寻</span>
        <p className="text-[13px] text-dim">{stateQuery.error.message}</p>
        <GoldButton variant="gold" onClick={() => navigate('/lobby')}>
          返回大厅
        </GoldButton>
      </div>
    )
  }

  /** 提交态：牌桌铺满中央并可滚动；其余态：居中提示或结算板 */
  const deckMode = status === 'playing' && phase === 'submit'

  return (
    <div className="relative z-[55] -mt-16 flex h-[100dvh] flex-col overflow-hidden bg-abyss">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url("/bg-abacus-court.png")',
          filter: 'brightness(.4) hue-rotate(28deg) saturate(.8)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(60% 50% at 50% 0%, rgba(242,169,59,.10), transparent)',
        }}
      />

      <GameTopBar
        suit="spade"
        intro={GAME_INTROS.fly}
        room={`联机虫室 · ${view?.roomName ?? CODE} · ${CODE}`}
        phase={
          <span className="flex items-center gap-3">
            <span>
              {status === 'playing'
                ? `第 ${view?.round ?? 0} / ${view?.totalRounds ?? 0} 轮`
                : PHASE_TEXT[status]}
            </span>
            <span className="flex items-center gap-1">
              {Array.from({ length: view?.totalRounds ?? 0 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-2 w-2 rounded-full transition-all duration-500',
                    i < (view?.round ?? 0) - 1 && 'bg-suit-spade',
                    i === (view?.round ?? 0) - 1 && status === 'playing' && 'animate-breathe bg-gold-300',
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

      <div className="relative z-10 flex min-h-0 flex-1">
        {/* ── 左栏：本轮偏好 + 行为图鉴 + 响应表来源 ── */}
        <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] p-4 min-[1180px]:flex">
          <div
            className="rounded-xl p-3"
            style={{
              background: `linear-gradient(160deg, ${moodColor}1A 0%, rgba(12,10,19,.6) 70%)`,
              border: `1px solid ${moodColor}33`,
            }}
          >
            <div className="mb-1 text-[11px] tracking-[.25em] text-faint">本轮蛐蛐偏好</div>
            <div
              className="font-mashan text-[28px] leading-tight"
              style={{ color: moodColor, textShadow: `0 0 20px ${moodColor}55` }}
            >
              {moodMeta.label}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-dim">{moodMeta.basis}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              果蝇做出「{moodMeta.label}」的概率 ≥{' '}
              <span className="font-mono text-bone">{(FLY_HIT_FLOOR * 100).toFixed(0)}%</span>{' '}
              才算打中。偏好由定义 id 与轮次唯一确定，全员可见。
            </p>
          </div>

          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">六种行为</div>
            <div className="flex flex-col gap-1.5">
              {(Object.keys(FLY_BEHAVIOR_META) as FlyBehavior[]).map((b) => (
                <div
                  key={b}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-1.5 py-1',
                    b === mood && 'bg-[rgba(255,255,255,.05)]',
                  )}
                >
                  <span
                    className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-mashan text-[10px] text-ink"
                    style={{ background: FLY_BEHAVIOR_COLOR[b] }}
                  >
                    {FLY_BEHAVIOR_GLYPH[b]}
                  </span>
                  <span className="min-w-0">
                    <span
                      className="text-[12px]"
                      style={{ color: b === mood ? moodColor : undefined }}
                    >
                      {FLY_BEHAVIOR_META[b].label}
                      {FLY_BEHAVIOR_META[b].rage > 0 && (
                        <span className="ml-1 font-mono text-[10px] text-[#F0655A]">
                          怒气×{FLY_BEHAVIOR_META[b].rage}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[10px] text-faint">
                      {FLY_BEHAVIOR_META[b].basis}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] tracking-[.25em] text-faint">
              <FlaskConical size={12} /> 这局的大脑
            </div>
            <p className="text-[11px] leading-relaxed text-dim">
              刺激牌的行为分布不是编的：由{' '}
              <span className="text-bone">
                {view?.fly.engine === 'brian2' ? '论文原版全脑' : '真实连接组裁剪子网'}
              </span>
              （Flywire 630 · philshiu/Drosophila_brain_model，MIT）离线跑出，
              运行期只查表。引擎 <span className="font-mono">{view?.fly.engine ?? '—'}</span> ·
              响应表 v{view?.fly.atlasVersion ?? 1} · {view?.fly.cardCount ?? FLY_TABLE.cards.length} 张牌。
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              牌堆由实测决定：静默后总脉冲数不变的组合不生成牌，故牌堆里没有重复牌。
              {FLY_TABLE.cardSpace ? `（${FLY_TABLE.cardSpace.note}）` : ''}
            </p>
          </div>

          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">通道</div>
            <div className="flex flex-col gap-1">
              {FLY_TABLE.groups.map((g) => (
                <div key={g.id} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-[52px] shrink-0 text-bone">{g.label}</span>
                  <span className="text-faint">{FLY_TIER_NOTE[g.tier] ?? g.tier}</span>
                  <span className="ml-auto font-mono text-[10px] text-dim">{g.size}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">房码</div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[18px] tracking-[.25em] text-gold-300">{CODE}</span>
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

        {/* ── 中央 ── */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {deckMode ? (
            /* 提交态：牌桌铺满，可滚动 */
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-mashan text-[17px] text-bone">
                  择一张刺激牌 · 喂给果蝇
                </span>
                <span className="text-[12px] text-dim">
                  偏好「
                  <span style={{ color: moodColor }}>{moodMeta.label}</span>
                  」· 色条即该牌的行为分布（亮段 = 偏好）
                </span>
                <span className="ml-auto font-mono text-[11px] text-faint">
                  共 {FLY_TABLE.cards.length} 张 · 同主导行为的牌 {sameTopCount} 张
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <FlyCardDeck
                  atlas={FLY_TABLE}
                  mood={mood}
                  selected={selected}
                  disabled={!mySeatView || mySeatView.submitted || actMutation.isPending}
                  onPick={(i) => setSelected(i)}
                />
              </div>
            </div>
          ) : (
            /* 其它态：椭圆虫室 + 座位 + 中央信息 */
            <div className="relative min-h-0 flex-1">
              {view ? (
                <div className="relative h-full w-full">
                  <div
                    className="absolute rounded-[50%] border border-[rgba(227,194,124,.14)]"
                    style={{
                      left: '6%',
                      right: '6%',
                      top: '8%',
                      bottom: '8%',
                      background:
                        'radial-gradient(60% 60% at 50% 50%, rgba(242,169,59,.10), transparent 75%), url("/texture-felt.png")',
                      backgroundSize: 'auto, 512px',
                      boxShadow: 'inset 0 0 80px rgba(7,6,11,.85), 0 24px 80px rgba(0,0,0,.55)',
                    }}
                  />

                  {/* 中央：揭晓结算板 / 其余提示 */}
                  <div className="absolute left-1/2 top-1/2 z-10 w-[min(760px,92%)] -translate-x-1/2 -translate-y-1/2">
                    {revealing && reveal ? (
                      <div className="max-h-[64vh] overflow-y-auto">
                        <FlyRevealBoard
                          reveal={reveal}
                          atlas={FLY_TABLE}
                          seatNames={seatNames}
                          mySeat={mySeat}
                          rageThreshold={view.fly.rageThreshold}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[rgba(227,194,124,.15)] bg-[rgba(12,10,19,.72)] px-8 py-6 backdrop-blur-[8px]">
                        <div
                          className="font-mashan text-[22px]"
                          style={{ color: moodColor }}
                        >
                          {moodMeta.label}
                        </div>
                        <p className="text-[12px] text-dim">
                          本轮蛐蛐偏好 · 果蝇做出该行为概率 ≥ {(FLY_HIT_FLOOR * 100).toFixed(0)}% 才算打中
                        </p>
                        <span className="vertical-rl font-mashan text-[22px] text-[rgba(227,194,124,.55)]">
                          {status === 'waiting'
                            ? '驯虫师落座 · 虫室将启'
                            : '牌已下 · 候虫醒'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 座位 */}
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
                  <span className="vertical-rl font-mashan text-[26px] text-suit-spade/60">
                    星网接驳中
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 上轮速览带 */}
          <div className="mx-4 mb-1 flex h-14 shrink-0 items-center gap-3 overflow-x-auto rounded-xl border border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.6)] px-4">
            {reveal ? (
              <>
                <span className="shrink-0 font-cinzel text-[14px] text-suit-spade">
                  R{reveal.round}
                </span>
                <span className="shrink-0 text-[12px] text-dim">
                  偏好「
                  <span style={{ color: FLY_BEHAVIOR_COLOR[reveal.cricketMood] }}>
                    {FLY_BEHAVIOR_META[reveal.cricketMood].label}
                  </span>
                  」
                </span>
                {Object.keys(reveal.values)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((seat) => {
                    const gain = reveal.gains[seat] ?? 0
                    const cardIdx = reveal.values[seat]
                    const card = FLY_TABLE.cards[cardIdx]
                    return (
                      <span
                        key={seat}
                        className={cn(
                          'shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px]',
                          gain > 0
                            ? 'border-gold-300 text-gold-300'
                            : 'border-[rgba(227,194,124,.2)] text-faint',
                        )}
                      >
                        {seat + 1}座 {card ? `${card.rate}Hz` : `#${cardIdx}`} +{gain}
                      </span>
                    )
                  })}
                <span className="ml-auto shrink-0 font-mono text-[11px] text-faint">
                  怒气 {reveal.rage.toFixed(1)}/{view?.fly.rageThreshold ?? 8}
                  {reveal.raged && <span className="ml-2 text-[#F0655A]">蛐蛐反击 · 全场零分</span>}
                </span>
              </>
            ) : (
              <span className="text-[12px] text-faint">首轮尚未揭晓</span>
            )}
          </div>

          {/* 底部控制台 */}
          <div className="shrink-0 border-t border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.78)] px-4 py-3 backdrop-blur-[12px]">
            <div className="mx-auto flex h-[72px] max-w-[1100px] items-center gap-5">
              {status === 'waiting' && (
                <>
                  {isHost ? (
                    <div className="mx-auto flex items-center gap-4">
                      <GoldButton
                        variant="gold"
                        size="lg"
                        disabled={actMutation.isPending}
                        onClick={() => act({ type: 'start' })}
                      >
                        <Play size={16} /> 开局 · 影从补席
                      </GoldButton>
                      <span className="text-[12px] text-dim">
                        已入座 {view?.seats.length ?? 0} 席 · 空位由影从填充
                      </span>
                    </div>
                  ) : mySeat != null ? (
                    <span className="mx-auto text-[13px] tracking-[.2em] text-dim">
                      已入座 · 静候房主开局
                    </span>
                  ) : isAuthenticated ? (
                    <div className="mx-auto flex items-center gap-4">
                      <GoldButton
                        variant="suit"
                        suit="spade"
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
                    <div className="mx-auto flex items-center gap-4">
                      <GoldButton variant="gold" size="lg" onClick={() => navigate(LOGIN_PATH)}>
                        <Cloud size={16} /> 云登录后入座
                      </GoldButton>
                      <span className="text-[12px] text-dim">
                        旁观中 · 联机入座以云端档案为凭
                      </span>
                    </div>
                  )}
                </>
              )}

              {deckMode && mySeatView && (
                <div className="mx-auto flex items-center gap-5">
                  {mySeatView.submitted ? (
                    <span className="text-[13px] tracking-[.2em] text-dim">
                      已出牌 · 静候揭晓
                    </span>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="text-[12px] text-dim">
                          {picked ? (
                            <>
                              <span className="font-mono text-bone">{picked.id}</span>
                              <span className="mx-2 text-faint">|</span>
                              主导{' '}
                              <span style={{ color: FLY_BEHAVIOR_COLOR[picked.top] }}>
                                {FLY_BEHAVIOR_META[picked.top].label}
                              </span>
                              <span className="mx-2 text-faint">|</span>
                              打中偏好{' '}
                              <span
                                className="font-mono"
                                style={{ color: pickedHit >= FLY_HIT_FLOOR ? moodColor : '#6B6577' }}
                              >
                                {(pickedHit * 100).toFixed(0)}%
                              </span>
                            </>
                          ) : (
                            '从牌桌上择一张刺激牌'
                          )}
                        </div>
                        {picked && pickedHit < FLY_HIT_FLOOR && (
                          <div className="mt-0.5 text-[11px] text-[#F0655A]">
                            低于命中地板 {(FLY_HIT_FLOOR * 100).toFixed(0)}% · 这张牌打不中，得分为 0
                          </div>
                        )}
                      </div>
                      <GoldButton
                        variant="gold"
                        size="lg"
                        disabled={selected == null || actMutation.isPending}
                        onClick={() => selected != null && act({ type: 'choose', choice: selected })}
                      >
                        出牌
                      </GoldButton>
                    </>
                  )}
                  <TimerRing total={submitWindowSec} left={timeLeft} size={52} />
                </div>
              )}
              {deckMode && !mySeatView && (
                <span className="mx-auto text-[13px] tracking-[.2em] text-dim">
                  旁观中 · 第 {view?.round ?? 0} 轮择牌
                </span>
              )}
              {status === 'playing' && phase === 'reveal' && (
                <span className="mx-auto text-[13px] tracking-[.2em] text-dim">
                  虫醒揭晓中… 点座位名可看那张牌的脉冲雨
                </span>
              )}

              {status === 'finished' && (
                <div className="mx-auto flex items-center gap-4">
                  <GoldButton variant="gold" onClick={() => setFinishedOpen(true)}>
                    查看结算
                  </GoldButton>
                  <GoldButton variant="ghost" onClick={() => navigate('/lobby')}>
                    <RotateCcw size={15} /> 返回大厅
                  </GoldButton>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── 右栏：积分 + 星网状态 ── */}
        <aside className="hidden w-[320px] min-h-0 shrink-0 flex-col gap-4 overflow-y-auto border-l border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.55)] p-4 min-[1180px]:flex">
          <OnlineScorePanel seats={view?.seats ?? []} mySeat={mySeat} winner={view?.winner} />
          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">本局参数</div>
            <div className="flex flex-col gap-1 font-mono text-[11px] text-dim">
              <span className="flex justify-between">
                <span>拥挤衰减</span>
                <span className="text-bone">{view?.fly.crowding ?? '—'}</span>
              </span>
              <span className="flex justify-between">
                <span>怒气阈值</span>
                <span className="text-bone">{view?.fly.rageThreshold ?? '—'}</span>
              </span>
              <span className="flex justify-between">
                <span>单轮最高</span>
                <span className="text-bone">{view?.fly.scoreWin ?? '—'}</span>
              </span>
              <span className="flex justify-between">
                <span>善变程度</span>
                <span className="text-bone">{view?.fly.fickleness ?? '—'}</span>
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              撞车按<span className="text-bone">主导行为</span>计数：同行为的果蝇越多，每人分到的越少。
            </p>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">星网状态</div>
            <p className="text-[12px] leading-relaxed text-dim">
              状态每 1.5s 自服务端同步
              {deckMode && (
                <>
                  {' '}
                  · 本轮已出牌{' '}
                  <span className="font-mono text-suit-spade">
                    {view?.submittedCount ?? 0}
                  </span>
                  /{view?.seats.length ?? 0}
                </>
              )}
            </p>
          </div>
          <div className="panel-bg rounded-xl p-3">
            <div className="mb-2 text-[11px] tracking-[.25em] text-faint">花色</div>
            <p className="text-[12px] leading-relaxed text-dim">
              本局门票与结算走 {SUIT_META[view?.entryFee.suit ?? 'spade'].symbol} 玄渊。
              终局碎片自动写入云端档案。
            </p>
          </div>
        </aside>
      </div>

      {view && (
        <OnlineFinishedPanel
          open={finishedOpen && status === 'finished'}
          view={view}
          suit={view.entryFee.suit}
          rewards={view.rewards}
          title="终局 · 虫室封盘"
          onClose={() => setFinishedOpen(false)}
          onExit={() => navigate('/lobby')}
        />
      )}
    </div>
  )
}

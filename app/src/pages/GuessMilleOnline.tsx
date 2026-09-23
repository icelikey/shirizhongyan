/**
 * ============================================================================
 * 千机演算 · 千轮猜数（agent-only）· /game/online-mille/:code
 * ----------------------------------------------------------------------------
 * 沿用 numberGuess 模板执行器（guess-mille-core = 200 轮 / 10s 窗 / agent-only），
 * 但演出完全不同：本页不提供人类落子界面（agent-only 之局人类无法入座），
 * 核心是 level-k 收敛曲线——把 view.history（全部已揭晓轮次）画成折线图，
 * 观众能看到各 Agent 的出数分布随轮次向纳什均衡点收缩。
 *
 * 性能要点：recharts 数据集只在 history 长度变化时用 useMemo 重新计算，
 * 而不是每次 1.5s 轮询都重建整个数组——否则几百轮后每次 tick 都要重算
 * 全量数据，会明显卡顿。
 * ============================================================================
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { trpc } from '@/providers/trpc'
import type { GuessReveal, GuessRoomView } from '@contracts/room'
import GameTopBar from '@/components/game/GameTopBar'
import GoldButton from '@/components/GoldButton'
import { RotateCcw } from 'lucide-react'

const SEAT_COLORS = ['#4ECB9C', '#EE6A72', '#8B93F8', '#F2A93B', '#5CC8E8', '#D97BD9']

const STATUS_TEXT: Record<string, string> = {
  waiting: '待开局 · 静候外来 Agent 落座 0 号席',
  playing: '演算进行中',
  finished: '已终局',
}

export default function GuessMilleOnline() {
  const { code = '' } = useParams()
  const CODE = code.toUpperCase()
  const navigate = useNavigate()

  const stateQuery = trpc.room.state.useQuery(
    { code: CODE },
    { refetchInterval: 1200, retry: 1 },
  )
  const view = stateQuery.data as GuessRoomView | undefined
  const history = (view?.history ?? []) as GuessReveal[]

  const [selectedSeats, setSelectedSeats] = useState<Set<number>>(new Set())

  /** 座位号 → 名称（用于图例与筛选） */
  const seatNames = useMemo(() => {
    const map: Record<number, string> = {}
    view?.seats.forEach((s) => {
      map[s.index] = s.name
    })
    return map
  }, [view?.seats])

  /**
   * 图表数据：仅在 history 长度变化时重算（1.5s 轮询若无新轮次不会重建数组），
   * 每个点含 round / average / target / 各座位出数。
   */
  const chartData = useMemo(() => {
    return history.map((r) => {
      const row: Record<string, number> = {
        round: r.round,
        average: r.average,
        target: r.target,
      }
      Object.entries(r.values).forEach(([seat, value]) => {
        row[`seat${seat}`] = value
      })
      return row
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.length])

  const seatIndexes = view?.seats.map((s) => s.index) ?? []
  const visibleSeats =
    selectedSeats.size === 0 ? seatIndexes : seatIndexes.filter((i) => selectedSeats.has(i))

  const toggleSeat = (i: number) => {
    setSelectedSeats((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const status = view?.status ?? 'waiting'
  const round = view?.round ?? 0
  const totalRounds = view?.totalRounds ?? 200

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
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/bg-abacus-court.png")', filter: 'brightness(.45)' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(78,203,156,.12), transparent)' }} />

      <GameTopBar
        suit="club"
        room={`千机演算 · ${view?.roomName ?? CODE} · ${CODE}`}
        phase={
          <span>
            {status === 'playing' ? `第 ${round} / ${totalRounds} 轮` : STATUS_TEXT[status]}
          </span>
        }
        pool={view ? view.rewards.winner + view.rewards.runnerUp + view.rewards.participation : 80}
        onExit={() => navigate('/lobby')}
      />

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* 左栏：座位与积分 */}
        <aside className="w-[260px] shrink-0 hidden min-[900px]:flex flex-col gap-3 p-4 border-r border-[rgba(227,194,124,.10)] bg-[rgba(12,10,19,.6)] overflow-y-auto">
          <div className="text-[11px] tracking-[.25em] text-faint mb-1">Agent 席位 · 点选筛选曲线</div>
          {(view?.seats ?? []).map((s) => {
            const color = SEAT_COLORS[s.index % SEAT_COLORS.length]
            const active = selectedSeats.size === 0 || selectedSeats.has(s.index)
            return (
              <button
                key={s.index}
                type="button"
                onClick={() => toggleSeat(s.index)}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: active ? `${color}66` : 'rgba(227,194,124,.12)',
                  background: active ? `${color}14` : 'transparent',
                  opacity: active ? 1 : 0.4,
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="flex-1 min-w-0 truncate text-[12px] text-bone">{s.name}</span>
                <span className="font-mono text-[12px] text-gold-300">{s.score}</span>
              </button>
            )
          })}
          {selectedSeats.size > 0 && (
            <button
              type="button"
              className="text-[11px] text-faint underline underline-offset-2"
              onClick={() => setSelectedSeats(new Set())}
            >
              清除筛选
            </button>
          )}
          {view && view.seats.length === 0 && (
            <p className="text-[12px] text-faint leading-relaxed">
              暂无席位。请用外来 Agent Key 调用 agent.gatewayJoin 落座 0 号席，
              再调用 agent.gatewayAct 提交 start 开局。
            </p>
          )}
        </aside>

        {/* 中央：收敛曲线 */}
        <main className="flex-1 relative min-w-0 flex flex-col p-4 gap-3">
          <div className="panel-bg rounded-xl p-3 text-[12px] text-dim leading-relaxed">
            0–100 出数 · 目标 = 均值 × 2/3 · {totalRounds} 轮 · 10s 提交窗（agent-only，无人类席）。
            折线图展示各 Agent 每轮出数与均值/目标的收敛过程——这是「分布式智能」相对人类局
            最有说服力的演出：没有人能陪玩 {totalRounds} 轮。
          </div>
          <div className="flex-1 min-h-0 panel-bg rounded-xl p-3">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-[13px] text-faint tracking-[.2em]">
                  {status === 'waiting' ? '尚未开局，暂无演算数据' : '首轮演算进行中…'}
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="rgba(227,194,124,.08)" />
                  <XAxis dataKey="round" stroke="rgba(242,234,216,.4)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="rgba(242,234,216,.4)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#14101C', border: '1px solid rgba(227,194,124,.28)', fontSize: 12 }}
                    labelFormatter={(r) => `第 ${r} 轮`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="目标值"
                    stroke="#E3C27C"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {visibleSeats.map((i) => (
                    <Line
                      key={i}
                      type="monotone"
                      dataKey={`seat${i}`}
                      name={seatNames[i] ?? `座位 ${i}`}
                      stroke={SEAT_COLORS[i % SEAT_COLORS.length]}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {status === 'finished' && (
            <div className="shrink-0 flex items-center justify-center gap-4 py-2">
              <span className="text-[13px] text-gold-300">
                终局 · 冠军座位 {view?.winner != null ? seatNames[view.winner] ?? view.winner : '—'}
              </span>
              <GoldButton variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
                <RotateCcw size={14} /> 返回大厅
              </GoldButton>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

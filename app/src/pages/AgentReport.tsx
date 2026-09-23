import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Bot, Clock3, Compass, Crown, Sparkles, type LucideIcon } from 'lucide-react'
import { useParams, useSearchParams } from 'react-router-dom'
import MaskIcon from '@/components/MaskIcon'

type ReportPayload = {
  report?: {
    summary?: string
    stats?: {
      date?: string
      events?: number
      actions?: number
      matches?: number
      victories?: number
      encounters?: number
      games?: string[]
    }
  }
  snapshot?: {
    agent?: { agentId: number; name: string; active: boolean; lastUsedAt: string | null }
    profile?: {
      nickname: string
      tier: string
      fragments: Record<string, number>
      companion?: { customName?: string; bond?: number } | null
    } | null
    cards?: Array<{ cardId: string; kind: string; count: number; source: string }>
    activities?: Array<{ id: number; kind: string; title: string; detail?: string | null; occurredAt: string }>
  }
}

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: .45, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

function fmtTime(value: string | null | undefined) {
  if (!value) return '尚未活动'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export default function AgentReport() {
  const { agentId } = useParams()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<ReportPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const token = searchParams.get('token') || ''

  useEffect(() => {
    if (!agentId || !token) {
      setError('这是一条只读日报链接，请使用 Agent 注册时生成的完整链接。')
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(`/world/v1/agents/${encodeURIComponent(agentId)}/report?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json() as ReportPayload & { error?: { message?: string } }
        if (!response.ok) throw new Error(payload.error?.message || '日报暂时无法读取')
        if (!cancelled) setData(payload)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '日报暂时无法读取')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [agentId, token])

  const stats = data?.report?.stats || {}
  const snapshot = data?.snapshot
  const profile = snapshot?.profile

  return (
    <main className="min-h-screen bg-ink px-5 py-8 text-bone sm:px-8 sm:py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(155,127,232,.14),transparent_30%),radial-gradient(circle_at_12%_90%,rgba(227,194,124,.08),transparent_28%)]" />
      <div className="relative mx-auto max-w-[1120px]">
        <motion.header {...enter(0)} className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[.3em] text-faint"><MaskIcon src="/logo-mark.svg" size={18} color="#E3C27C" /> 终焉 · 影从日报</div>
            <h1 className="gold-text font-serifsc text-[34px] font-black tracking-[.1em]">{snapshot?.agent?.name || 'Agent 活动档案'}</h1>
            <p className="mt-1 text-[12px] tracking-[.2em] text-faint">在牌局之外，查看它如何探索、成长与留下奇遇</p>
          </div>
          {snapshot?.agent && (
            <div className="rounded-full border border-[rgba(227,194,124,.18)] bg-black/20 px-4 py-2 text-[11px] text-dim">
              <span className={snapshot.agent.active ? 'text-suit-club' : 'text-cinnabar-hi'}>● {snapshot.agent.active ? '在线凭证' : '已吊销'}</span>
              <span className="mx-2 text-faint">·</span>
              最近活动 {fmtTime(snapshot.agent.lastUsedAt)}
            </div>
          )}
        </motion.header>

        {loading && <div className="panel-bg rounded-2xl p-8 text-center text-[13px] text-dim">正在从世界事件流读取日报…</div>}
        {!loading && error && <div className="rounded-2xl border border-cinnabar-hi/30 bg-cinnabar-hi/5 p-8 text-center text-[13px] leading-7 text-dim">{error}</div>}

        {!loading && !error && data && (
          <div className="flex flex-col gap-6">
            <motion.section {...enter(.05)} className="panel-bg rounded-2xl border border-[rgba(227,194,124,.16)] p-6 sm:p-8">
              <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[.28em] text-suit-diamond"><Sparkles size={14} /> 今日简报 · {stats.date || '今日'}</div>
              <p className="max-w-[850px] font-serifsc text-[21px] leading-9 text-bone/90">{data.report?.summary || '影从今日尚无新记录。'}</p>
            </motion.section>

            <motion.section {...enter(.1)} className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {([
                ['活动', stats.events || 0, Activity],
                ['行动', stats.actions || 0, Compass],
                ['牌局', stats.matches || 0, Crown],
                ['胜场', stats.victories || 0, Sparkles],
                ['奇遇', stats.encounters || 0, Bot],
              ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
                <div key={String(label)} className="panel-bg rounded-2xl p-4">
                  <Icon size={16} className="mb-3 text-gold-300" />
                  <div className="font-cinzel text-[25px] text-bone">{String(value)}</div>
                  <div className="mt-1 text-[10px] tracking-[.2em] text-faint">{String(label)}</div>
                </div>
              ))}
            </motion.section>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(280px,5fr)]">
              <motion.section {...enter(.15)} className="panel-bg rounded-2xl p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h2 className="font-serifsc text-[20px] text-bone">最近活动</h2><p className="mt-1 text-[11px] text-faint">来自真实 Gateway 行动与 Worker 自主探索</p></div>
                  <Clock3 size={17} className="text-suit-diamond" />
                </div>
                <div className="flex flex-col gap-2">
                  {(snapshot?.activities || []).slice(0, 18).map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/[.07] bg-black/15 px-4 py-3">
                      <div className="flex items-start justify-between gap-3"><span className="text-[13px] text-bone/90">{item.title}</span><time className="shrink-0 text-[10px] text-faint">{fmtTime(item.occurredAt)}</time></div>
                      {item.detail && <p className="mt-1 text-[11px] leading-5 text-dim">{item.detail}</p>}
                    </div>
                  ))}
                  {!snapshot?.activities?.length && <p className="py-8 text-center text-[12px] text-faint">今日还没有活动事件。</p>}
                </div>
              </motion.section>

              <motion.aside {...enter(.2)} className="flex flex-col gap-6">
                <div className="panel-bg rounded-2xl p-6">
                  <h2 className="font-serifsc text-[20px] text-bone">成长档案</h2>
                  {profile ? (
                    <div className="mt-4 flex flex-col gap-3 text-[12px] text-dim">
                      <div className="flex items-center justify-between"><span>当前位阶</span><span className="text-gold-200">{profile.tier}</span></div>
                      <div className="flex items-center justify-between"><span>契约影从</span><span className="text-suit-diamond">{profile.companion?.customName || profile.nickname}</span></div>
                      <div className="flex items-center justify-between"><span>羁绊</span><span className="text-suit-club">Lv.{profile.companion?.bond || 0}</span></div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {Object.entries(profile.fragments || {}).map(([suit, value]) => <div key={suit} className="rounded-lg border border-white/[.07] bg-black/15 p-2 text-center"><div className="font-cinzel text-[16px] text-bone">{value}</div><div className="mt-1 text-[9px] text-faint">{suit}</div></div>)}
                      </div>
                    </div>
                  ) : <p className="mt-4 text-[12px] text-faint">档案尚未同步。</p>}
                </div>
                <div className="panel-bg rounded-2xl p-6">
                  <h2 className="font-serifsc text-[20px] text-bone">获得卡牌</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(snapshot?.cards || []).slice(0, 12).map((card) => <span key={card.cardId} className="rounded-full border border-[rgba(227,194,124,.18)] bg-gold-300/[.06] px-3 py-1.5 text-[10px] text-gold-100">{card.cardId} ×{card.count}</span>)}
                    {!snapshot?.cards?.length && <span className="text-[12px] text-faint">牌匣尚空，下一场奇遇正在路上。</span>}
                  </div>
                </div>
                <div className="rounded-2xl border border-suit-diamond/20 bg-suit-diamond/[.05] p-5 text-[11px] leading-6 text-dim">
                  <span className="text-suit-diamond">只读报告</span> · 此页面只能读取活动、日报和成长快照，不能代替 Agent 发起行动。若要继续探索，请运行仓库中的 `scripts/tdg-agent-worker.mjs`。
                </div>
              </motion.aside>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

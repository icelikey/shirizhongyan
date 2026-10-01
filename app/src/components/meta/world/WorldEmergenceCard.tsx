import { useEffect, useMemo, useState } from 'react'
import { Compass, Eye, Fingerprint, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Direction = 'law' | 'voice' | 'trust' | 'rupture' | 'memory'

type WorldState = {
  worldId: string
  epoch: number
  direction: Direction | null
  directionTallies: Array<{
    direction: Direction
    score: number
    participants: number
    share: number
  }>
  contributionsAccepted: number
  uniqueParticipants: number
  truthShards: Array<{
    clueId: string
    confidence: number
    status: 'rumor' | 'confirmed'
  }>
  publicAnchors: string[]
  checksum: string | null
  status: string
}

const DIRECTION_META: Record<Direction, { label: string; hint: string; color: string }> = {
  law: { label: '律', hint: '规则、裁判与可验证事实', color: 'text-suit-diamond' },
  voice: { label: '声', hint: '发言、叙事与社会共识', color: 'text-suit-heart' },
  trust: { label: '契', hint: '协作、承诺与互惠', color: 'text-suit-club' },
  rupture: { label: '裂', hint: '背叛、异常与小概率转折', color: 'text-cinnabar-hi' },
  memory: { label: '忆', hint: '残卷、轮回与跨局连续性', color: 'text-suit-spade' },
}

function directionLabel(direction: Direction | null) {
  return direction ? DIRECTION_META[direction].label : '未定'
}

export default function WorldEmergenceCard() {
  const [state, setState] = useState<WorldState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}world/v1/world/state`, { headers: { accept: 'application/json' } })
        if (!response.ok) throw new Error('world state unavailable')
        const payload = await response.json() as { world?: WorldState }
        if (active && payload.world) {
          setState(payload.world)
          setError(false)
        }
      } catch {
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(load, 15_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const leading = useMemo(() => {
    if (!state) return null
    return [...state.directionTallies].sort((a, b) => b.score - a.score || b.participants - a.participants)[0]
  }, [state])

  return (
    <section className="panel-bg relative overflow-hidden rounded-[14px] p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-suit-spade/[.08] blur-3xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] tracking-[.26em] text-suit-diamond"><Compass size={13} /> 服务器世界</div>
          <h3 className="mt-1 font-serifsc text-[18px] text-bone">众念正在定向</h3>
          <p className="mt-1 text-[10px] leading-4 text-faint">每一次真实结算，都会为终焉留下一个可复核的脚印。</p>
        </div>
        <RefreshCw size={14} className={cn('text-faint', loading && 'animate-spin')} />
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-cinnabar/25 bg-cinnabar/[.06] px-3 py-3 text-[11px] leading-5 text-cinnabar-hi">世界回声暂时不可读，下一次刷新会继续尝试。</p>
      ) : !state ? (
        <p className="mt-5 text-[11px] text-faint">正在读取本服务器的第一纪元……</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><p className="font-mono text-[17px] text-bone">{state.epoch || '—'}</p><p className="mt-1 text-[9px] text-faint">纪元</p></div>
            <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><p className="font-mono text-[17px] text-bone">{state.uniqueParticipants}</p><p className="mt-1 text-[9px] text-faint">独立参与者</p></div>
            <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><p className="font-mono text-[17px] text-bone">{state.truthShards.filter((shard) => shard.status === 'confirmed').length}</p><p className="mt-1 text-[9px] text-faint">已确认真相</p></div>
          </div>

          <div className="mt-4 rounded-xl border border-[rgba(227,194,124,.14)] bg-black/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-faint">当前世界倾向</span>
              <span className={cn('font-serifsc text-[16px]', state.direction ? DIRECTION_META[state.direction].color : 'text-faint')}>{directionLabel(state.direction)}</span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-dim">{state.direction ? DIRECTION_META[state.direction].hint : `还需要 ${Math.max(0, 3 - state.uniqueParticipants)} 名独立参与者，方向才会改变。`}</p>
            {leading && leading.score > 0 && <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full bg-gold-300 transition-all" style={{ width: `${Math.max(4, leading.share * 100)}%` }} /></div>}
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] text-faint"><span className="flex items-center gap-1.5"><Eye size={12} /> {state.contributionsAccepted} 条公开贡献</span><span className="flex items-center gap-1.5"><Sparkles size={12} /> {state.truthShards.length} 条线索</span></div>
          <div className="mt-3 flex items-center gap-2 border-t border-white/[.07] pt-3 text-[9px] text-faint"><Fingerprint size={12} className="shrink-0 text-suit-diamond" /><span className="truncate">{state.checksum ? `世界快照 ${state.checksum.slice(0, 12)}…` : '世界尚未形成快照'}</span></div>
          <p className="mt-3 text-[10px] italic leading-4 text-faint">“真相不是谁宣布的；它是不同的人，在不同的游戏里，反复撞见同一件事。”</p>
        </>
      )}
    </section>
  )
}

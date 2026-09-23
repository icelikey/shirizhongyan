import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, Bot, DoorOpen, Flag, KeyRound, Map, MessageCircle, ScrollText, Sparkles } from 'lucide-react'
import ParticipationModes from '@/components/online/ParticipationModes'
import { cn } from '@/lib/utils'

const MAP_WIDTH = 14
const MAP_HEIGHT = 8

type Point = { x: number; y: number }
type Landmark = Point & {
  id: 'gate' | 'rules' | 'gateway' | 'race'
  label: string
  detail: string
  color: string
  icon: typeof DoorOpen
}

const WALLS = new Set(['4,1', '5,1', '6,1', '8,2', '8,3', '3,4', '4,4', '10,5', '10,6', '11,6'])
const LANDMARKS: Landmark[] = [
  { id: 'gate', x: 1, y: 6, label: '入界门', detail: '从这里开始你的第一段世界记忆。', color: '#E3C27C', icon: DoorOpen },
  { id: 'rules', x: 4, y: 2, label: '规则碑', detail: '共同事实由内核守护，争议交给奇数裁判。', color: '#8B93F8', icon: ScrollText },
  { id: 'gateway', x: 9, y: 1, label: 'Agent 接入台', detail: '公开注册后，任何外部 Agent 都可以入座。', color: '#4ECB9C', icon: KeyRound },
  { id: 'race', x: 12, y: 6, label: '百格赛道', detail: '下一站：超能力赛马与可回放的奇迹事件。', color: '#F2A93B', icon: Flag },
]

const INITIAL_POSITION: Point = { x: 2, y: 6 }

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

function keyOf(point: Point) {
  return `${point.x},${point.y}`
}

export default function EntryWorld() {
  const [position, setPosition] = useState<Point>(INITIAL_POSITION)
  const [visited, setVisited] = useState<string[]>(['gate'])
  const [logs, setLogs] = useState<string[]>(['第零日 · 你在终焉的边界醒来。用 WASD 走近世界。'])
  const currentLandmark = useMemo(() => LANDMARKS.find((landmark) => samePoint(landmark, position)), [position])

  const appendLog = useCallback((message: string) => {
    setLogs((previous) => [...previous, message].slice(-6))
  }, [])

  const interact = useCallback((landmark: Landmark) => {
    setVisited((previous) => (previous.includes(landmark.id) ? previous : [...previous, landmark.id]))
    appendLog(`${landmark.label} · ${landmark.detail}`)
  }, [appendLog])

  const move = useCallback((dx: number, dy: number) => {
    setPosition((previous) => {
      const next = { x: Math.max(0, Math.min(MAP_WIDTH - 1, previous.x + dx)), y: Math.max(0, Math.min(MAP_HEIGHT - 1, previous.y + dy)) }
      if (samePoint(previous, next)) return previous
      if (WALLS.has(keyOf(next))) {
        appendLog('前方是未解的世界断层，暂时无法通过。')
        return previous
      }
      const landmark = LANDMARKS.find((item) => samePoint(item, next))
      if (landmark) interact(landmark)
      return next
    })
  }, [appendLog, interact])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const directions: Record<string, Point> = {
        w: { x: 0, y: -1 }, arrowup: { x: 0, y: -1 },
        s: { x: 0, y: 1 }, arrowdown: { x: 0, y: 1 },
        a: { x: -1, y: 0 }, arrowleft: { x: -1, y: 0 },
        d: { x: 1, y: 0 }, arrowright: { x: 1, y: 0 },
      }
      const direction = directions[key]
      if (!direction) return
      event.preventDefault()
      move(direction.x, direction.y)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move])

  const reset = () => {
    setPosition(INITIAL_POSITION)
    setVisited(['gate'])
    setLogs(['第零日 · 你回到入界门。世界仍在等你移动。'])
  }

  return (
    <div className="min-h-[100dvh] bg-abyss px-4 py-5 text-bone sm:px-8">
      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 border-b border-bone/10 pb-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold-300/50 text-gold-300">终</span>
          <span>
            <span className="gold-text block font-serifsc text-[18px] font-black tracking-[.16em]">终焉</span>
            <span className="block text-[9px] tracking-[.28em] text-faint">THE WORLD IS LISTENING</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-[11px] tracking-[.18em] text-faint">
          <span className="h-2 w-2 animate-pulse rounded-full bg-suit-club" />
          世界内核 · 在线
          <Link to="/agent-portal" className="ml-3 rounded-full border border-suit-diamond/40 px-3 py-1.5 text-suit-diamond transition-colors hover:bg-suit-diamond/10">Agent 接入</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] tracking-[.32em] text-suit-diamond">第零日 · 入界试炼</p>
            <h1 className="gold-text font-serifsc text-[32px] font-black tracking-[.1em] sm:text-[42px]">先走一步，世界才会回应</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-dim">这是终焉的第一块可操作世界。你可以亲自移动，也可以让自己的 Agent 从接入台进入；每一次选择都会留下世界事件。</p>
          </div>
          <button type="button" onClick={reset} className="rounded-full border border-bone/15 px-4 py-2 text-[12px] text-dim transition-colors hover:border-gold-300/50 hover:text-gold-300">重置入界</button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="panel-bg rounded-2xl p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] tracking-[.2em] text-gold-300"><Map size={15} /> 入界地图 · 14 × 8</div>
              <span className="font-mono text-[11px] text-faint">坐标 ({position.x + 1}, {position.y + 1})</span>
            </div>
            <div className="rounded-xl border border-gold-300/20 bg-[#0A0B12] p-2 shadow-[inset_0_0_40px_rgba(139,147,248,.08)] sm:p-4">
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${MAP_WIDTH}, minmax(0, 1fr))` }} aria-label="WASD 入界地图">
                {Array.from({ length: MAP_WIDTH * MAP_HEIGHT }, (_, index) => {
                  const tile = { x: index % MAP_WIDTH, y: Math.floor(index / MAP_WIDTH) }
                  const wall = WALLS.has(keyOf(tile))
                  const landmark = LANDMARKS.find((item) => samePoint(item, tile))
                  const player = samePoint(tile, position)
                  const LandmarkIcon = landmark?.icon
                  return (
                    <button
                      type="button"
                      key={keyOf(tile)}
                      onClick={() => landmark && interact(landmark)}
                      className={cn(
                        'relative aspect-square rounded-[5px] border text-[10px] transition-all sm:rounded-lg',
                        wall ? 'cursor-not-allowed border-transparent bg-[#191627]' : 'border-bone/10 bg-[#101421] hover:border-bone/25',
                        player && 'z-10 border-gold-100 bg-gold-300/20 shadow-[0_0_20px_rgba(227,194,124,.65)]',
                      )}
                      style={landmark ? { borderColor: `${landmark.color}88`, color: landmark.color, background: `${landmark.color}12` } : undefined}
                      aria-label={landmark?.label ?? `地图坐标 ${tile.x + 1},${tile.y + 1}`}
                    >
                      {wall && <span className="absolute inset-1 rounded-sm bg-[linear-gradient(135deg,transparent_45%,rgba(227,194,124,.12)_46%,transparent_54%)]" />}
                      {landmark && LandmarkIcon && <LandmarkIcon size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 sm:h-4 sm:w-4" />}
                      {player && <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-100 shadow-[0_0_12px_#F8E9C0] sm:h-4 sm:w-4" />}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-faint">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-gold-100 shadow-[0_0_8px_#F8E9C0]" />你</span>
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded border border-suit-diamond" />可交互节点</span>
                <span>键盘 WASD / 方向键移动</span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2 sm:hidden">
              <button type="button" onClick={() => move(0, -1)} className="rounded-lg border border-bone/15 px-4 py-2 text-gold-300">W</button>
              <button type="button" onClick={() => move(-1, 0)} className="rounded-lg border border-bone/15 px-4 py-2 text-gold-300">A</button>
              <button type="button" onClick={() => move(0, 1)} className="rounded-lg border border-bone/15 px-4 py-2 text-gold-300">S</button>
              <button type="button" onClick={() => move(1, 0)} className="rounded-lg border border-bone/15 px-4 py-2 text-gold-300">D</button>
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="panel-bg rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[.25em] text-suit-club"><Sparkles size={14} /> 当前回响</div>
              <h2 className="font-serifsc text-[21px] text-bone">{currentLandmark?.label ?? '无名坐标'}</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-dim">{currentLandmark?.detail ?? '移动到发光节点，触发一段可验证的世界事件。'}</p>
              {currentLandmark?.id === 'gateway' && <Link to="/agent-portal" className="mt-4 inline-flex items-center gap-2 rounded-full bg-suit-club/15 px-4 py-2 text-[12px] text-suit-club hover:bg-suit-club/25"><KeyRound size={14} /> 去注册 Agent</Link>}
              {currentLandmark?.id === 'race' && <Link to="/lobby" className="mt-4 inline-flex items-center gap-2 rounded-full bg-suit-diamond/15 px-4 py-2 text-[12px] text-suit-diamond hover:bg-suit-diamond/25"><Flag size={14} /> 进入对局大厅</Link>}
            </section>
            <section className="panel-bg rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[.25em] text-suit-spade"><MessageCircle size={14} /> 世界事件流</div>
              <div className="flex flex-col gap-2">
                {logs.map((log, index) => <p key={`${log}-${index}`} className={cn('border-l-2 border-bone/10 pl-3 text-[11px] leading-relaxed text-dim', index === logs.length - 1 && 'border-suit-diamond text-bone')}>{log}</p>)}
              </div>
            </section>
            <section className="panel-bg rounded-2xl p-5">
              <div className="mb-3 flex items-center gap-2 text-[11px] tracking-[.25em] text-suit-diamond"><Bot size={14} /> 入界状态</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-bone/10 bg-ink/50 p-3"><span className="block text-faint">已触达节点</span><span className="mt-1 block font-mono text-[18px] text-gold-300">{visited.length}/4</span></div>
                <div className="rounded-lg border border-bone/10 bg-ink/50 p-3"><span className="block text-faint">Agent 状态</span><span className="mt-1 block text-suit-club">待接入</span></div>
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-5">
          <ParticipationModes />
        </div>
        <div className="mt-4 flex items-center gap-2 text-[11px] text-faint"><ArrowDown size={13} className="text-suit-diamond" />移动到节点后，终焉会把你的选择写入对局历史；正式对局与外部 Agent 使用同一套世界内核。</div>
      </main>
    </div>
  )
}

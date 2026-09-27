import { useEffect } from 'react'
import { BrainCircuit, CalendarDays, HeartPulse, Layers3, RotateCcw, Sparkles } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { floorCrisis, memoryCapacity, WORLD_MEMORY_CARDS, WORLD_MAP_FRAGMENTS, WORLD_NOTE_SCROLLS, DAILY_GAME_QUOTA } from '@contracts/worldCycle'
import { cn } from '@/lib/utils'

export default function WorldCycleCard() {
  const world = useProfile((s) => s.world)
  const reconcile = useProfile((s) => s.reconcileWorldClock)
  const equipMemory = useProfile((s) => s.equipWorldMemory)

  useEffect(() => {
    reconcile()
    const timer = window.setInterval(() => reconcile(), 60_000)
    return () => window.clearInterval(timer)
  }, [reconcile])

  const crisis = floorCrisis(world.floor)
  const lifePct = Math.max(0, Math.min(100, (world.lifeScore / world.maxLifeScore) * 100))
  const loaded = new Set(world.equippedMemoryIds)
  const capacity = memoryCapacity(world)

  return (
    <section className="panel-bg rounded-2xl border border-[rgba(227,194,124,.16)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] tracking-[.26em] text-suit-diamond"><RotateCcw size={13} /> 世界轮回</div>
          <h2 className="mt-1 font-serifsc text-[21px] text-bone">第 {world.cycle} 轮 · 第 {world.day} 日</h2>
          <p className="mt-1 text-[11px] text-faint">每天三局，缺席会从生命积分里扣账</p>
        </div>
        <div className={cn('rounded-full border px-3 py-1.5 text-[11px]', world.status === 'alive' ? 'border-suit-club/30 text-suit-club' : 'border-cinnabar/40 text-cinnabar-hi')}>
          {world.status === 'alive' ? '存活' : world.status === 'dead' ? '等待轮回' : '已离开终焉'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><HeartPulse size={14} className="mb-2 text-suit-diamond" /><p className="font-mono text-[18px] text-bone">{world.lifeScore}<span className="text-[11px] text-faint">/{world.maxLifeScore}</span></p><p className="mt-1 text-[10px] text-faint">生命积分</p></div>
        <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><Layers3 size={14} className="mb-2 text-suit-spade" /><p className="font-mono text-[18px] text-bone">{world.floor}<span className="text-[11px] text-faint">/48</span></p><p className="mt-1 text-[10px] text-faint">当前层</p></div>
        <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><CalendarDays size={14} className="mb-2 text-suit-club" /><p className="font-mono text-[18px] text-bone">{world.playedToday}<span className="text-[11px] text-faint">/{DAILY_GAME_QUOTA}</span></p><p className="mt-1 text-[10px] text-faint">今日已战</p></div>
        <div className="rounded-xl border border-white/[.07] bg-black/15 p-3"><BrainCircuit size={14} className="mb-2 text-suit-heart" /><p className="font-mono text-[18px] text-bone">{world.ability.name}<span className="text-[11px] text-faint"> Lv.{world.ability.level}</span></p><p className="mt-1 text-[10px] text-faint">携带异能</p></div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] text-faint"><span>生命线</span><span>{crisis.title} · 临界 {crisis.threshold}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[.08]"><div className={cn('h-full rounded-full transition-all', world.lifeScore <= crisis.threshold ? 'bg-cinnabar-hi' : 'bg-suit-diamond')} style={{ width: `${lifePct}%` }} /></div>
        <p className="mt-2 text-[11px] leading-5 text-dim">第 {crisis.floor} 层起：{crisis.rule}</p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-[12px] text-bone">Agent 记忆载荷</p><p className="mt-1 text-[10px] text-faint">每次决策前加载 {world.equippedMemoryIds.length}/{capacity} 张 · 异能额外容量 +{world.ability.memorySlotsBonus}</p></div><Sparkles size={15} className="text-suit-diamond" /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {WORLD_MEMORY_CARDS.filter((card) => world.memoryCards.includes(card.id)).map((card) => {
          const active = loaded.has(card.id)
          const disabled = !active && world.equippedMemoryIds.length >= capacity
          return <button key={card.id} type="button" disabled={disabled} onClick={() => equipMemory(card.id, !active)} className={cn('rounded-xl border px-3 py-2 text-left transition-colors', active ? 'border-suit-diamond/40 bg-suit-diamond/[.07]' : 'border-white/[.08] bg-black/10', disabled && 'cursor-not-allowed opacity-40')}><div className="flex items-center justify-between gap-2"><span className="text-[12px] text-bone">{card.title}</span><span className="text-[9px] text-faint">{active ? '已加载' : '待加载'}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-dim">{card.summary}</p></button>
        })}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[.07] bg-black/10 p-3">
          <p className="text-[11px] text-bone">地图碎片 · {world.mapFragments.length}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {world.mapFragments.map((id) => <p key={id} className="text-[10px] leading-4 text-dim">{WORLD_MAP_FRAGMENTS.find((fragment) => fragment.id === id)?.title ?? id}</p>)}
            {!world.mapFragments.length && <p className="text-[10px] text-faint">抵达危机楼层后，地图会显出新的边角。</p>}
          </div>
        </div>
        <div className="rounded-xl border border-white/[.07] bg-black/10 p-3">
          <p className="text-[11px] text-bone">笔记残卷 · {world.noteScrolls.length}</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {world.noteScrolls.map((id) => <p key={id} className="text-[10px] leading-4 text-dim">{WORLD_NOTE_SCROLLS.find((note) => note.id === id)?.title ?? id}</p>)}
            {!world.noteScrolls.length && <p className="text-[10px] text-faint">尚无残卷；每个地点都可能留下可复核的句子。</p>}
          </div>
        </div>
      </div>
      {world.triggeredClueIds.length > 0 && <p className="mt-3 text-[10px] text-suit-diamond">已触发线索 {world.triggeredClueIds.length} 条 · Agent 将在下一次观测时读取。</p>}
      {world.lastEvent && <p className="mt-4 border-t border-white/[.07] pt-3 text-[11px] text-faint">最近世界事件：{world.lastEvent}</p>}
    </section>
  )
}

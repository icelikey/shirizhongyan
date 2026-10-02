import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  CircleDot,
  Clock3,
  Eye,
  Filter,
  History,
  Layers3,
  Link2,
  MapPin,
  Orbit,
  Search,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CSSProperties, ComponentType } from 'react'
import { cn } from '@/lib/utils'
import type {
  WorldKnowledgeClue,
  WorldKnowledgeClueState,
  WorldKnowledgeEvent,
  WorldKnowledgeEventSeverity,
  WorldKnowledgeNode,
  WorldKnowledgeNodeKind,
  WorldKnowledgeNodeStatus,
} from './world.types'

export interface WorldKnowledgeBoardProps {
  nodes: WorldKnowledgeNode[]
  events: WorldKnowledgeEvent[]
  clues?: WorldKnowledgeClue[]
  title?: string
  subtitle?: string
  defaultNodeId?: string | null
  selectedNodeId?: string | null
  defaultTrack?: WorldTrack
  onNodeSelect?: (nodeId: string | null, node: WorldKnowledgeNode | undefined) => void
  onEventSelect?: (event: WorldKnowledgeEvent) => void
  onClueOpen?: (clue: WorldKnowledgeClue) => void
  onClueStateChange?: (clue: WorldKnowledgeClue, state: WorldKnowledgeClueState) => void
  className?: string
}

export type WorldTrack = 'knowledge' | 'events'
type KindFilter = 'all' | WorldKnowledgeNodeKind

interface KindMeta {
  label: string
  color: string
  icon: ComponentType<{ size?: number; className?: string }>
}

const KIND_META: Record<WorldKnowledgeNodeKind, KindMeta> = {
  lore: { label: '法则', color: '#E3C27C', icon: BookOpen },
  place: { label: '地景', color: '#8B93F8', icon: MapPin },
  faction: { label: '阵营', color: '#EE6A72', icon: Orbit },
  relic: { label: '遗物', color: '#4ECB9C', icon: Sparkles },
}

const STATUS_META: Record<WorldKnowledgeNodeStatus, { label: string; color: string }> = {
  known: { label: '已校准', color: '#4ECB9C' },
  unstable: { label: '回响不稳', color: '#F2A93B' },
  sealed: { label: '封存', color: '#8B93F8' },
}

const SEVERITY_META: Record<WorldKnowledgeEventSeverity, { label: string; color: string; icon: ComponentType<{ size?: number; className?: string }> }> = {
  signal: { label: '信号', color: '#4ECB9C', icon: CircleDot },
  warning: { label: '偏移', color: '#F2A93B', icon: CircleAlert },
  critical: { label: '临界', color: '#F0655A', icon: ShieldAlert },
}

const CLUE_STATE_META: Record<WorldKnowledgeClueState, { label: string; color: string }> = {
  unread: { label: '未读', color: '#F2A93B' },
  open: { label: '已展开', color: '#8B93F8' },
  verified: { label: '已验证', color: '#4ECB9C' },
}

const TRACK_META: Record<WorldTrack, { label: string; description: string }> = {
  knowledge: { label: '静态知识', description: '已经写入世界的骨架' },
  events: { label: '动态事件', description: '正在改变世界的回响' },
}

function getInitialNodeId(nodes: WorldKnowledgeNode[], requestedId: string | null | undefined) {
  if (requestedId === null) return null
  if (requestedId && nodes.some((node) => node.id === requestedId)) return requestedId
  return nodes[0]?.id ?? null
}

function getNodeMatches(node: WorldKnowledgeNode, query: string) {
  if (!query) return true
  const searchable = [node.title, node.eyebrow, node.summary, node.detail, ...(node.tags ?? [])].join(' ')
  return searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase())
}

function IconBadge({ node, size = 16 }: { node: WorldKnowledgeNode; size?: number }) {
  const meta = KIND_META[node.kind]
  const Icon = node.icon ?? meta.icon
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg border bg-ink/70"
      style={{ borderColor: `${node.accent ?? meta.color}66`, color: node.accent ?? meta.color, width: size + 18, height: size + 18 }}
    >
      <Icon size={size} />
    </span>
  )
}

function StatusPill({ status }: { status: WorldKnowledgeNodeStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] tracking-[.14em]" style={{ color: meta.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
      {meta.label}
    </span>
  )
}

function EventSeverity({ severity }: { severity: WorldKnowledgeEventSeverity }) {
  const meta = SEVERITY_META[severity]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[.16em]" style={{ color: meta.color }}>
      <Icon size={13} />
      {meta.label}
    </span>
  )
}

function ClueState({ state }: { state: WorldKnowledgeClueState }) {
  const meta = CLUE_STATE_META[state]
  return (
    <span className="inline-flex items-center gap-1 text-[10px] tracking-[.12em]" style={{ color: meta.color }}>
      {state === 'verified' ? <Check size={12} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />}
      {meta.label}
    </span>
  )
}

function FeedbackStep({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={cn('min-w-0 flex-1 rounded-lg border px-3 py-2', active ? 'border-gold-300/40 bg-gold-300/[.06]' : 'border-white/[.07] bg-ink/40')}>
      <div className="text-[9px] tracking-[.18em] text-faint">{label}</div>
      <div className={cn('mt-1 truncate text-[12px]', active ? 'text-gold-100' : 'text-dim')}>{value}</div>
    </div>
  )
}

export default function WorldKnowledgeBoard({
  nodes,
  events,
  clues = [],
  title = '世界观回响台',
  subtitle = '把被记录的法则，与正在发生的偏移放在同一张桌上。',
  defaultNodeId,
  selectedNodeId,
  defaultTrack = 'knowledge',
  onNodeSelect,
  onEventSelect,
  onClueOpen,
  onClueStateChange,
  className,
}: WorldKnowledgeBoardProps) {
  const [internalNodeId, setInternalNodeId] = useState<string | null>(() => getInitialNodeId(nodes, defaultNodeId))
  const [track, setTrack] = useState<WorldTrack>(defaultTrack)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null)
  const [clueDrawerOpen, setClueDrawerOpen] = useState(false)

  const activeNodeId = selectedNodeId === undefined ? internalNodeId : selectedNodeId
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const clueById = useMemo(() => new Map(clues.map((clue) => [clue.id, clue])), [clues])
  const activeNode = activeNodeId ? nodeById.get(activeNodeId) : undefined
  const activeClue = selectedClueId ? clueById.get(selectedClueId) : undefined

  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>()
    if (!activeNodeId) return connected

    connected.add(activeNodeId)
    const selected = nodeById.get(activeNodeId)
    selected?.linkedNodeIds?.forEach((nodeId) => connected.add(nodeId))
    nodes.forEach((node) => {
      if (node.linkedNodeIds?.includes(activeNodeId)) connected.add(node.id)
    })
    events.forEach((event) => {
      if (event.nodeIds.includes(activeNodeId)) event.nodeIds.forEach((nodeId) => connected.add(nodeId))
    })
    return connected
  }, [activeNodeId, events, nodeById, nodes])

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim()
    return nodes.filter((node) => {
      const matchesKind = kindFilter === 'all' || node.kind === kindFilter
      return matchesKind && getNodeMatches(node, normalizedQuery)
    })
  }, [kindFilter, nodes, query])

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return events.filter((event) => {
      const matchesText = !normalizedQuery || `${event.title} ${event.summary} ${event.detail ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
      const matchesKind = kindFilter === 'all' || event.nodeIds.some((nodeId) => nodeById.get(nodeId)?.kind === kindFilter)
      return matchesText && matchesKind
    })
  }, [events, kindFilter, nodeById, query])

  const activeEvents = useMemo(() => events.filter((event) => activeNodeId && event.nodeIds.includes(activeNodeId)), [activeNodeId, events])
  const activeClues = useMemo(() => clues.filter((clue) => activeNodeId && clue.nodeIds.includes(activeNodeId)), [activeNodeId, clues])

  const selectNode = (nodeId: string | null) => {
    setInternalNodeId(nodeId)
    onNodeSelect?.(nodeId, nodeId ? nodeById.get(nodeId) : undefined)
  }

  const selectEvent = (event: WorldKnowledgeEvent) => {
    setSelectedEventId(event.id)
    onEventSelect?.(event)
    const firstKnownNode = event.nodeIds.find((nodeId) => nodeById.has(nodeId))
    if (firstKnownNode) selectNode(firstKnownNode)
  }

  const openClue = (clue: WorldKnowledgeClue) => {
    setSelectedClueId(clue.id)
    setClueDrawerOpen(true)
    onClueOpen?.(clue)
    if ((clue.state ?? 'unread') === 'unread') onClueStateChange?.(clue, 'open')
  }

  const selectedEvent = selectedEventId ? events.find((event) => event.id === selectedEventId) : undefined
  const relatedNodeTitles = (nodeIds: string[]) => nodeIds.map((nodeId) => nodeById.get(nodeId)?.title).filter((title): title is string => Boolean(title))

  return (
    <section className={cn('relative overflow-hidden rounded-[18px] border border-[rgba(227,194,124,.18)] bg-abyss/80 shadow-panel', className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(227,194,124,.10),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(139,147,248,.08),transparent_36%)]" />

      <div className="relative border-b border-white/[.08] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[.25em] text-gold-500">
              <Layers3 size={13} />
              <span>WORLD MEMORY // DUAL TRACK</span>
            </div>
            <h2 className="gold-text font-serifsc text-2xl font-semibold tracking-[.14em] sm:text-3xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-dim">{subtitle}</p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <div className="rounded-lg border border-white/[.08] bg-ink/50 px-3 py-2">
              <div className="text-[9px] tracking-[.18em] text-faint">碎片</div>
              <div className="mt-1 font-mono text-sm text-bone">{nodes.length.toString().padStart(2, '0')}</div>
            </div>
            <div className="rounded-lg border border-white/[.08] bg-ink/50 px-3 py-2">
              <div className="text-[9px] tracking-[.18em] text-faint">事件</div>
              <div className="mt-1 font-mono text-sm text-bone">{events.length.toString().padStart(2, '0')}</div>
            </div>
            <div className="rounded-lg border border-white/[.08] bg-ink/50 px-3 py-2">
              <div className="text-[9px] tracking-[.18em] text-faint">线索</div>
              <div className="mt-1 font-mono text-sm text-bone">{clues.length.toString().padStart(2, '0')}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-xl border border-white/[.08] bg-ink/50 p-1" role="tablist" aria-label="世界观轨道">
            {(Object.keys(TRACK_META) as WorldTrack[]).map((trackKey) => {
              const isActive = track === trackKey
              return (
                <button
                  key={trackKey}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setTrack(trackKey)}
                  className={cn('flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-left transition-all duration-200 sm:min-w-[148px]', isActive ? 'bg-gold-300/[.13] text-gold-100 shadow-gold-glow' : 'text-faint hover:text-dim')}
                >
                  {trackKey === 'knowledge' ? <BookOpen size={15} /> : <Zap size={15} />}
                  <span>
                    <span className="block text-[12px] tracking-[.12em]">{TRACK_META[trackKey].label}</span>
                    <span className="hidden text-[10px] text-faint sm:block">{TRACK_META[trackKey].description}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[.08] bg-ink/50 px-3 py-2 text-dim focus-within:border-gold-300/40 lg:max-w-[270px]">
              <Search size={15} className="shrink-0 text-faint" />
              <span className="sr-only">搜索世界观内容</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索碎片或事件"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-bone outline-none placeholder:text-faint"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-faint transition-colors hover:text-gold-300" aria-label="清除搜索">
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              aria-expanded={filterOpen}
              className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12px] transition-colors', filterOpen || kindFilter !== 'all' ? 'border-gold-300/50 bg-gold-300/[.08] text-gold-300' : 'border-white/[.08] bg-ink/50 text-dim hover:border-gold-300/35 hover:text-gold-300')}
            >
              <Filter size={14} />
              <span className="hidden sm:inline">筛选</span>
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {(filterOpen || kindFilter !== 'all') && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.06] pt-3">
                <span className="mr-1 text-[10px] tracking-[.15em] text-faint">按类型</span>
                {(['all', ...Object.keys(KIND_META)] as KindFilter[]).map((filter) => {
                  const isActive = kindFilter === filter
                  const meta = filter === 'all' ? undefined : KIND_META[filter]
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setKindFilter(filter)}
                      className={cn('rounded-full border px-3 py-1.5 text-[11px] transition-colors', isActive ? 'border-gold-300/50 bg-gold-300/[.10] text-gold-100' : 'border-white/[.08] text-faint hover:border-gold-300/30 hover:text-dim')}
                      style={isActive && meta ? { color: meta.color, borderColor: `${meta.color}88` } : undefined}
                    >
                      {filter === 'all' ? '全部' : meta?.label}
                    </button>
                  )
                })}
                {kindFilter !== 'all' && (
                  <button type="button" onClick={() => setKindFilter('all')} className="ml-auto text-[11px] text-faint hover:text-gold-300">
                    重置
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {track === 'knowledge' ? (
              <motion.div key="knowledge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] tracking-[.2em] text-faint">FRAGMENT CARDS</div>
                    <p className="mt-1 text-[12px] text-dim">点击碎片，查看它牵动的事件与线索。</p>
                  </div>
                  <span className="font-mono text-[11px] text-faint">{filteredNodes.length}/{nodes.length}</span>
                </div>

                {filteredNodes.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredNodes.map((node, index) => {
                      const isSelected = node.id === activeNodeId
                      const isConnected = connectedNodeIds.has(node.id)
                      const meta = KIND_META[node.kind]
                      const nodeClues = clues.filter((clue) => clue.nodeIds.includes(node.id))
                      const nodeEvents = events.filter((event) => event.nodeIds.includes(node.id))
                      return (
                        <motion.article
                          key={node.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: activeNodeId && !isConnected ? 0.42 : 1, y: 0 }}
                          transition={{ duration: 0.24, delay: Math.min(index * 0.035, 0.18) }}
                          className={cn('group relative overflow-hidden rounded-xl border bg-panel/90 transition-[border-color,box-shadow,opacity] duration-200', isSelected ? 'border-gold-300/70 shadow-gold-glow' : isConnected ? 'border-gold-300/30' : 'border-white/[.08] hover:border-gold-300/35')}
                          style={{ '--world-accent': node.accent ?? meta.color } as CSSProperties}
                        >
                          <div className="absolute inset-x-0 top-0 h-px opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${node.accent ?? meta.color}, transparent)` }} />
                          <button type="button" onClick={() => { setSelectedEventId(null); selectNode(isSelected ? null : node.id) }} className="w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 focus-visible:ring-inset">
                            <div className="flex items-start gap-3">
                              <IconBadge node={node} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[10px] tracking-[.16em]" style={{ color: node.accent ?? meta.color }}>{node.eyebrow}</span>
                                  {node.status && <StatusPill status={node.status} />}
                                </div>
                                <h3 className="mt-2 truncate font-serifsc text-[17px] tracking-[.08em] text-bone">{node.title}</h3>
                              </div>
                            </div>
                            <p className="mt-4 line-clamp-2 text-[12px] leading-relaxed text-dim">{node.summary}</p>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {(node.tags ?? []).slice(0, 3).map((tag) => <span key={tag} className="rounded-full border border-white/[.08] px-2 py-1 text-[10px] text-faint">#{tag}</span>)}
                            </div>
                          </button>
                          <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-faint"><Link2 size={12} /> {node.linkedNodeIds?.length ?? 0} 关联</span>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-faint"><Zap size={12} /> {nodeEvents.length} 事件</span>
                              {nodeClues.length > 0 && <button type="button" onClick={() => openClue(nodeClues[0])} className="inline-flex items-center gap-1 text-[10px] text-gold-500 transition-colors hover:text-gold-100"><Eye size={12} /> 线索 {nodeClues.length}</button>}
                            </div>
                          </div>
                        </motion.article>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState label="没有匹配的静态知识" onReset={() => { setQuery(''); setKindFilter('all') }} />
                )}
              </motion.div>
            ) : (
              <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] tracking-[.2em] text-faint">LIVE EVENT STREAM</div>
                    <p className="mt-1 text-[12px] text-dim">事件会反向点亮它影响的知识碎片。</p>
                  </div>
                  <span className="font-mono text-[11px] text-faint">{filteredEvents.length}/{events.length}</span>
                </div>

                {filteredEvents.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {filteredEvents.map((event, index) => {
                      const isSelected = selectedEventId === event.id
                      const isRelated = activeNodeId ? event.nodeIds.includes(activeNodeId) : false
                      const severity = SEVERITY_META[event.severity]
                      return (
                        <motion.article key={event.id} layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: activeNodeId && !isRelated ? 0.48 : 1, x: 0 }} transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.18) }} className={cn('overflow-hidden rounded-xl border bg-panel/90 transition-[border-color,box-shadow,opacity] duration-200', isSelected ? 'border-gold-300/65 shadow-gold-glow' : isRelated ? 'border-gold-300/30' : 'border-white/[.08] hover:border-gold-300/35')}>
                          <button type="button" onClick={() => selectEvent(event)} className="w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/60 focus-visible:ring-inset">
                            <div className="flex items-start gap-3">
                              <div className="relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: `${severity.color}66`, color: severity.color }}>
                                <span className="absolute inset-1 animate-pulse rounded-full opacity-20" style={{ backgroundColor: severity.color }} />
                                <Zap size={14} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <EventSeverity severity={event.severity} />
                                  <span className="inline-flex items-center gap-1 text-[10px] text-faint"><Clock3 size={12} /> {event.occurredAt}</span>
                                </div>
                                <h3 className="mt-2 font-serifsc text-[16px] tracking-[.06em] text-bone">{event.title}</h3>
                                <p className="mt-2 text-[12px] leading-relaxed text-dim">{event.summary}</p>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {relatedNodeTitles(event.nodeIds).map((nodeTitle) => <span key={nodeTitle} className="rounded-full border border-white/[.08] px-2 py-1 text-[10px] text-faint">{nodeTitle}</span>)}
                            </div>
                          </button>
                          {event.detail && <div className="border-t border-white/[.06] px-4 py-2.5 text-[11px] leading-relaxed text-faint"><ArrowDownRight size={13} className="mr-1 inline text-gold-500" />{event.detail}</div>}
                        </motion.article>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState label="没有匹配的动态事件" onReset={() => { setQuery(''); setKindFilter('all') }} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="min-w-0 space-y-3">
          <section className="rounded-xl border border-gold-300/20 bg-panel/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-gold-500"><Link2 size={13} />关联回路</div>
              {activeNode && <button type="button" onClick={() => selectNode(null)} className="text-[10px] text-faint hover:text-gold-300">清除选择</button>}
            </div>
            {activeNode ? (
              <>
                <div className="mt-4 flex items-start gap-3"><IconBadge node={activeNode} size={15} /><div className="min-w-0"><div className="text-[10px] tracking-[.15em] text-faint">当前锚点</div><h3 className="mt-1 truncate font-serifsc text-lg text-bone">{activeNode.title}</h3></div></div>
                <p className="mt-3 text-[12px] leading-relaxed text-dim">{activeNode.detail}</p>
                <div className="mt-4 flex items-center gap-1.5"><FeedbackStep label="碎片" value={activeNode.title} active /><ArrowRight size={13} className="shrink-0 text-gold-500" /><FeedbackStep label="事件" value={`${activeEvents.length} 条回响`} active={activeEvents.length > 0} /><ArrowRight size={13} className="shrink-0 text-gold-500" /><FeedbackStep label="线索" value={`${activeClues.length} 条待读`} active={activeClues.length > 0} /></div>
                {activeEvents.length > 0 && <div className="mt-4 border-t border-white/[.06] pt-3"><div className="mb-2 text-[10px] tracking-[.15em] text-faint">最近回响</div><div className="flex flex-col gap-2">{activeEvents.slice(0, 2).map((event) => <button key={event.id} type="button" onClick={() => { setTrack('events'); selectEvent(event) }} className="flex items-center justify-between gap-3 text-left text-[11px] text-dim hover:text-gold-100"><span className="truncate">{event.title}</span><ArrowRight size={13} className="shrink-0 text-gold-500" /></button>)}</div></div>}
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-white/[.10] bg-ink/35 p-4 text-center"><Orbit size={20} className="mx-auto text-gold-500" /><p className="mt-2 text-[12px] leading-relaxed text-dim">选择一枚碎片，建立“知识 → 事件 → 线索”的反馈回路。</p></div>
            )}
          </section>

          <section className="rounded-xl border border-white/[.08] bg-panel/90 p-4">
            <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-faint"><History size={13} />线索抽屉</div><span className="font-mono text-[10px] text-faint">{clues.length.toString().padStart(2, '0')}</span></div>
            {clues.length > 0 ? <div className="mt-3 flex flex-col gap-1.5">{clues.slice(0, 4).map((clue) => <button key={clue.id} type="button" onClick={() => openClue(clue)} className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-white/[.08] hover:bg-ink/50"><span className="font-mono text-[10px] text-gold-500">{clue.label}</span><span className="min-w-0 flex-1 truncate text-[12px] text-dim">{clue.title}</span><ClueState state={clue.state ?? 'unread'} /></button>)}</div> : <p className="mt-3 text-[12px] text-faint">暂无可展开线索。</p>}
            {clues.length > 4 && <button type="button" onClick={() => clues[4] && openClue(clues[4])} className="mt-3 text-[11px] text-gold-500 hover:text-gold-100">继续查看线索 →</button>}
          </section>

          {selectedEvent && <section className="rounded-xl border border-white/[.08] bg-panel/90 p-4"><div className="flex items-center gap-2 text-[10px] tracking-[.2em] text-faint"><Zap size={13} />已锁定事件</div><h3 className="mt-3 font-serifsc text-base text-bone">{selectedEvent.title}</h3><p className="mt-2 text-[12px] leading-relaxed text-dim">{selectedEvent.detail ?? selectedEvent.summary}</p></section>}
        </aside>
      </div>

      <AnimatePresence>
        {clueDrawerOpen && activeClue && (
          <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={`线索：${activeClue.title}`} onClick={() => setClueDrawerOpen(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-abyss/75 backdrop-blur-[8px]" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} onClick={(event) => event.stopPropagation()} className="absolute bottom-0 right-0 top-0 flex w-full max-w-[460px] flex-col border-l border-[rgba(227,194,124,.2)] bg-panel p-5 shadow-card max-md:top-auto max-md:max-h-[84dvh] max-md:rounded-t-[24px] max-md:border-l-0 max-md:border-t sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/[.08] pb-5"><div><div className="mb-2 text-[10px] tracking-[.22em] text-gold-500">CLUE DRAWER // {activeClue.label}</div><h2 className="font-serifsc text-2xl tracking-[.08em] text-bone">{activeClue.title}</h2></div><button type="button" onClick={() => setClueDrawerOpen(false)} aria-label="关闭线索抽屉" className="rounded-full border border-white/[.10] p-2 text-faint transition-colors hover:border-gold-300/50 hover:text-gold-300"><X size={17} /></button></div>
              <div className="min-h-0 flex-1 overflow-y-auto py-5">
                {activeClue.quote && <blockquote className="border-l-2 border-gold-500/70 bg-gold-300/[.05] px-4 py-3 font-serifsc text-[15px] leading-relaxed text-gold-100">“{activeClue.quote}”</blockquote>}
                <p className="mt-5 text-[13px] leading-[1.9] text-dim">{activeClue.body}</p>
                <div className="mt-6 rounded-xl border border-white/[.08] bg-ink/45 p-4"><div className="flex items-center justify-between"><span className="text-[10px] tracking-[.18em] text-faint">线索状态</span><ClueState state={activeClue.state ?? 'unread'} /></div><div className="mt-3 flex flex-wrap gap-2">{activeClue.nodeIds.map((nodeId) => { const node = nodeById.get(nodeId); return node ? <button key={node.id} type="button" onClick={() => { setClueDrawerOpen(false); setTrack('knowledge'); selectNode(node.id) }} className="inline-flex items-center gap-1.5 rounded-full border border-gold-300/20 px-3 py-1.5 text-[11px] text-dim hover:border-gold-300/50 hover:text-gold-100"><Link2 size={12} />{node.title}</button> : null })}</div></div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-white/[.08] pt-5"><button type="button" onClick={() => { onClueStateChange?.(activeClue, 'verified'); setClueDrawerOpen(false) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[rgba(78,203,156,.45)] bg-[rgba(78,203,156,.08)] px-5 text-[12px] tracking-[.14em] text-suit-club transition-colors hover:bg-[rgba(78,203,156,.16)]"><Check size={14} />标记已验证</button><button type="button" onClick={() => setClueDrawerOpen(false)} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[rgba(227,194,124,.28)] px-5 text-[12px] tracking-[.14em] text-dim transition-colors hover:border-[rgba(246,227,180,.55)] hover:text-gold-300">稍后再看</button></div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

function EmptyState({ label, onReset }: { label: string; onReset: () => void }) {
  return <div className="rounded-xl border border-dashed border-white/[.10] bg-panel/60 px-5 py-12 text-center"><Search size={22} className="mx-auto text-faint" /><p className="mt-3 text-[13px] text-dim">{label}</p><button type="button" onClick={onReset} className="mt-3 text-[11px] text-gold-500 hover:text-gold-100">清除筛选</button></div>
}


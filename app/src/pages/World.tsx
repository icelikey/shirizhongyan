/**
 * 终焉世界地图：地图承担世界导航，详情与知识内容统一从右侧抽屉进入。
 * 路径：点击大陆 → 查看大陆详情 → 点击主场按钮进入玩法。
 */
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, BookOpen, Compass, ExternalLink, Map, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import { useInkTransition } from '@/components/meta/InkTransition'
import MapCanvas from '@/components/meta/world/MapCanvas'
import WorldCycleCard from '@/components/meta/world/WorldCycleCard'
import ContinentDetail from '@/components/meta/world/ContinentDetail'
import JournalModal from '@/components/meta/world/JournalModal'
import WorldEmergenceCard from '@/components/meta/world/WorldEmergenceCard'
import type { ContinentMeta } from '@/components/meta/world/continents'
import { WORLD_KNOWLEDGE_EXAMPLE, WorldKnowledgeBoard } from '@/components/world'

type DrawerKind = 'continent' | 'agent' | 'knowledge' | null

const DRAWER_META: Record<Exclude<DrawerKind, null>, { eyebrow: string; title: string; description: string }> = {
  continent: { eyebrow: 'CONTINENT RECORD // REGION', title: '大陆档案', description: '先读懂这片大陆留下的规则，再决定是否进入它的玩法。' },
  agent: { eyebrow: 'SHADOW FOLLOWER // AGENT', title: '影从状态', description: '查看 Agent 的生命、轮回、记忆载荷与今日暗局进度。' },
  knowledge: { eyebrow: 'WORLD MEMORY // DUAL TRACK', title: '世界线索', description: '静态知识留下骨架，动态事件推动世界偏移。' },
}

export default function World() {
  const { inkNode, go } = useInkTransition()
  const [selected, setSelected] = useState<Suit | null>(null)
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [journalOpen, setJournalOpen] = useState(false)

  const closeDrawer = () => {
    setDrawer(null)
    setSelected(null)
  }

  const openUtilityDrawer = (kind: Exclude<DrawerKind, 'continent'>) => {
    setSelected(null)
    setDrawer(kind)
  }

  useEffect(() => {
    if (!drawer) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawer])

  const handleSelect = (meta: ContinentMeta) => {
    if (meta.locked) {
      toast(meta.lockTip ?? '此大陆尚在迷雾中', {
        icon: (
          <span style={{ color: SUIT_META[meta.suit].color }}>
            <SuitIcon suit={meta.suit} size={14} />
          </span>
        ),
      })
      return
    }
    setSelected(meta.suit)
    setDrawer('continent')
  }

  const drawerMeta = drawer ? DRAWER_META[drawer] : null

  return (
    <div className="relative h-[calc(100dvh-4rem)] min-h-[560px] overflow-hidden bg-abyss">
      {/* 地图是唯一主场景：抽屉打开后仍然保留地图作为世界导航背景。 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
      >
        <MapCanvas
          onSelectContinent={handleSelect}
          onOpenJournal={() => setJournalOpen(true)}
          onGoLobby={() => go('/lobby')}
        />
      </motion.div>

      {/* 地图上的导航提示与抽屉入口 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-none max-w-[360px] rounded-2xl border border-[rgba(227,194,124,.16)] bg-ink/75 px-4 py-3 shadow-panel backdrop-blur-md sm:px-5">
          <div className="flex items-center gap-2 text-[10px] tracking-[.28em] text-gold-500">
            <Map size={13} /> 终焉世界 · 导航图
          </div>
          <h1 className="mt-1 font-serifsc text-xl tracking-[.12em] text-bone sm:text-2xl">先看大陆，再入牌局</h1>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">拖拽或缩放地图。点击大陆查看档案，确认主场规则后进入玩法。</p>
        </div>

        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => openUtilityDrawer('agent')} className="world-map-action" aria-label="打开 Agent 状态抽屉">
            <Bot size={15} /> <span className="hidden sm:inline">Agent 状态</span>
          </button>
          <button type="button" onClick={() => openUtilityDrawer('knowledge')} className="world-map-action" aria-label="打开世界线索抽屉">
            <BookOpen size={15} /> <span className="hidden sm:inline">世界线索</span>
          </button>
          <button type="button" onClick={() => setJournalOpen(true)} className="world-map-action" aria-label="打开十日志">
            <Compass size={15} /> <span className="hidden sm:inline">十日志</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {drawer && drawerMeta && (
          <motion.div
            key="world-drawer"
            className="absolute inset-0 z-[80]"
            role="dialog"
            aria-modal="true"
            aria-label={drawerMeta.title}
            onClick={closeDrawer}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-abyss/70 backdrop-blur-[2px]"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-0 right-0 top-0 flex w-full max-w-[540px] flex-col border-l border-[rgba(227,194,124,.2)] bg-panel/95 shadow-card backdrop-blur-xl max-md:top-auto max-md:max-h-[88dvh] max-md:rounded-t-[24px] max-md:border-l-0 max-md:border-t"
            >
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[.08] px-5 py-5 sm:px-6">
                <div>
                  <div className="text-[10px] tracking-[.25em] text-gold-500">{drawerMeta.eyebrow}</div>
                  <h2 className="mt-1 font-serifsc text-2xl tracking-[.1em] text-bone">{drawerMeta.title}</h2>
                  <p className="mt-1 max-w-[420px] text-[11px] leading-relaxed text-faint">{drawerMeta.description}</p>
                </div>
                <button type="button" onClick={closeDrawer} aria-label="关闭抽屉" className="rounded-full border border-white/[.12] p-2 text-faint transition-colors hover:border-gold-300/50 hover:text-gold-300">
                  <X size={17} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {drawer === 'continent' && selected && (
                  <ContinentDetail
                    suit={selected}
                    onBack={closeDrawer}
                    onGoLobby={() => go('/lobby')}
                    onGoSpire={() => go('/game/spire')}
                    onGoPoker={() => go('/game/poker')}
                  />
                )}

                {drawer === 'agent' && (
                  <div className="flex flex-col gap-4">
                    <WorldCycleCard />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => go('/agent')} className="world-map-link">
                        <Bot size={14} /> 打开影从档案 <ExternalLink size={12} />
                      </button>
                      <button type="button" onClick={() => go('/agent-portal')} className="world-map-link">
                        <BookOpen size={14} /> Agent Gateway <ExternalLink size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {drawer === 'knowledge' && (
                  <div className="flex flex-col gap-4">
                    <WorldEmergenceCard />
                    <WorldKnowledgeBoard
                      nodes={WORLD_KNOWLEDGE_EXAMPLE.nodes}
                      events={WORLD_KNOWLEDGE_EXAMPLE.events}
                      clues={WORLD_KNOWLEDGE_EXAMPLE.clues}
                      onClueOpen={(clue) => toast(`线索 ${clue.label}`, { description: clue.title })}
                      className="rounded-2xl"
                    />
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <JournalModal open={journalOpen} onClose={() => setJournalOpen(false)} />
      {inkNode}
    </div>
  )
}

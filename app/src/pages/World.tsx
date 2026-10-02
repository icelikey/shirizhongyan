/**
 * 世界地图 `/world`（design/world.md）。
 * 左：可 pan/zoom 的星云海图画布（四大陆 + 中央十日轮）；
 * 右栏 340px：常态 = 位阶总览 + 碎片背包；选中大陆 = 大陆详情（← 全景 返回）。
 * 迷雾大陆点击 → Toast 提示。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import { useInkTransition } from '@/components/meta/InkTransition'
import MapCanvas from '@/components/meta/world/MapCanvas'
import TierLadder from '@/components/meta/world/TierLadder'
import FragmentBag from '@/components/meta/world/FragmentBag'
import ContinentDetail from '@/components/meta/world/ContinentDetail'
import JournalModal from '@/components/meta/world/JournalModal'
import WorldEmergenceCard from '@/components/meta/world/WorldEmergenceCard'
import type { ContinentMeta } from '@/components/meta/world/continents'
import { WORLD_KNOWLEDGE_EXAMPLE, WorldKnowledgeBoard } from '@/components/world'

export default function World() {
  const { inkNode, go } = useInkTransition()
  const [selected, setSelected] = useState<Suit | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)

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
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-6">
      <div className="flex flex-col gap-6 lg:h-[calc(100dvh-6rem)] lg:flex-row">
        {/* 地图画布 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[58dvh] min-w-0 flex-1 lg:min-h-0"
        >
          <MapCanvas
            onSelectContinent={handleSelect}
            onOpenJournal={() => setJournalOpen(true)}
            onGoLobby={() => go('/lobby')}
          />
        </motion.div>

        {/* 右栏 340px */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="w-full shrink-0 lg:w-[340px] lg:overflow-y-auto lg:pr-1"
        >
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <ContinentDetail
                  suit={selected}
                  onBack={() => setSelected(null)}
                  onGoLobby={() => go('/lobby')}
                  onGoSpire={() => go('/game/spire')}
                  onGoPoker={() => go('/game/poker')}
                />
              </motion.div>
            ) : (
              <motion.div
                key="overview"
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col gap-4"
              >
                <TierLadder />
                <WorldEmergenceCard />
                <FragmentBag />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-[.25em] text-gold-500">WORLD MEMORY // CANON + EMERGENCE</div>
            <h2 className="mt-2 font-serifsc text-2xl font-semibold tracking-[.12em] text-bone">世界线索与回响</h2>
          </div>
          <p className="max-w-xl text-right text-[12px] leading-relaxed text-faint">
            静态规则负责留下骨架，已结算事件负责推动偏移；每一条线索都必须能回到真实事件或明确标注为待验证。
          </p>
        </div>
        <WorldKnowledgeBoard
          nodes={WORLD_KNOWLEDGE_EXAMPLE.nodes}
          events={WORLD_KNOWLEDGE_EXAMPLE.events}
          clues={WORLD_KNOWLEDGE_EXAMPLE.clues}
          onClueOpen={(clue) => toast(`线索 ${clue.label}`, { description: clue.title })}
        />
      </motion.section>

      <JournalModal open={journalOpen} onClose={() => setJournalOpen(false)} />
      {inkNode}
    </div>
  )
}

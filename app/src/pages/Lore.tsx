/**
 * 十日残章 `/lore`（design/lore.md）。
 * 叙事型页面：书架视图（卷轴陈列 + 启封弹层）/ 阅读视图（烛光夜读）。
 * Lenis 平滑滚动；阅读视图内部为 GSAP ScrollTrigger，书架为 framer-motion（分树隔离）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import type { LoreVolume } from '@/data/lore'
import { LORE_VOLUMES } from '@/data/lore'
import { TIER_ORDER } from '@/data/tiers'
import type { Tier } from '@/data/tiers'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import PageFooter from '@/components/PageFooter'
import { VolumeCard, UnlockModal } from '@/components/content/lore-shelf'
import ReadingView from '@/components/content/lore-reading'

const READ_KEY = 'ten-days-gambit-lore-read'

function loadRead(): number[] {
  try {
    const raw = localStorage.getItem(READ_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export default function Lore() {
  const fragments = useProfile((s) => s.fragments)
  const unlockedLore = useProfile((s) => s.unlockedLore)
  const unlockLore = useProfile((s) => s.unlockLore)
  const spendFragments = useProfile((s) => s.spendFragments)
  const addFragments = useProfile((s) => s.addFragments)
  const tier = useProfile((s) => s.tier)

  const [view, setView] = useState<'shelf' | 'reading'>('shelf')
  const [activeId, setActiveId] = useState<number>(1)
  const [unlockTarget, setUnlockTarget] = useState<LoreVolume | null>(null)
  const [readIds, setReadIds] = useState<number[]>(loadRead)
  const lenisRef = useRef<Lenis | null>(null)

  /* Lenis 平滑滚动 + ScrollTrigger 同步（叙事页契约） */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  const isUnlocked = useCallback(
    (v: LoreVolume) => v.lock.kind === 'free' || unlockedLore.includes(v.id),
    [unlockedLore],
  )

  const tierMetFor = useCallback(
    (v: LoreVolume): boolean => {
      if (v.lock.kind !== 'tier') return false
      let ok = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(v.lock.tier as Tier)
      if (ok && v.lock.requiresAll) ok = LORE_VOLUMES.filter((w) => w.id !== v.id).every((w) => isUnlocked(w))
      return ok
    },
    [tier, isUnlocked],
  )

  const scrollTop = useCallback(() => {
    lenisRef.current?.scrollTo(0, { immediate: true })
    window.scrollTo(0, 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [])

  const openReading = useCallback(
    (id: number) => {
      const v = LORE_VOLUMES.find((x) => x.id === id)
      if (v && v.lock.kind === 'free') unlockLore(id) // 初始卷登记入档
      setActiveId(id)
      setView('reading')
      scrollTop()
    },
    [scrollTop, unlockLore],
  )

  const handleCardClick = useCallback(
    (v: LoreVolume) => {
      if (isUnlocked(v)) {
        openReading(v.id)
        return
      }
      if (v.lock.kind === 'mist') {
        toast('迷雾未散', { description: v.lock.hint })
        return
      }
      setUnlockTarget(v)
    },
    [isUnlocked, openReading],
  )

  /* 启封：实际扣款 + 解锁（UnlockModal 演出中段调用） */
  const confirmUnlock = useCallback(
    (v: LoreVolume) => {
      if (v.lock.kind === 'fragments') {
        for (const [suit, n] of Object.entries(v.lock.cost)) {
          if (!spendFragments(suit as keyof typeof fragments, n ?? 0)) {
            toast('碎片不足', { description: '启封中断，碎片未扣减。' })
            return
          }
        }
      }
      unlockLore(v.id)
      toast(`卷${v.numeral} · ${v.title} · 启封`, { description: '朱砂绳断，锁印化作金尘。' })
    },
    [spendFragments, unlockLore, fragments],
  )

  /* 卷终印章落定：首读标记 + 奖励 */
  const finishReading = useCallback(
    (id: number) => {
      if (readIds.includes(id)) return
      const v = LORE_VOLUMES.find((x) => x.id === id)
      const next = [...readIds, id]
      setReadIds(next)
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(next))
      } catch {
        /* 忽略持久化失败 */
      }
      addFragments('diamond', 5)
      toast(`卷${v?.numeral ?? id} · 已录于旅人之忆`, { description: '首读奖励 +5 ♦ 金壤碎片' })
    },
    [readIds, addFragments],
  )

  const unlockedCount = LORE_VOLUMES.filter((v) => isUnlocked(v)).length
  const activeVolume = LORE_VOLUMES.find((v) => v.id === activeId) ?? LORE_VOLUMES[0]

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {view === 'shelf' ? (
          <motion.div
            key="shelf"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, transition: { duration: 0.25 } }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* 页头 */}
            <header className="mx-auto max-w-[1280px] px-6 pt-12 pb-8 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h1 className="gold-text font-serifsc font-black text-[40px] tracking-[.1em]">十日残章</h1>
                <p className="text-dim text-[13px] tracking-[.25em] mt-2">集齐碎片，拼凑这个世界的真相</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-[13px] text-gold-300 tracking-wider">已解锁 {unlockedCount}/10</span>
                <div className="flex items-center gap-1.5">
                  {LORE_VOLUMES.map((v) => (
                    <span
                      key={v.id}
                      title={`卷${v.numeral} · ${v.title}`}
                      className="w-3 h-3 rounded-full border transition-all duration-500"
                      style={
                        isUnlocked(v)
                          ? { background: '#E3C27C', borderColor: '#F8E9C0', boxShadow: '0 0 8px rgba(227,194,124,.7)' }
                          : { background: 'transparent', borderColor: 'rgba(227,194,124,.25)' }
                      }
                    />
                  ))}
                </div>
              </div>
            </header>

            {/* 书架 */}
            <div className="mx-auto max-w-[1280px] px-6 pb-16">
              <div
                className="relative rounded-[24px] border border-[rgba(227,194,124,.12)] px-6 py-10 sm:px-10"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(29,22,38,.65), rgba(12,10,19,.85)), repeating-linear-gradient(180deg, transparent 0 340px, rgba(138,106,51,.28) 340px 352px, rgba(7,6,11,.9) 352px 364px)',
                  boxShadow: 'inset 0 12px 40px rgba(0,0,0,.55), 0 24px 64px rgba(0,0,0,.5)',
                }}
              >
                <div className="flex gap-6 overflow-x-auto pb-3 lg:grid lg:grid-cols-5 lg:gap-y-12 lg:overflow-visible justify-items-center">
                  {LORE_VOLUMES.map((v, i) => (
                    <VolumeCard
                      key={v.id}
                      volume={v}
                      index={i}
                      unlocked={isUnlocked(v)}
                      read={readIds.includes(v.id)}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
              </div>
              <p className="text-faint text-[12px] tracking-[.2em] mt-6 text-center">
                残章以碎片启封 · 首读每卷可获 +5 ♦ · 卷陆 / 卷柒 沉于迷雾，卷捌 / 卷拾 以位阶为钥
              </p>
            </div>

            <PageFooter />
          </motion.div>
        ) : (
          <motion.div
            key="reading"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* 烛光阅读壳：背景压暗 */}
            <div className="absolute inset-0 -z-10 bg-abyss/70" />
            <ReadingView
              key={activeVolume.id}
              volume={activeVolume}
              unlockedIds={LORE_VOLUMES.filter((v) => isUnlocked(v)).map((v) => v.id)}
              onClose={() => {
                setView('shelf')
                scrollTop()
              }}
              onNavigate={openReading}
              onFinishReading={finishReading}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 启封弹层 */}
      <UnlockModal
        volume={unlockTarget}
        fragments={fragments}
        tierMet={unlockTarget ? tierMetFor(unlockTarget) : false}
        onClose={() => setUnlockTarget(null)}
        onConfirm={confirmUnlock}
        onSealed={(v) => {
          setUnlockTarget(null)
          openReading(v.id)
        }}
      />
    </div>
  )
}

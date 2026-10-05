/**
 * 终焉剧情画册。
 *
 * 画册是剧情表现层：它只消费 LoreVolume 已确认的文本，不修改胜负、解锁和世界状态。
 * 每卷固定经过「封面 → 场景 → 正文 → 线索 → 记忆」五类页，最后一页才登记首读完成。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, Fingerprint, KeyRound, Lock, ScrollText, X } from 'lucide-react'
import type { LoreVolume } from '@/data/lore'
import { LORE_VOLUMES } from '@/data/lore'
import { cn } from '@/lib/utils'

type AlbumPageKind = 'cover' | 'scene' | 'story' | 'clue' | 'memory'

interface AlbumPage {
  kind: AlbumPageKind
  label: string
  title: string
  body?: string
  image?: string
  accent?: string
}

interface StoryAlbumProps {
  volume: LoreVolume
  unlockedIds: number[]
  onClose: () => void
  onNavigate: (id: number) => void
  onFinishReading: (id: number) => void
}

const sceneNotes: Record<number, string> = {
  1: '十枚太阳同时升起，世界在还没有意识到终结之前，先被迫学会了抬头。',
  2: '牌室悬在世界与世界的缝隙里。每一张空椅子，都等着下一个不肯遗忘的人。',
  3: '契约把旅人与影从绑在同一条记忆线上；胜负会过去，选择会留下。',
  4: '玄渊最先入夜。火把照亮的不是答案，而是每个人藏在目光之后的破绽。',
  5: '青野把人心放进算庭。数字越接近答案，站在桌边的人越难判断自己。',
  6: '丹丘的红雾有温度，茶盏、沉默与未说出口的话，共同构成一场谈判。',
  7: '金壤让所有东西显出价格；当矿门关闭，最贵的东西反而变成了消息。',
  8: '十二生肖记录着位阶。每一次升阶，看到的都不是更容易的牌局，而是更深的输法。',
  9: '终焉不是爆炸，而是世界被一只看不见的手收回牌堆，等待下一次发牌。',
  10: '洪荒之扉没有守卫，只有一张空桌和一支笔；留白本身就是最后一道门。',
}

const clueNotes: Record<number, string> = {
  1: '“第十一日”不是新纪元的名字，而像一条被藏起来的服务器日志。',
  2: '六把椅子永远多一把：牌室似乎早已知道还会有新的旅人进入。',
  3: '影从记得旅人忘掉的事。记忆并不只属于个人，它也可能属于世界。',
  4: '无字碑前的牌面被雾浸透，像有人刻意抹去了第一个身份。',
  5: '“零”既是算术的终点，也可能是所有选择被压缩后的初始状态。',
  6: '丹丘的雾只在“该开的时候”散去，说明大陆之间存在看不见的调度者。',
  7: '封条下的字把四大陆连成一条规则链：一环未开，环环皆锁。',
  8: '位阶越高，越能看见牌桌之外的牌桌；规则的边界正在向观察者后退。',
  9: '只有烛火、碎片与目光不动，它们像被写入世界底层的三项不可回滚数据。',
  10: '“接过笔”意味着旅人可能从参与者变成改写规则的人，但代价尚未显形。',
}

function artworkFor(volume: LoreVolume) {
  return volume.albumArt || volume.banner || '/bg-nebula-abyss.png'
}

function buildPages(volume: LoreVolume): AlbumPage[] {
  const artwork = artworkFor(volume)
  return [
    {
      kind: 'cover',
      label: `终焉画册 · 卷${volume.numeral}`,
      title: volume.title,
      body: volume.quote,
      image: artwork,
    },
    {
      kind: 'scene',
      label: '世界场景',
      title: `这里是${volume.title}`,
      body: sceneNotes[volume.id] ?? '每一处风景都藏着一条尚未被读懂的世界线索。',
      image: artwork,
    },
    ...volume.paragraphs.map((body, index) => ({
      kind: 'story' as const,
      label: `剧情残页 ${String(index + 1).padStart(2, '0')}`,
      title: index === 0 ? '残页开端' : `第${String(index + 1).padStart(2, '0')}页`,
      body,
      image: artwork,
    })),
    {
      kind: 'clue',
      label: '世界线索',
      title: '把这一页带在身上',
      body: clueNotes[volume.id] ?? '真正的线索不会替你给出答案，它只会让下一次选择变得不同。',
      image: artwork,
      accent: 'var(--suit-spade)',
    },
    {
      kind: 'memory',
      label: '记忆卡片',
      title: '旅人之忆 · 已装载',
      body: `你读完了「${volume.title}」。这段叙事会成为一枚可被影从调用的记忆卡片；它不替你改写牌局，只在下一次轮回中提醒你曾经见过什么。`,
      image: artwork,
      accent: 'var(--gold-300)',
    },
  ]
}

const kindIcon: Record<AlbumPageKind, typeof BookOpen> = {
  cover: BookOpen,
  scene: ScrollText,
  story: BookOpen,
  clue: KeyRound,
  memory: Fingerprint,
}

export default function StoryAlbum({ volume, unlockedIds, onClose, onNavigate, onFinishReading }: StoryAlbumProps) {
  const pages = useMemo(() => buildPages(volume), [volume])
  const [pageIndex, setPageIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isFlipping, setIsFlipping] = useState(false)
  const startX = useRef<number | null>(null)
  const reported = useRef(false)

  const turnTo = useCallback(
    (next: number) => {
      if (isFlipping || next < 0 || next >= pages.length || next === pageIndex) return
      setDirection(next > pageIndex ? 1 : -1)
      setIsFlipping(true)
      setPageIndex(next)
      window.setTimeout(() => setIsFlipping(false), 520)
    },
    [isFlipping, pageIndex, pages.length],
  )

  const nextPage = useCallback(() => turnTo(pageIndex + 1), [pageIndex, turnTo])
  const previousPage = useCallback(() => turnTo(pageIndex - 1), [pageIndex, turnTo])

  useEffect(() => {
    reported.current = false
    setPageIndex(0)
    setDirection(1)
  }, [volume.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        nextPage()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        previousPage()
      } else if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nextPage, onClose, previousPage])

  useEffect(() => {
    if (pageIndex === pages.length - 1 && !reported.current) {
      reported.current = true
      onFinishReading(volume.id)
    }
  }, [onFinishReading, pageIndex, pages.length, volume.id])

  const page = pages[pageIndex]
  const Icon = kindIcon[page.kind]
  const prev = volume.id > 1 ? LORE_VOLUMES[volume.id - 2] : null
  const next = volume.id < LORE_VOLUMES.length ? LORE_VOLUMES[volume.id] : null
  const prevOpen = prev ? unlockedIds.includes(prev.id) || prev.lock.kind === 'free' : false
  const nextOpen = next ? unlockedIds.includes(next.id) || next.lock.kind === 'free' : false

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    startX.current = event.clientX
  }
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return
    const delta = event.clientX - startX.current
    startX.current = null
    if (Math.abs(delta) < 48) return
    if (delta < 0) nextPage()
    else previousPage()
  }

  return (
    <div className="story-album relative min-h-screen overflow-hidden px-4 pb-16 pt-8 sm:px-6">
      <div className="story-album-stars" aria-hidden="true" />
      <button
        type="button"
        onClick={onClose}
        className="fixed right-5 top-20 z-50 inline-flex h-9 items-center gap-2 rounded-full border border-gold-300/30 bg-ink/85 px-4 text-[12px] tracking-[.2em] text-dim backdrop-blur transition-colors hover:border-[rgba(246,227,180,.55)] hover:text-gold-300"
      >
        <X size={14} />
        合上画册
      </button>

      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.35em] text-gold-300/70">The End · Story Album</p>
          <h1 className="mt-2 font-serifsc text-[22px] font-black tracking-[.16em] text-bone">卷{volume.numeral} · {volume.title}</h1>
        </div>
        <div className="hidden items-center gap-3 text-right sm:flex">
          <span className="text-[11px] tracking-[.16em] text-faint">左右翻页 / 触控滑动</span>
          <span className="h-8 w-px bg-gold-300/20" />
          <span className="font-mono text-[12px] text-gold-300">{String(pageIndex + 1).padStart(2, '0')} / {String(pages.length).padStart(2, '0')}</span>
        </div>
      </div>

      <div
        className="story-album-stage mx-auto max-w-[1180px]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        role="region"
        aria-label="终焉剧情画册"
      >
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.article
            key={`${volume.id}-${pageIndex}`}
            custom={direction}
            className={cn('story-album-page', `story-album-page-${page.kind}`)}
            initial={{ opacity: 0, rotateY: direction > 0 ? 82 : -82, x: direction > 0 ? 36 : -36 }}
            animate={{ opacity: 1, rotateY: 0, x: 0 }}
            exit={{ opacity: 0, rotateY: direction > 0 ? -82 : 82, x: direction > 0 ? -36 : 36 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="story-album-art" style={{ backgroundImage: `url(${page.image})` }}>
              <div className="story-album-art-wash" />
              <div className="story-album-art-grid" />
              <div className="story-album-art-caption">
                <span>终焉世界 · 视觉残响</span>
                <span>{volume.numeral} / {pageIndex + 1}</span>
              </div>
            </div>

            <div className="story-album-copy">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.34em] text-gold-300/75">
                <Icon size={14} strokeWidth={1.4} />
                <span>{page.label}</span>
              </div>
              <div className="mt-8 flex items-start gap-4">
                <span className="story-album-page-mark" style={{ color: page.accent }}>
                  {String(pageIndex + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-serifsc text-[28px] font-black leading-tight tracking-[.1em] text-bone sm:text-[38px]">{page.title}</h2>
                  {page.kind === 'cover' && <p className="mt-5 font-mashan text-[21px] tracking-[.2em] text-gold-300/85">{page.body}</p>}
                </div>
              </div>

              {page.kind !== 'cover' && (
                <p className="story-album-body mt-8 font-serifsc text-[16px] leading-[2.1] tracking-[.05em] text-bone/85 sm:text-[18px]">
                  {page.body}
                </p>
              )}

              {page.kind === 'cover' && (
                <div className="mt-auto flex items-end justify-between gap-6 pt-12">
                  <p className="max-w-[280px] text-[12px] leading-7 tracking-[.14em] text-dim">每一页都是一段已发生的记忆。读完它，才有资格把线索带回牌桌。</p>
                  <span className="seal-stamp inline-flex h-14 w-14 shrink-0 items-center justify-center font-mashan text-xl">启</span>
                </div>
              )}

              {page.kind === 'clue' && (
                <div className="story-album-note mt-10">
                  <span className="text-[10px] tracking-[.25em] text-gold-300/70">ARCHIVE NOTE</span>
                  <p className="mt-2 text-[12px] leading-6 text-dim">线索只改变你观察世界的方式，不替你决定下一场游戏。</p>
                </div>
              )}

              {page.kind === 'memory' && (
                <div className="story-album-memory mt-10">
                  <Fingerprint size={18} className="text-gold-300" />
                  <div>
                    <p className="text-[11px] tracking-[.2em] text-gold-100">记忆卡片已写入旅人档案</p>
                    <p className="mt-1 text-[11px] leading-5 text-dim">回到书架后，可继续启封下一卷或进入对应大陆玩法。</p>
                  </div>
                </div>
              )}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="mx-auto mt-6 flex max-w-[1180px] items-center justify-between gap-3">
        <button type="button" onClick={previousPage} disabled={pageIndex === 0 || isFlipping} className="story-album-control">
          <ChevronLeft size={16} /> 上一页
        </button>
        <div className="flex items-center gap-1.5" aria-label="画册进度">
          {pages.map((item, index) => (
            <button
              key={`${item.kind}-${index}`}
              type="button"
              aria-label={`跳转到第${index + 1}页`}
              onClick={() => turnTo(index)}
              className={cn('story-album-dot', index === pageIndex && 'is-active')}
            />
          ))}
        </div>
        <button type="button" onClick={nextPage} disabled={pageIndex === pages.length - 1 || isFlipping} className="story-album-control story-album-control-next">
          下一页 <ChevronRight size={16} />
        </button>
      </div>

      <div className="mx-auto mt-8 grid max-w-[1180px] grid-cols-2 gap-3 sm:gap-4">
        {[
          { volume: prev, open: prevOpen, direction: 'prev' as const },
          { volume: next, open: nextOpen, direction: 'next' as const },
        ].map(({ volume: adjacent, open, direction: adjacentDirection }) =>
          adjacent ? (
            <button
              key={adjacentDirection}
              type="button"
              disabled={!open}
              onClick={() => open && onNavigate(adjacent.id)}
              className={cn('story-album-adjacent', adjacentDirection === 'next' && 'text-right', !open && 'is-locked')}
            >
              <span className="flex items-center gap-2 text-[10px] tracking-[.25em] text-faint">
                {open ? (adjacentDirection === 'next' ? '下一卷' : '上一卷') : <Lock size={12} />}
              </span>
              <span className="mt-1 block font-serifsc text-[14px] text-bone/80">卷{adjacent.numeral} · {adjacent.title}</span>
            </button>
          ) : (
            <span key={adjacentDirection} />
          ),
        )}
      </div>

      <p className="mt-8 text-center text-[10px] tracking-[.22em] text-faint">提示：使用 ← → 翻页，空格继续，Esc 合上画册</p>
    </div>
  )
}

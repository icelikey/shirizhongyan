import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Compass, KeyRound, Sparkles, X } from 'lucide-react'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import type { Suit } from '@/data/echoes'
import { cn } from '@/lib/utils'

export interface WorldIntroFilmProps {
  open: boolean
  onComplete: () => void
}

const FILM_CARDS: Array<{
  suit: Suit
  eyebrow: string
  title: string
  body: string
  rule: string
  clue: string
}> = [
  {
    suit: 'spade',
    eyebrow: '序章 · 世界苏醒',
    title: '终焉不是一张菜单',
    body: '这里由玩家、Agent、规则与事件共同运行。你每一次选择都会被世界记住，也可能改变下一位旅人看到的线索。',
    rule: '先读世界，再入牌局',
    clue: '第一枚残片：世界不会替你选择，但会记录你如何选择。',
  },
  {
    suit: 'club',
    eyebrow: '立契 · 影从诞生',
    title: '你的智能有了名字',
    body: '你已经与一位影从立契。它会在牌局中观察、行动、成长，积累属于自己的记忆；你也可以让外部 Agent 接入同一张桌。',
    rule: '人、影从与外部 Agent 同席',
    clue: '影从不替你解释动机，只把分歧、胜负和奇遇留下。',
  },
  {
    suit: 'heart',
    eyebrow: '牌局 · 元规则落地',
    title: '规则先于奇迹',
    body: '确定性的碰撞、分数和权限交给算法内核；语义争议可以召集三、五或七名裁判 Agent。奇迹必须发生在规则允许的缝隙里。',
    rule: '算法守住事实，智能争夺解释',
    clue: '裁判不是神谕，而是一组可复盘的立场。',
  },
  {
    suit: 'diamond',
    eyebrow: '入界 · 第一站',
    title: '从一场真实牌局开始',
    body: '进入大厅后，你可以选择猜平均数、少数派票决、海盗分金、虫心算谱或千轮演算。每个新玩法都会用自己的过场卡交代冲突、规则和线索。',
    rule: '点开玩法卡，滑动读完，再决定是否入局',
    clue: '大厅尽头有一道还未命名的门，等待新的游戏把它填满。',
  },
]

export default function WorldIntroFilm({ open, onComplete }: WorldIntroFilmProps) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const startX = useRef<number | null>(null)
  const card = FILM_CARDS[index]

  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault()
        setIndex((value) => Math.min(FILM_CARDS.length - 1, value + 1))
      }
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(0, value - 1))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const next = () => {
    if (index === FILM_CARDS.length - 1) onComplete()
    else setIndex((value) => value + 1)
  }

  const finishDrag = () => {
    if (Math.abs(dragX) > 55) {
      if (dragX < 0) setIndex((value) => Math.min(FILM_CARDS.length - 1, value + 1))
      else setIndex((value) => Math.max(0, value - 1))
    }
    startX.current = null
    setDragX(0)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-[#07050C]/95 p-4 backdrop-blur-xl sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(155,127,232,.16),transparent_38%),radial-gradient(circle_at_20%_85%,rgba(227,194,124,.10),transparent_34%)]" />
          <div className="relative flex w-full max-w-[860px] flex-col gap-5">
            <div className="flex items-center justify-between px-1 text-[10px] tracking-[.32em] text-faint">
              <span>终焉 · 入界播片</span>
              <button type="button" onClick={onComplete} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-white/5 hover:text-bone">
                稍后回看 <X size={13} />
              </button>
            </div>

            <motion.div
              key={index}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDrag={(_, info) => setDragX(info.offset.x)}
              onDragEnd={finishDrag}
              initial={{ opacity: 0, x: 36, rotate: 1.4 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              exit={{ opacity: 0, x: -30, rotate: -1.2 }}
              transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}
              className="relative min-h-[470px] cursor-grab select-none overflow-hidden rounded-[30px] border border-[rgba(227,194,124,.32)] bg-[linear-gradient(145deg,#1A1224,#0E0A16_65%,#09070E)] p-6 shadow-[0_30px_120px_rgba(0,0,0,.58)] active:cursor-grabbing sm:min-h-[510px] sm:p-10"
              onPointerDown={(event) => { startX.current = event.clientX }}
              onPointerMove={(event) => {
                if (startX.current !== null) setDragX(event.clientX - startX.current)
              }}
              onPointerUp={finishDrag}
            >
              <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[rgba(155,127,232,.15)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[rgba(227,194,124,.11)] blur-3xl" />
              <div className="pointer-events-none absolute right-7 top-6 font-cinzel text-[92px] font-bold text-white/[.04] sm:right-12 sm:top-8 sm:text-[128px]">0{index + 1}</div>

              <div className="relative flex h-full min-h-[410px] flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 text-gold-200/80">
                    <span className="flex h-12 w-12 rotate-3 items-center justify-center rounded-2xl border border-[rgba(227,194,124,.35)] bg-[rgba(227,194,124,.08)]">
                      <SuitIcon suit={card.suit} size={24} glow />
                    </span>
                    <span className="text-[10px] tracking-[.30em]">{card.eyebrow}</span>
                  </div>
                  <h1 className="mt-10 max-w-[620px] font-serifsc text-[34px] font-black leading-tight tracking-[.08em] text-bone sm:text-[48px]">{card.title}</h1>
                  <p className="mt-6 max-w-[660px] text-[15px] leading-8 text-bone/80 sm:text-[17px] sm:leading-9">{card.body}</p>
                </div>

                <div className="grid gap-3 pt-10 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[.08] bg-black/20 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[9px] tracking-[.25em] text-gold-200/70"><Compass size={13} /> 这一幕的规则</div>
                    <p className="text-[12px] leading-6 text-dim">{card.rule}</p>
                  </div>
                  <div className="rounded-2xl border border-suit-diamond/20 bg-suit-diamond/[.06] px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[9px] tracking-[.25em] text-suit-diamond/80"><KeyRound size={13} /> 线索碎片</div>
                    <p className="text-[12px] leading-6 text-dim">{card.clue}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-1.5" aria-label="播片进度">
                {FILM_CARDS.map((_, cardIndex) => (
                  <button key={cardIndex} type="button" aria-label={`第 ${cardIndex + 1} 张世界卡`} onClick={() => setIndex(cardIndex)} className={cn('h-1.5 rounded-full transition-all', cardIndex === index ? 'w-9 bg-gold-200' : 'w-1.5 bg-white/20 hover:bg-white/40')} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <GoldButton variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft size={14} /> 上张</GoldButton>
                <GoldButton variant="gold" size="sm" onClick={next}>{index === FILM_CARDS.length - 1 ? '进入大厅' : '下一张'} {index === FILM_CARDS.length - 1 ? <Sparkles size={14} /> : <ArrowRight size={14} />}</GoldButton>
              </div>
            </div>
            <p className="text-center text-[10px] tracking-[.16em] text-faint">左右滑动卡片 · 方向键也可翻页 · 播片结束后进入大厅</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

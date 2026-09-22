/**
 * 十日残章 · 阅读视图「烛光夜读」（lore.md §视图二）。
 * GSAP ScrollTrigger：卷首插画视差（scale 1.15→1 / 亮度 .6→1）、段落入场（y+blur）、
 * 首字下沉缩放、卷终印章落定（落定瞬间回报已读）。
 * 本组件树只用 GSAP，不用 framer-motion（库隔离）。
 */
import { useRef } from 'react'
import { X, Lock, ChevronLeft, ChevronRight } from 'lucide-react'
import type { LoreVolume } from '@/data/lore'
import { LORE_VOLUMES } from '@/data/lore'
import { gsap, useGSAP } from '@/lib/gsap'
import { SunDivider, Sundial } from '@/components/content/shared'
import { cn } from '@/lib/utils'

export interface ReadingViewProps {
  volume: LoreVolume
  unlockedIds: number[]
  onClose: () => void
  onNavigate: (id: number) => void
  /** 卷终印章落定时触发（页面侧负责「首次阅读」判定与奖励） */
  onFinishReading: (id: number) => void
}

export default function ReadingView({ volume, unlockedIds, onClose, onNavigate, onFinishReading }: ReadingViewProps) {
  const root = useRef<HTMLDivElement>(null)
  const reported = useRef(false)
  const finishRef = useRef(onFinishReading)
  finishRef.current = onFinishReading

  useGSAP(
    () => {
      /* 卷首插画视差 */
      const banner = root.current?.querySelector('.lore-banner-img')
      if (banner) {
        gsap.fromTo(
          banner,
          { scale: 1.15, filter: 'brightness(.55)' },
          {
            scale: 1,
            filter: 'brightness(1)',
            ease: 'none',
            scrollTrigger: { trigger: '.lore-banner', start: 'top 85%', end: 'top 15%', scrub: true },
          },
        )
        gsap.fromTo(
          '.lore-banner-title',
          { opacity: 0, y: 40, filter: 'blur(8px)' },
          {
            opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out',
            scrollTrigger: { trigger: '.lore-banner', start: 'top 45%' },
          },
        )
      }

      /* 正文段落 + 首字 */
      gsap.utils.toArray<HTMLElement>('.lore-para').forEach((p) => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: p, start: 'top 78%' },
          defaults: { ease: 'power2.out' },
        })
        tl.fromTo(p, { opacity: 0, y: 30, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6 })
        const cap = p.querySelector('.drop-cap')
        if (cap) tl.fromTo(cap, { scale: 1.35 }, { scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0.1)
      })

      /* 分隔日轮：滚动经过依次点亮 */
      gsap.utils.toArray<HTMLElement>('.lore-divider').forEach((d) => {
        gsap.fromTo(
          d.querySelectorAll('.sun-dot'),
          { opacity: 0.12, scale: 0.7 },
          {
            opacity: 1, scale: 1, duration: 0.4, stagger: 0.18, ease: 'power1.out',
            scrollTrigger: { trigger: d, start: 'top 82%' },
          },
        )
      })

      /* 卷终印章落定 */
      gsap.fromTo(
        '.lore-end-seal',
        { scale: 1.5, rotate: -16, opacity: 0 },
        {
          scale: 1, rotate: -4, opacity: 1, duration: 0.5, ease: 'back.out(2.4)',
          scrollTrigger: {
            trigger: '.lore-end-seal',
            start: 'top 80%',
            onEnter: () => {
              gsap.fromTo(root.current, { y: 2 }, { y: 0, duration: 0.14, ease: 'power1.out' })
              if (!reported.current) {
                reported.current = true
                finishRef.current(volume.id)
              }
            },
          },
        },
      )
    },
    { scope: root },
  )

  const prev = volume.id > 1 ? LORE_VOLUMES[volume.id - 2] : null
  const next = volume.id < 10 ? LORE_VOLUMES[volume.id] : null
  const prevOpen = prev ? unlockedIds.includes(prev.id) || prev.lock.kind === 'free' : false
  const nextOpen = next ? unlockedIds.includes(next.id) || next.lock.kind === 'free' : false

  return (
    <div ref={root} className="relative">
      <Sundial label={`卷${volume.numeral}`} />

      {/* 合上卷轴 */}
      <button
        type="button"
        onClick={onClose}
        className="fixed right-5 top-20 z-50 inline-flex items-center gap-2 rounded-full border border-gold-300/30 bg-ink/85 backdrop-blur px-4 h-9 text-[12px] tracking-[.2em] text-dim hover:text-gold-300 hover:border-[rgba(246,227,180,.55)] transition-colors"
      >
        <X size={14} />
        合上卷轴
      </button>

      {/* 两侧竖排装饰引 */}
      <span className="vertical-rl fixed left-6 top-1/2 -translate-y-1/2 z-30 hidden xl:block font-serifsc text-gold-300/50 text-[15px] tracking-[.5em] pointer-events-none">
        {volume.title}
      </span>
      <span className="vertical-rl fixed right-16 top-1/2 -translate-y-1/2 z-30 hidden xl:block font-mashan text-faint text-[14px] tracking-[.5em] pointer-events-none">
        十日终焉 · 卷{volume.numeral}
      </span>

      <div className="mx-auto max-w-[680px] px-6 pb-24 pt-10">
        {/* 卷首插画横幅 */}
        {volume.banner && (
          <div className="lore-banner relative rounded-[24px] overflow-hidden border border-gold-300/30 shadow-card" style={{ aspectRatio: '21/9' }}>
            <img
              src={volume.banner}
              alt={volume.title}
              draggable={false}
              className="lore-banner-img absolute inset-0 w-full h-full object-cover will-change-transform"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-abyss/80 via-transparent to-abyss/30" />
            <div className="lore-banner-title absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="font-cinzel text-[11px] tracking-[.5em] text-gold-100/70">SCROLL {volume.id}</span>
              <h2 className="gold-text font-serifsc font-black text-[40px] tracking-[.2em] drop-shadow-[0_4px_24px_rgba(0,0,0,.8)]">
                {volume.title}
              </h2>
            </div>
          </div>
        )}
        {!volume.banner && (
          <div className="text-center pt-8">
            <span className="font-cinzel text-[11px] tracking-[.5em] text-faint">SCROLL {volume.id}</span>
            <h2 className="gold-text font-serifsc font-black text-[40px] tracking-[.2em] mt-2">{volume.title}</h2>
          </div>
        )}

        {/* 引首（竖排短句） */}
        <div className="flex justify-center py-8">
          <span className="vertical-rl font-mashan text-gold-300/85 text-[20px] tracking-[.4em] h-[180px]">
            {volume.quote}
          </span>
        </div>

        {/* 正文 */}
        <article className="flex flex-col gap-7">
          {volume.paragraphs.map((para, i) => (
            <div key={i}>
              <p
                className="lore-para font-serifsc font-semibold text-bone/90 text-[17px] leading-[2.0] tracking-[.04em] text-justify"
              >
                <span className="drop-cap float-left font-mashan text-gold-300 text-[58px] leading-[.85] mr-3 mt-1.5 drop-shadow-[0_0_12px_rgba(227,194,124,.4)]">
                  {para.charAt(0)}
                </span>
                {para.slice(1)}
              </p>
              {i < volume.paragraphs.length - 1 && i % 2 === 1 && (
                <SunDivider className="lore-divider mt-7" />
              )}
            </div>
          ))}
        </article>

        {/* 卷终 */}
        <div className="mt-14 flex flex-col items-center gap-5">
          <SunDivider className="lore-divider" />
          <span className="lore-end-seal seal-stamp flex items-center justify-center w-[72px] h-[72px] text-[26px] font-mashan">
            卷终
          </span>
          <p className="text-faint text-[12px] tracking-[.3em]">卷{volume.numeral} · {volume.title} · 终</p>
        </div>

        {/* 相邻卷导航 */}
        <div className="mt-12 grid grid-cols-2 gap-4">
          {[
            { v: prev, open: prevOpen, dir: 'prev' as const, icon: <ChevronLeft size={14} /> },
            { v: next, open: nextOpen, dir: 'next' as const, icon: <ChevronRight size={14} /> },
          ].map(({ v, open, dir, icon }) =>
            v ? (
              <button
                key={dir}
                type="button"
                disabled={!open}
                onClick={() => open && onNavigate(v.id)}
                className={cn(
                  'panel-bg rounded-xl px-4 py-3 flex items-center gap-2 text-left transition-all duration-200',
                  dir === 'next' && 'flex-row-reverse text-right',
                  open ? 'hover:border-[rgba(246,227,180,.45)] hover:-translate-y-0.5 cursor-pointer' : 'opacity-45 cursor-not-allowed',
                )}
              >
                <span className="text-gold-300/70 shrink-0">{open ? icon : <Lock size={14} />}</span>
                <span className="min-w-0">
                  <span className="block text-[10px] tracking-[.3em] text-faint">卷{v.numeral}</span>
                  <span className="block font-serifsc text-[14px] text-bone/85 truncate">{v.title}</span>
                </span>
              </button>
            ) : (
              <span key={dir} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

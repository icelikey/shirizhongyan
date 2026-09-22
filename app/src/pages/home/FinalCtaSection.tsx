/**
 * S5 · 终章 CTA「你的十日，从此刻开始」（home.md S5，80vh）
 * 中央：巨大日蚀环（CountdownRing hero 缩小为装饰，半透明，随滚动自转）前的登录引导卡。
 */
import { useRef } from 'react'
import CountdownRing from '@/components/CountdownRing'
import GoldButton from '@/components/GoldButton'
import PageFooter from '@/components/PageFooter'
import { gsap, useGSAP } from '@/lib/gsap'

export default function FinalCtaSection({ onEnter }: { onEnter: (e: React.MouseEvent) => void }) {
  const root = useRef<HTMLElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      gsap.to(ringRef.current, {
        rotate: 120,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true },
      })
      gsap.fromTo(
        '.final-card',
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 60%', once: true },
        },
      )
    },
    { scope: root },
  )

  return (
    <section ref={root} className="relative min-h-[80dvh] flex flex-col" id="s5">
      <div className="flex-1 flex items-center justify-center relative px-6 py-24">
        {/* 装饰日蚀环 */}
        <div ref={ringRef} className="absolute opacity-40 animate-breathe pointer-events-none">
          <CountdownRing variant="hero" size={380}>
            <img src="/eclipse-suns.png" alt="" aria-hidden className="w-full h-full object-contain opacity-70 animate-spin-slower" draggable={false} />
          </CountdownRing>
        </div>
        {/* 登录引导卡 */}
        <div className="final-card relative z-10 w-[480px] max-w-full panel-bg rounded-[18px] border border-[rgba(227,194,124,.28)] px-10 py-12 flex flex-col items-center gap-6 text-center">
          <h2 className="gold-text font-mashan text-[40px] tracking-[.3em]">立 契</h2>
          <p className="text-dim text-[15px] tracking-[.2em]">与影从立契，渡此十日。</p>
          <GoldButton variant="gold" size="xl" className="gold-sweep tracking-[.3em]" onClick={onEnter}>
            缔结契约 · 进入世界
          </GoldButton>
        </div>
      </div>
      <PageFooter />
    </section>
  )
}

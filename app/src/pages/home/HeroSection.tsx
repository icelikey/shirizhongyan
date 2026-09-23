/**
 * S0 · Hero「终焉倒计时」（home.md S0）
 * 全屏：星云底 + hero-gate 中景视差 + 6 枚漂浮牌背碎片；
 * 中央 CountdownRing hero（中心 eclipse-suns 120s 自转）+ 巨题「终焉」+ 倒计时翻字；
 * 左右竖排楹联；底部 CTA。sticky 200vh 实现 pin，前 50% 滚动巨题展距淡出、日蚀放大、门扉上移。
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '@/store/profile'
import { getCountdown, formatHMS, COUNTDOWN_TICK_MS } from '@/lib/countdown'
import CountdownRing from '@/components/CountdownRing'
import GoldButton from '@/components/GoldButton'
import { gsap, useGSAP } from '@/lib/gsap'

/** 秒位翻字：值变化时新数下入（CSS keyframes，避免与 GSAP 混库） */
function FlipClock() {
  const createdAt = useProfile((s) => s.session?.createdAt)
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(t)
  }, [])
  const anchor = createdAt ?? new Date().setHours(0, 0, 0, 0)
  const cd = getCountdown(anchor)
  const hms = formatHMS(cd.remainMs)
  return (
    <p className="font-cinzel font-bold text-[28px] tracking-[.08em]" style={{ color: cd.crisis ? '#F0655A' : '#E3C27C' }}>
      第 {cd.day} 日 ·{' '}
      <span key={hms} className="flip-digit inline-block">
        {hms}
      </span>{' '}
      <span className="text-[16px] text-dim font-semibold tracking-[.3em]">至终焉</span>
      <style>{`@keyframes flipIn{from{transform:translateY(60%);opacity:0}to{transform:translateY(0);opacity:1}}.flip-digit{animation:flipIn .3s cubic-bezier(.22,1,.36,1)}}`}</style>
    </p>
  )
}

/** 漂浮牌背碎片（6 枚，视差前景） */
function FloatingCards() {
  const cards = [
    { left: '12%', top: '22%', size: 54, delay: '0s', dur: '6.5s', o: 0.4 },
    { left: '82%', top: '18%', size: 44, delay: '-2s', dur: '7.5s', o: 0.35 },
    { left: '8%', top: '62%', size: 62, delay: '-1s', dur: '8.5s', o: 0.3 },
    { left: '88%', top: '58%', size: 58, delay: '-3.5s', dur: '6s', o: 0.45 },
    { left: '22%', top: '80%', size: 40, delay: '-4.5s', dur: '9s', o: 0.28 },
    { left: '72%', top: '78%', size: 48, delay: '-1.8s', dur: '7s', o: 0.33 },
  ]
  return (
    <>
      {cards.map((c, i) => (
        <img
          key={i}
          src="/card-back.png"
          alt=""
          aria-hidden
          draggable={false}
          className="absolute rounded-md animate-float-y pointer-events-none z-[5]"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            opacity: c.o,
            animationDelay: c.delay,
            animationDuration: c.dur,
            filter: 'blur(.4px)',
          }}
        />
      ))}
    </>
  )
}

export interface HeroSectionProps {
  /** 点击 CTA（未登录=开启契约仪式；已登录=墨染过渡回大厅） */
  onEnter: (e: React.MouseEvent) => void
  /** 平滑滚至 S1 */
  onLearnMore: () => void
}

export default function HeroSection({ onEnter, onLearnMore }: HeroSectionProps) {
  const loggedIn = useProfile((s) => s.session !== null)
  const root = useRef<HTMLElement>(null)
  const gateRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const nebulaRef = useRef<HTMLDivElement>(null)
  const eclipseRef = useRef<HTMLImageElement>(null)
  const [gateBright, setGateBright] = useState(false)

  useGSAP(
    () => {
      /* ---- 载入序列（总 ~1.8s） ---- */
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      tl.fromTo(nebulaRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 })
        .fromTo(gateRef.current, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, '-=0.1')
        .fromTo(ringRef.current, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7 }, '-=0.25')
        .fromTo(
          '.hero-char',
          { y: 40, opacity: 0, filter: 'blur(8px)' },
          { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, stagger: 0.09 },
          '-=0.4',
        )
        .fromTo('.hero-sub', { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.08 }, '-=0.3')
        .fromTo(ctaRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.1')

      /* ---- 滚动：sticky 容器内 scrub（外层 200vh） ---- */
      gsap.to(titleRef.current, {
        letterSpacing: '.3em',
        opacity: 0,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: '50% bottom', scrub: true },
      })
      gsap.fromTo(
        eclipseRef.current,
        { scale: 1 },
        {
          scale: 1.15,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true },
        },
      )
      gsap.to(gateRef.current, {
        yPercent: -14,
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true },
      })
    },
    { scope: root },
  )

  return (
    <section ref={root} className="relative h-[200dvh]" id="s0">
      <div className="sticky top-0 h-[100dvh] overflow-hidden">
        {/* 星云底 */}
        <div ref={nebulaRef} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/bg-nebula-abyss.png')" }} />
        {/* 世界之门中景（门扉位于画面下 2/3） */}
        <img
          ref={gateRef}
          src="/hero-gate.png"
          alt="世界之门"
          draggable={false}
          className="absolute left-1/2 -translate-x-1/2 bottom-[-8%] w-[120%] max-w-none object-cover transition-[filter] duration-500 z-[2]"
          style={{
            maskImage: 'linear-gradient(180deg, transparent 0%, #000 22%)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%)',
            filter: gateBright ? 'brightness(1.25) saturate(1.1)' : 'brightness(1)',
          }}
        />
        <FloatingCards />

        {/* 中央内容 */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center gap-3 px-6">
          <div ref={ringRef}>
            <CountdownRing variant="hero" size={320}>
              <img
                ref={eclipseRef}
                src="/eclipse-suns.png"
                alt="十日日蚀"
                draggable={false}
                className="w-full h-full object-contain animate-spin-slower"
              />
            </CountdownRing>
          </div>

          <h1
            ref={titleRef}
            className="gold-text font-mashan leading-[1.05] tracking-[.12em] text-center -mt-10"
            style={{ fontSize: 'clamp(64px, 9vw, 110px)' }}
          >
            {'终焉'.split('').map((ch, i) => (
              <span key={i} className="hero-char inline-block">
                {ch}
              </span>
            ))}
          </h1>
          <p className="hero-sub font-cinzel font-semibold text-[14px] tracking-[.5em] text-dim">TEN DAYS GAMBIT</p>

          <div className="hero-sub mt-1">
            <FlipClock />
          </div>

          <div ref={ctaRef} className="mt-5 flex flex-col items-center gap-3">
            <GoldButton
              variant="gold"
              size="xl"
              className="gold-sweep tracking-[.4em] animate-breathe"
              onClick={onEnter}
              onMouseEnter={() => setGateBright(true)}
              onMouseLeave={() => setGateBright(false)}
            >
              {loggedIn ? '返 回 大 厅' : '进 入 牌 局 之 间'}
            </GoldButton>
            <button
              type="button"
              onClick={onLearnMore}
              className="text-[13px] text-dim tracking-[.25em] hover:text-gold-300 transition-colors"
            >
              了解这个世界 ↓
            </button>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <Link to="/lobby" className="rounded-full border border-suit-club/30 bg-suit-club/10 px-3 py-1.5 text-[10px] tracking-[.18em] text-suit-club transition-colors hover:bg-suit-club/20">
                进入真实牌局
              </Link>
              <Link to="/agent-portal" className="rounded-full border border-suit-diamond/30 bg-suit-diamond/10 px-3 py-1.5 text-[10px] tracking-[.18em] text-suit-diamond transition-colors hover:bg-suit-diamond/20">
                外部 Agent 接入
              </Link>
            </div>
            <p className="max-w-[560px] text-center text-[11px] tracking-[.12em] text-faint">
              你以为你在选牌，牌在选择你；你以为你在看局，局在记录你。
            </p>
          </div>
        </div>

        {/* 左右竖排楹联 */}
        <span className="hero-sub vertical-rl font-mashan text-[22px] text-faint absolute left-8 top-1/2 -translate-y-1/2 z-20 hidden lg:block">
          世界每十日终结一次
        </span>
        <span className="hero-sub vertical-rl font-mashan text-[22px] text-faint absolute right-8 top-1/2 -translate-y-1/2 z-20 hidden lg:block">
          胜者携记忆碎片而行
        </span>
      </div>
    </section>
  )
}

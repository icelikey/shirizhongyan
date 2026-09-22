/**
 * S3 · 两大对局「牌局之间 · 两座主场」（home.md S3，110vh）
 * 左右双联面板（各 50%，560px 高）：月影狼人杀♠ / 猜平均数♣；
 * 中央「VS」日轮徽章（64px 自转 30s）；入场自左右 120px 滑入；数字 count-up；
 * 悬停背景缓慢 scale 1→1.06（8s）；「立即开局」需登录。
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { useProfile } from '@/store/profile'
import SuitIcon from '@/components/SuitIcon'
import GoldButton from '@/components/GoldButton'
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap'

/** 数字 count-up（进入视口触发一次） */
function CountUp({ value, suffix }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        const obj = { n: 0 }
        gsap.to(obj, {
          n: value,
          duration: 1.2,
          ease: 'power2.out',
          onUpdate: () => setDisplay(Math.round(obj.n)),
        })
      },
    })
    return () => st.kill()
  }, [value])
  return (
    <span ref={ref} className="font-mono font-semibold">
      {display}
      {suffix}
    </span>
  )
}

interface GamePanel {
  suit: Suit
  title: string
  bg: string
  lines: string[]
  fee: number
  reward: number
  anchor: string
}

const PANELS: GamePanel[] = [
  {
    suit: 'spade',
    title: '月影狼人杀',
    bg: '/bg-village-night.png',
    lines: ['6 人局 · 真人 + AI 影从混坐', '2 狼 1 预言家 1 女巫 2 民', '昼夜交替 · 发言与投票'],
    fee: 15,
    reward: 60,
    anchor: 'werewolf',
  },
  {
    suit: 'club',
    title: '猜平均数',
    bg: '/bg-abacus-court.png',
    lines: ['6 人局 · 秘密出数 0-100', '取全员平均值之 2/3', '5 轮积分 · 心算与读心'],
    fee: 10,
    reward: 50,
    anchor: 'guess',
  },
]

function Panel({ p, side, onPlay }: { p: GamePanel; side: 'left' | 'right'; onPlay: () => void }) {
  const navigate = useNavigate()
  const meta = SUIT_META[p.suit]
  return (
    <div
      className={`game-panel game-panel-${side} group relative w-full lg:w-[calc(50%-48px)] h-[560px] rounded-[18px] card-frame overflow-hidden`}
      style={{ borderColor: `${meta.color}44` }}
    >
      {/* 背景（悬停 8s 缓慢放大） */}
      <img
        src={p.bg}
        alt={p.title}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover transition-transform [transition-duration:8000ms] ease-linear group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/60 to-abyss/20" />
      {/* 信息 */}
      <div className="relative z-10 h-full flex flex-col justify-end p-8 gap-4">
        <div className="flex items-center gap-3">
          <span style={{ color: meta.color, filter: `drop-shadow(0 0 10px ${meta.glow})` }}>
            <SuitIcon suit={p.suit} size={32} glow />
          </span>
          <h3 className="font-serifsc font-black text-[32px] text-bone tracking-wider">{p.title}</h3>
        </div>
        <ul className="flex flex-col gap-1.5">
          {p.lines.map((l, i) => (
            <li key={i} className="text-[14px] text-dim tracking-wider flex items-center gap-2">
              <span className="w-1 h-1 rounded-full" style={{ background: meta.color }} />
              {l}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-6 text-[14px]" style={{ color: meta.color }}>
          <span>门票 <CountUp value={p.fee} /> {meta.symbol}</span>
          <span>胜方 <CountUp value={p.reward} suffix={` ${meta.symbol}`} /></span>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <GoldButton variant="ghost" size="md" onClick={() => navigate(`/codex#${p.anchor}`)}>
            查看规则
          </GoldButton>
          <GoldButton variant="suit" suit={p.suit} size="md" className="gold-sweep" onClick={onPlay}>
            立即开局
          </GoldButton>
        </div>
      </div>
    </div>
  )
}

export default function GamesSection({ onRequireLogin }: { onRequireLogin: () => void }) {
  const root = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const loggedIn = useProfile((s) => s.session !== null)

  useGSAP(
    () => {
      gsap.fromTo(
        '.game-panel-left',
        { x: -120, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 65%', once: true },
        },
      )
      gsap.fromTo(
        '.game-panel-right',
        { x: 120, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 65%', once: true },
        },
      )
      gsap.fromTo(
        '.vs-badge',
        { scale: 0 },
        {
          scale: 1,
          duration: 0.6,
          ease: 'back.out(2)',
          scrollTrigger: { trigger: root.current, start: 'top 60%', once: true },
        },
      )
      gsap.fromTo(
        '.games-head',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 75%', once: true },
        },
      )
    },
    { scope: root },
  )

  const play = () => {
    if (!loggedIn) onRequireLogin()
    else navigate('/lobby')
  }

  return (
    <section ref={root} className="relative min-h-[110dvh] py-24 px-6 flex flex-col items-center justify-center" id="s3">
      <div className="games-head text-center mb-14">
        <h2 className="gold-text font-serifsc font-black text-[28px] tracking-[.1em]">牌局之间 · 两座主场</h2>
      </div>
      <div className="relative w-full max-w-[1280px] flex flex-col lg:flex-row items-center justify-between gap-8">
        <Panel p={PANELS[0]} side="left" onPlay={play} />
        {/* VS 日轮徽章 */}
        <div className="vs-badge relative z-20 shrink-0 w-16 h-16 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
          <div className="w-full h-full rounded-full border border-gold-300/50 bg-ink flex items-center justify-center shadow-gold-glow animate-spin-30">
            <span className="font-cinzel font-bold text-gold-300 text-[15px]" style={{ animation: 'spin-slow 30s linear infinite reverse' }}>
              VS
            </span>
          </div>
        </div>
        <Panel p={PANELS[1]} side="right" onPlay={play} />
      </div>
    </section>
  )
}

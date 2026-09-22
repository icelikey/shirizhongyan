/**
 * S2 · 四大陆「云游之境」（home.md S2，120vh）
 * 四张大陆卡（280×370，3:4）：continent-*.png 顶部 2/3 + 墨色信息区下 1/3；
 * 入场：扇形收拢态（rotate ±8° 重叠 40%）展开为横排（ScrollTrigger scrub 0→60%）；
 * 悬停：上浮 12px + 3D 倾斜（max 7°）+ 花色光晕；点击 ♠/♣ 入图鉴（未登录先契约），♥/♦ toast。
 */
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { useProfile } from '@/store/profile'
import SuitIcon from '@/components/SuitIcon'
import { gsap, useGSAP } from '@/lib/gsap'

const CONTINENTS: { suit: Suit; image: string; desc: string; badge: string; anchor: string }[] = [
  { suit: 'spade', image: '/continent-spade.png', desc: '博弈与欺骗之地', badge: '狼人杀主场', anchor: 'werewolf' },
  { suit: 'heart', image: '/continent-heart.png', desc: '心理与谈判之地', badge: '残章·谈判', anchor: '' },
  { suit: 'club', image: '/continent-club.png', desc: '计算与概率之地', badge: '猜平均数主场', anchor: 'guess' },
  { suit: 'diamond', image: '/continent-diamond.png', desc: '资源与竞逐之地', badge: '即将开启', anchor: '' },
]

/* 扇形收拢初态：索引 → 旋转角与横移（重叠 40%） */
const FAN = [
  { rotate: -8, x: '54%' },
  { rotate: -3, x: '18%' },
  { rotate: 3, x: '-18%' },
  { rotate: 8, x: '-54%' },
]

function ContinentCard({
  c,
  onClick,
}: {
  c: (typeof CONTINENTS)[number]
  onClick: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const meta = SUIT_META[c.suit]

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `translateY(-12px) perspective(700px) rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`
    el.style.boxShadow = `0 24px 48px rgba(0,0,0,.6), 0 0 40px ${meta.glow}`
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = ''
    el.style.boxShadow = ''
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="continent-card group relative w-[280px] h-[370px] rounded-[14px] card-frame bg-panel overflow-hidden text-left transition-[box-shadow] duration-300 will-change-transform"
    >
      {/* 图：顶部 2/3 */}
      <div className="h-2/3 overflow-hidden relative">
        <img
          src={c.image}
          alt={meta.realm}
          draggable={false}
          className="w-full h-full object-cover transition-transform [transition-duration:600ms] ease-ink group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
        {/* 左上角花色图标发光 */}
        <span className="absolute top-3 left-3" style={{ color: meta.color, filter: `drop-shadow(0 0 8px ${meta.glow})` }}>
          <SuitIcon suit={c.suit} size={24} />
        </span>
        {/* 角标 */}
        <span
          className="absolute top-3 right-3 text-[10px] tracking-[.15em] px-2 py-1 rounded-full border"
          style={{ color: meta.color, borderColor: `${meta.color}55`, background: 'rgba(7,6,11,.65)' }}
        >
          {c.badge}
        </span>
      </div>
      {/* 信息区：下 1/3 */}
      <div className="h-1/3 px-5 py-4 flex flex-col gap-1 relative">
        <div className="flex items-baseline gap-3">
          <h3 className="font-serifsc font-black text-[24px] text-bone">{meta.realm}</h3>
          <span className="vertical-rl text-[10px] text-faint h-[52px] overflow-hidden">{meta.symbol} {meta.realm}</span>
        </div>
        <p className="text-[13px] text-dim tracking-wider">{c.desc}</p>
        <span className="absolute bottom-3 right-4 text-[10px] tracking-[.2em] text-faint group-hover:text-gold-300 transition-colors">
          {c.anchor ? '云游此地 →' : '迷雾笼罩'}
        </span>
      </div>
    </button>
  )
}

export default function ContinentsSection({ onRequireLogin }: { onRequireLogin: () => void }) {
  const root = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const loggedIn = useProfile((s) => s.session !== null)

  useGSAP(
    () => {
      /* 扇形收拢 → 横排（scrub 0→60% 进度） */
      gsap.utils.toArray<HTMLElement>('.continent-card').forEach((el, i) => {
        gsap.fromTo(
          el,
          { rotate: FAN[i].rotate, xPercent: parseFloat(FAN[i].x), opacity: 0.6 },
          {
            rotate: 0,
            xPercent: 0,
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: root.current, start: 'top 80%', end: 'top 20%', scrub: true },
          },
        )
      })
      gsap.fromTo(
        '.continents-head',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: root.current, start: 'top 90%', end: 'top 55%', scrub: true },
        },
      )
    },
    { scope: root },
  )

  const handleClick = (c: (typeof CONTINENTS)[number]) => {
    if (!c.anchor) {
      toast('此大陆尚在迷雾中，待后续十日揭晓', { icon: <SuitIcon suit={c.suit} size={14} /> })
      return
    }
    if (!loggedIn) {
      onRequireLogin()
      return
    }
    navigate(`/codex#${c.anchor}`)
  }

  return (
    <section ref={root} className="relative min-h-[120dvh] py-24 flex flex-col items-center justify-center" id="s2">
      <div className="continents-head text-center mb-14 px-6">
        <h2 className="gold-text font-serifsc font-black text-[28px] tracking-[.1em]">云游之境 · 四花色大陆</h2>
        <p className="text-dim text-[14px] tracking-[.25em] mt-3">每块大陆，都是一种博弈之道</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 px-6">
        {CONTINENTS.map((c) => (
          <ContinentCard key={c.suit} c={c} onClick={() => handleClick(c)} />
        ))}
      </div>
    </section>
  )
}

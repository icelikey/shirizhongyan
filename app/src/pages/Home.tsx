/**
 * 首页（登录）`/`（design/home.md）
 * 叙事型长滚动页：Lenis + GSAP ScrollTrigger，S0-S5 章节 + §L 契约仪式浮层。
 * 已登录：CTA 变为「返回大厅」，点击墨染过渡至 /lobby。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Lenis from 'lenis'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { getEcho } from '@/data/echoes'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import HeroSection from '@/pages/home/HeroSection'
import LoreSection from '@/pages/home/LoreSection'
import ContinentsSection from '@/pages/home/ContinentsSection'
import GamesSection from '@/pages/home/GamesSection'
import EchoesSection from '@/pages/home/EchoesSection'
import FinalCtaSection from '@/pages/home/FinalCtaSection'
import ContractModal from '@/pages/home/ContractModal'
import MaskIcon from '@/components/MaskIcon'

function HomeMenu({
  loggedIn,
  onEnter,
  onNavigate,
}: {
  loggedIn: boolean
  onEnter: (e: React.MouseEvent) => void
  onNavigate: (id: string) => void
}) {
  const items = [
    { label: '世界', id: 's1' },
    { label: '四境', id: 's2' },
    { label: '牌局', id: 's3' },
  ]

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 py-3 sm:px-8 sm:py-4">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 rounded-full border border-[rgba(227,194,124,.2)] bg-[#0C0A13CC] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,.28)] backdrop-blur-md sm:px-4">
        <button type="button" onClick={() => onNavigate('s0')} className="flex shrink-0 items-center gap-2.5" aria-label="回到世界序章">
          <MaskIcon src="/logo-mark.svg" size={27} color="#E3C27C" />
          <span className="gold-text font-serifsc text-[15px] font-black tracking-wider">十日牌局</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="世界菜单">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => onNavigate(item.id)} className="rounded-full px-3 py-2 text-[11px] tracking-[.18em] text-dim transition-colors hover:bg-gold-300/10 hover:text-gold-100">
              {item.label}
            </button>
          ))}
          <a href="#s4" className="rounded-full px-3 py-2 text-[11px] tracking-[.18em] text-dim transition-colors hover:bg-gold-300/10 hover:text-gold-100">
            影从
          </a>
          <a href="#s5" className="rounded-full px-3 py-2 text-[11px] tracking-[.18em] text-dim transition-colors hover:bg-gold-300/10 hover:text-gold-100">
            入场
          </a>
          <Link to="/codex" className="rounded-full px-3 py-2 text-[11px] tracking-[.18em] text-dim transition-colors hover:bg-gold-300/10 hover:text-gold-100">
            规则
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/characters" className="hidden rounded-full border border-[rgba(227,194,124,.25)] px-3 py-2 text-[11px] tracking-[.15em] text-gold-100/80 transition-colors hover:border-gold-300 hover:text-gold-100 sm:inline-flex">
            角色卡
          </Link>
          <button type="button" onClick={onEnter} className="rounded-full bg-gold-300/15 px-3.5 py-2 text-[11px] tracking-[.16em] text-gold-100 transition-colors hover:bg-gold-300/25">
            {loggedIn ? '进入大厅' : '立契入场'}
          </button>
        </div>
      </div>
    </header>
  )
}

/** 右侧竖排日晷进度刻度（10 格 = 十日，随全局滚动填充） */
function Sundial() {
  const [filled, setFilled] = useState(0)
  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement
        const max = doc.scrollHeight - window.innerHeight
        const p = max > 0 ? window.scrollY / max : 0
        setFilled((prev) => {
          const next = Math.min(10, Math.max(0, Math.round(p * 10)))
          return prev === next ? prev : next
        })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col items-center gap-2 pointer-events-none">
      <span className="vertical-rl text-[10px] tracking-[.4em] text-faint font-mashan">日晷</span>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="w-[3px] h-5 rounded-full transition-colors duration-500"
            style={{
              background: i < filled ? '#E3C27C' : 'rgba(227,194,124,.15)',
              boxShadow: i < filled ? '0 0 6px rgba(227,194,124,.6)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const loggedIn = useProfile((s) => s.session !== null)
  const login = useProfile((s) => s.login)
  const updateCompanion = useProfile((s) => s.updateCompanion)

  const [contractOpen, setContractOpen] = useState(false)
  const [ink, setInk] = useState<{ x: number; y: number } | null>(null)
  const lenisRef = useRef<Lenis | null>(null)

  /* Lenis 平滑滚动（lerp .09）+ ScrollTrigger 同步 */
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

  const openContract = useCallback(() => setContractOpen(true), [])

  /** CTA：已登录 → 墨染过渡回大厅；未登录 → 开启契约仪式 */
  const handleEnter = useCallback(
    (e: React.MouseEvent) => {
      if (loggedIn) setInk({ x: e.clientX, y: e.clientY })
      else setContractOpen(true)
    },
    [loggedIn],
  )

  const handleLearnMore = useCallback(() => {
    lenisRef.current?.scrollTo('#s1', { duration: 1.4 })
  }, [])

  const handleNavigate = useCallback((id: string) => {
    lenisRef.current?.scrollTo(`#${id}`, { duration: 1.1 })
  }, [])

  /** 契约完成：写 store → 欢迎 Toast → 墨染过渡 /lobby */
  const handleContractComplete = useCallback(
    (nickname: string, echoId: string, customName: string) => {
      login(nickname, echoId)
      const echo = getEcho(echoId)
      if (echo && customName !== echo.name) updateCompanion({ customName })
      setContractOpen(false)
      toast.success(`第 1 日 · 旅人【${nickname}】踏入牌局之间`, {
        description: `与${echo?.name ?? '影从'}立契已成，十日倒计时开始了。`,
      })
      setInk({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    },
    [login, updateCompanion],
  )

  return (
    <div className="relative">
      <HomeMenu loggedIn={loggedIn} onEnter={handleEnter} onNavigate={handleNavigate} />
      <Sundial />
      <HeroSection onEnter={handleEnter} onLearnMore={handleLearnMore} />
      <LoreSection />
      <ContinentsSection onRequireLogin={openContract} />
      <GamesSection onRequireLogin={openContract} />
      <EchoesSection />
      <FinalCtaSection onEnter={handleEnter} />

      <ContractModal open={contractOpen} onClose={() => setContractOpen(false)} onComplete={handleContractComplete} />

      {/* 墨染路由过渡：墨从点击处晕开，覆盖后跳转 */}
      <AnimatePresence>
        {ink && (
          <motion.div
            className="fixed inset-0 z-[100] bg-ink"
            initial={{ clipPath: `circle(0% at ${ink.x}px ${ink.y}px)` }}
            animate={{ clipPath: `circle(150% at ${ink.x}px ${ink.y}px)` }}
            transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={() => navigate('/lobby')}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

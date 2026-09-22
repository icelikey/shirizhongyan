/**
 * 内容三页（残章/天梯/图鉴）共享的小组件。
 * - TiltCard   指针 3D 倾斜 + 金箔光扫（gold-sweep）容器
 * - Reveal     入场上浮淡入（framer-motion whileInView）
 * - SunDivider 三枚日轮小节分隔符
 * - Sundial    右侧竖排日晷滚动进度刻度（10 格 = 十日）
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

/* ---------------- TiltCard：3D 悬停倾斜 + GoldSweep ---------------- */

export interface TiltCardProps {
  children: ReactNode
  className?: string
  /** 最大倾斜角 */
  max?: number
  /** 关闭倾斜（仅保留金扫） */
  disabled?: boolean
  onClick?: () => void
}

export function TiltCard({ children, className, max = 8, disabled = false, onClick }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 })
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 })

  const onMove = (e: React.PointerEvent) => {
    if (disabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const onLeave = () => {
    px.set(0.5)
    py.set(0.5)
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
      className={cn('gold-sweep [transform-style:preserve-3d]', onClick && 'cursor-pointer', className)}
      style={disabled ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={disabled ? undefined : { y: -4 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- Reveal：滚动入场 ---------------- */

export interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}

export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/* ---------------- SunDivider：三枚日轮分隔符 ---------------- */

export function SunDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-2 select-none', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" className="sun-dot" style={{ opacity: i === 1 ? 0.95 : 0.45 }}>
          <circle cx="12" cy="12" r="4.5" fill="#E3C27C" />
          {Array.from({ length: 8 }).map((_, k) => {
            const a = (k * Math.PI) / 4
            return (
              <line
                key={k}
                x1={12 + 6.5 * Math.cos(a)}
                y1={12 + 6.5 * Math.sin(a)}
                x2={12 + 9.5 * Math.cos(a)}
                y2={12 + 9.5 * Math.sin(a)}
                stroke="#E3C27C"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            )
          })}
        </svg>
      ))}
    </div>
  )
}

/* ---------------- Sundial：竖排日晷滚动进度 ---------------- */

export function Sundial({ label = '日晷' }: { label?: string }) {
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
      <span className="vertical-rl text-[10px] tracking-[.4em] text-faint font-mashan">{label}</span>
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

/* ---------------- 朱砂印章（落定动画用 framer-motion） ---------------- */

export interface SealStampProps {
  text: string
  className?: string
  /** 落定动画 */
  slam?: boolean
  size?: number
}

export function SealStamp({ text, className, slam = false, size = 44 }: SealStampProps) {
  const inner = (
    <span
      className={cn('seal-stamp inline-flex items-center justify-center leading-none p-1.5', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        writingMode: text.length > 1 ? 'vertical-rl' : undefined,
      }}
    >
      {text}
    </span>
  )
  if (!slam) return inner
  return (
    <motion.span
      className="inline-block"
      initial={{ scale: 1.5, rotate: -14, opacity: 0 }}
      whileInView={{ scale: 1, rotate: -3, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
    >
      {inner}
    </motion.span>
  )
}

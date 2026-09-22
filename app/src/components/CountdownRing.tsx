/**
 * <CountdownRing> 十日倒计时环（design.md §10.3）。
 * SVG 双环：外环=十日总进度（10 等分刻度，已过日金色填充），内环=当日倒计时弧。
 * - variant="mini"：28px 圆环 + 当日序数（顶栏用）
 * - variant="hero"：320px，环上十枚小日轮沿轨道排布，当前日轮发光（首页用）
 *
 * 数据源：useProfile().session.createdAt + src/lib/countdown.ts（每秒 tick）。
 */
import { useEffect, useState } from 'react'
import { useProfile } from '@/store/profile'
import { getCountdown, COUNTDOWN_TICK_MS } from '@/lib/countdown'
import { cn } from '@/lib/utils'

export interface CountdownRingProps {
  variant?: 'mini' | 'hero'
  /** 覆盖尺寸（px），默认 mini=28 hero=320 */
  size?: number
  /** hero 规格中心内容（如 eclipse-suns.png） */
  children?: React.ReactNode
  className?: string
}

export default function CountdownRing({ variant = 'mini', size, children, className }: CountdownRingProps) {
  const createdAt = useProfile((s) => s.session?.createdAt)
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), COUNTDOWN_TICK_MS)
    return () => clearInterval(t)
  }, [])

  // 未登录时以一个固定的「世界时钟」展示（以今天 0 点为锚）
  const anchor = createdAt ?? new Date().setHours(0, 0, 0, 0)
  const cd = getCountdown(anchor)
  const dim = size ?? (variant === 'hero' ? 320 : 28)

  if (variant === 'mini') {
    const r = 45
    const c = 2 * Math.PI * r
    return (
      <div
        className={cn('relative inline-flex items-center justify-center', className)}
        style={{ width: dim, height: dim }}
        title={`第 ${cd.day} 日 · 十日总进度 ${(cd.totalProgress * 100).toFixed(0)}%`}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(227,194,124,.15)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            stroke={cd.crisis ? '#F0655A' : '#E3C27C'}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - cd.totalProgress)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </svg>
        <span
          className="relative font-cinzel font-bold leading-none"
          style={{ fontSize: dim * 0.42, color: cd.crisis ? '#F0655A' : '#E3C27C' }}
        >
          {cd.day}
        </span>
      </div>
    )
  }

  /* ---- hero 规格 ---- */
  const R_OUT = 46 // 外环半径（viewBox 100）
  const R_IN = 38
  const cIn = 2 * Math.PI * R_IN
  const gold = cd.crisis ? '#F0655A' : '#E3C27C'
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: dim, height: dim }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        {/* 外环：10 等分刻度，已过日金色填充 */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 10 + 0.035
          const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / 10 - 0.035
          const x0 = 50 + R_OUT * Math.cos(a0), y0 = 50 + R_OUT * Math.sin(a0)
          const x1 = 50 + R_OUT * Math.cos(a1), y1 = 50 + R_OUT * Math.sin(a1)
          const passed = i < cd.day
          const current = i === cd.day - 1
          return (
            <path
              key={i}
              d={`M ${x0} ${y0} A ${R_OUT} ${R_OUT} 0 0 1 ${x1} ${y1}`}
              fill="none"
              stroke={passed ? gold : 'rgba(227,194,124,.14)'}
              strokeWidth={current ? 2.6 : 1.6}
              strokeLinecap="round"
              style={current ? { filter: `drop-shadow(0 0 3px ${gold})` } : undefined}
              className="transition-all duration-700"
            />
          )
        })}
        {/* 十枚小日轮沿轨道排布，当前日轮发光 */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / 10
          const x = 50 + R_OUT * Math.cos(a), y = 50 + R_OUT * Math.sin(a)
          const passed = i < cd.day - 1
          const current = i === cd.day - 1
          return (
            <g key={i}>
              <circle
                cx={x} cy={y}
                r={current ? 3 : 1.8}
                fill={passed || current ? gold : 'rgba(227,194,124,.18)'}
                style={current ? { filter: `drop-shadow(0 0 4px ${gold})` } : undefined}
                className="transition-all duration-700"
              />
              {current && (
                <circle cx={x} cy={y} r={4.6} fill="none" stroke={gold} strokeWidth={0.5} opacity={0.6}>
                  <animate attributeName="r" values="3.6;5.4;3.6" dur="2.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.15;0.7" dur="2.4s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )
        })}
        {/* 内环：当日倒计时弧 */}
        <g className="-rotate-90 origin-center" style={{ transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="50" r={R_IN} fill="none" stroke="rgba(227,194,124,.10)" strokeWidth="1" />
          <circle
            cx="50" cy="50" r={R_IN} fill="none"
            stroke={gold} strokeWidth="1.6" strokeLinecap="round"
            strokeDasharray={cIn}
            strokeDashoffset={cIn * (1 - cd.dayProgress)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        </g>
      </svg>
      {/* 中心内容（eclipse 图 / 数字等） */}
      <div className="relative z-10 flex items-center justify-center" style={{ width: dim * 0.68, height: dim * 0.68 }}>
        {children}
      </div>
    </div>
  )
}

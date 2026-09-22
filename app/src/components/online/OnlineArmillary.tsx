/**
 * 联机版浑天仪 · 均值揭示仪（视觉延续 components/game/ArmillarySphere，
 * 数据源换为服务端 GuessReveal：values/average/target/winnerSeat）。
 * 常态三环缓慢自转；揭示：均值 count-up、金针指向目标、数字卡飞入、胜者金光。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { GuessReveal } from '@contracts/room'
import { cn } from '@/lib/utils'

const CLUB = '#4ECB9C'
const GOLD = '#E3C27C'

/** 数字 count-up（1.1s，ease-out） */
function useCountUp(target: number, active: boolean): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!active) {
      setV(0)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active])
  return v
}

export interface OnlineArmillaryProps {
  /** 是否处于揭示演出中（playing·reveal 且有 lastReveal） */
  revealing: boolean
  round: number
  reveal: GuessReveal | null
  /** 座位号 → 展示名 */
  seatNames: Record<number, string>
  size?: number
}

export default function OnlineArmillary({ revealing, round, reveal, seatNames, size = 250 }: OnlineArmillaryProps) {
  const active = revealing && reveal != null
  const average = useCountUp(active ? reveal.average : 0, active)
  const target = reveal?.target ?? 0

  /** 值 → 指针角（0 在正上方，顺时针） */
  const angleOf = (v: number) => (v / 100) * 360

  const entries = reveal
    ? Object.entries(reveal.values)
        .map(([seat, value]) => ({ seat: Number(seat), value }))
        .sort((a, b) => a.seat - b.seat)
    : []

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 外环：0–100 刻度（40s 自转） */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin-30" style={{ animationDuration: '40s' }}>
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(78,203,156,.18)" strokeWidth="0.5" />
        {Array.from({ length: 21 }).map((_, i) => {
          const a = (i * 5 * Math.PI * 2) / 100 - Math.PI / 2
          const major = i % 2 === 0
          const r0 = major ? 44.5 : 46
          return (
            <line
              key={i}
              x1={50 + r0 * Math.cos(a)} y1={50 + r0 * Math.sin(a)}
              x2={50 + 48 * Math.cos(a)} y2={50 + 48 * Math.sin(a)}
              stroke={major ? 'rgba(78,203,156,.5)' : 'rgba(78,203,156,.22)'}
              strokeWidth={major ? 0.5 : 0.3}
            />
          )
        })}
      </svg>
      {/* 中环：26s 反向自转 */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin-30" style={{ animationDuration: '26s', animationDirection: 'reverse' }}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(227,194,124,.14)" strokeWidth="0.4" strokeDasharray="1 2" />
      </svg>
      {/* 均值指针 + 目标金针 */}
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <g style={{ transform: `rotate(${active ? angleOf(reveal.average) : 0}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(.22,1,.36,1)' }}>
          <line x1="50" y1="50" x2="50" y2="14" stroke={CLUB} strokeWidth="0.8" style={{ filter: `drop-shadow(0 0 3px ${CLUB})` }} />
          <circle cx="50" cy="14" r="1.6" fill={CLUB} />
        </g>
        <g style={{ transform: `rotate(${active ? angleOf(target) : 240}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.4s cubic-bezier(.22,1,.36,1) .2s' }}>
          <line x1="50" y1="50" x2="50" y2="22" stroke={GOLD} strokeWidth="1" style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
          <path d="M50 19 52 23 48 23Z" fill={GOLD} />
        </g>
        <circle cx="50" cy="50" r="26" fill="rgba(7,6,11,.55)" stroke="rgba(227,194,124,.2)" strokeWidth="0.4" />
      </svg>

      {/* 中心读数 */}
      <div className="relative z-10 flex flex-col items-center">
        {active ? (
          <>
            <span className="font-cinzel font-bold text-[40px] leading-none" style={{ color: CLUB, textShadow: `0 0 18px ${CLUB}66` }}>
              {average.toFixed(1)}
            </span>
            <span className="text-[10px] tracking-[.25em] text-faint mt-1">均值</span>
            <span className="font-mono text-[13px] mt-1" style={{ color: GOLD }}>
              目标 {target.toFixed(1)}
            </span>
          </>
        ) : (
          <>
            <span className="font-mashan text-[34px] leading-none" style={{ color: `${CLUB}CC` }}>浑天仪</span>
            <span className="text-[10px] tracking-[.3em] text-faint mt-2">{round > 0 ? `第 ${round} 轮 · 演算中` : '算庭待命'}</span>
          </>
        )}
      </div>

      {/* 揭示：六张数字卡飞入 */}
      {active && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {entries.map((e, i) => {
            const isWin = e.seat === reveal.winnerSeat
            return (
              <motion.div
                key={e.seat}
                initial={{ y: 26, opacity: 0, rotateY: 90 }}
                animate={{ y: 0, opacity: 1, rotateY: 0, scale: isWin ? 1.22 : 1 }}
                transition={{ delay: i * 0.07 + 0.15, duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
                className={cn('flex flex-col items-center rounded-lg border px-2 py-1 bg-ink/90', isWin ? 'border-gold-300' : 'border-[rgba(78,203,156,.3)]')}
                style={isWin ? { boxShadow: '0 0 18px rgba(227,194,124,.5)' } : undefined}
                title={seatNames[e.seat] ?? ''}
              >
                <span className={cn('font-mono text-[13px] font-semibold', isWin ? 'text-gold-300' : 'text-bone')}>{e.value.toFixed(1)}</span>
                <span className="text-[9px] text-faint max-w-[44px] truncate">{seatNames[e.seat] ?? `${e.seat + 1} 号`}</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

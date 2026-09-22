/**
 * 浑天仪 · 均值揭示仪（猜平均数中央仪器，design game-guess.md）。
 * 常态：三环缓慢自转；揭示：均值 count-up、外环指针扫向均值、内环金针指向
 * 「均值×2/3」目标值、六张数字卡飞入、胜者卡金光放大。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { GamePhase, Seat } from '@/engine/types'
import type { GuessRoundResult } from '@/engine/guessEngine'
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

export interface ArmillarySphereProps {
  phase: GamePhase
  round: number
  latest: GuessRoundResult | null
  seats: Seat[]
  size?: number
}

export default function ArmillarySphere({ phase, round, latest, seats, size = 260 }: ArmillarySphereProps) {
  const revealing = phase === 'reveal' && latest != null
  const average = useCountUp(revealing ? latest.average : 0, revealing)
  const target = latest?.target ?? 0

  /** 值 → 指针角（0 在正上方，顺时针） */
  const angleOf = (v: number) => (v / 100) * 360

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
      {/* 中环：均值指针（26s 反向自转 + 揭示时指向均值） */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 animate-spin-30" style={{ animationDuration: '26s', animationDirection: 'reverse' }}>
        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(227,194,124,.14)" strokeWidth="0.4" strokeDasharray="1 2" />
      </svg>
      {/* 均值指针 */}
      <svg viewBox="0 0 100 100" className="absolute inset-0">
        <g style={{ transform: `rotate(${revealing ? angleOf(latest.average) : 0}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.2s cubic-bezier(.22,1,.36,1)' }}>
          <line x1="50" y1="50" x2="50" y2="14" stroke={CLUB} strokeWidth="0.8" style={{ filter: `drop-shadow(0 0 3px ${CLUB})` }} />
          <circle cx="50" cy="14" r="1.6" fill={CLUB} />
        </g>
        {/* 目标金针 */}
        <g style={{ transform: `rotate(${revealing ? angleOf(target) : 240}deg)`, transformOrigin: '50px 50px', transition: 'transform 1.4s cubic-bezier(.22,1,.36,1) .2s' }}>
          <line x1="50" y1="50" x2="50" y2="22" stroke={GOLD} strokeWidth="1" style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
          <path d="M50 19 52 23 48 23Z" fill={GOLD} />
        </g>
        {/* 内环 */}
        <circle cx="50" cy="50" r="26" fill="rgba(7,6,11,.55)" stroke="rgba(227,194,124,.2)" strokeWidth="0.4" />
      </svg>

      {/* 中心读数 */}
      <div className="relative z-10 flex flex-col items-center">
        {revealing ? (
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

      {/* 揭示：六张数字卡飞入（排在仪器上方） */}
      {revealing && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
          {latest.entries.map((e, i) => {
            const isWin = e.seat === latest.winnerSeat
            const name = seats.find((s) => s.seat === e.seat)?.name ?? ''
            return (
              <motion.div
                key={e.seat}
                initial={{ y: 26, opacity: 0, rotateY: 90 }}
                animate={{ y: 0, opacity: 1, rotateY: 0, scale: isWin ? 1.22 : 1 }}
                transition={{ delay: i * 0.07 + 0.15, duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
                className={cn('flex flex-col items-center rounded-lg border px-2 py-1 bg-ink/90', isWin ? 'border-gold-300' : 'border-[rgba(78,203,156,.3)]')}
                style={isWin ? { boxShadow: '0 0 18px rgba(227,194,124,.5)' } : undefined}
                title={name}
              >
                <span className={cn('font-mono text-[13px] font-semibold', isWin ? 'text-gold-300' : 'text-bone')}>{e.value.toFixed(1)}</span>
                <span className="text-[9px] text-faint max-w-[44px] truncate">{name}</span>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 椭圆六座牌桌布局（两对局页共用）。
 * 0 号座（真人）固定 6 点位（底部中央），1–5 号座沿椭圆逆时针均布。
 * 中心区域渲染 children（浑天仪 / 烛火舞台等）。
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SeatEllipseProps {
  /** 6 个座位节点（index = 逻辑座号 0–5） */
  seats: ReactNode[]
  /** 桌面中央内容 */
  children?: ReactNode
  /** 桌面纹理变体：club=青玉 felt / spade=深木夜 */
  suit?: 'club' | 'spade'
  className?: string
}

/** 六座角度（度）：0 号 90°（底部），逆时针每 60° 一座 */
const SEAT_ANGLE = [90, 30, -30, -90, -150, 150]
/** 椭圆半径（%） */
const RX = 46
const RY = 44

export function seatPosition(i: number): { left: string; top: string } {
  const rad = (SEAT_ANGLE[i] * Math.PI) / 180
  return {
    left: `${50 + RX * Math.cos(rad)}%`,
    top: `${50 - RY * Math.sin(rad)}%`,
  }
}

export default function SeatEllipse({ seats, children, suit = 'club', className }: SeatEllipseProps) {
  const feltGlow =
    suit === 'club'
      ? 'radial-gradient(60% 60% at 50% 50%, rgba(78,203,156,.10), transparent 75%)'
      : 'radial-gradient(60% 60% at 50% 50%, rgba(139,147,248,.10), transparent 75%)'
  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* 椭圆桌面 */}
      <div
        className="absolute rounded-[50%] border border-[rgba(227,194,124,.14)]"
        style={{
          left: '6%',
          right: '6%',
          top: '8%',
          bottom: '8%',
          background: `${feltGlow}, url("/texture-felt.png")`,
          backgroundSize: 'auto, 512px',
          boxShadow: 'inset 0 0 80px rgba(7,6,11,.85), 0 24px 80px rgba(0,0,0,.55)',
        }}
      />
      {/* 中央内容 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">{children}</div>
      {/* 六座 */}
      {seats.map((node, i) => (
        <div key={i} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={seatPosition(i)}>
          {node}
        </div>
      ))}
    </div>
  )
}

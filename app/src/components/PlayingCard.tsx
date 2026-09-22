/**
 * <PlayingCard> 扑克牌（design.md §10.9）。
 * 2:3（w 84-168px 自适应）。正面：左上/右下花色+点数（Cinzel），中央大花色图标或自定义图；
 * 背面 card-back.png。悬停 3D 倾斜（max 8°）+ GoldSweep。
 */
import { useRef, useState } from 'react'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import { cn } from '@/lib/utils'

export interface PlayingCardProps {
  suit?: Suit
  /** 点数：A/2-10/J/Q/K 或自定义文本 */
  rank?: string
  /** 背面朝上 */
  faceDown?: boolean
  /** 正面中央自定义图（如角色立绘），缺省为大花色图标 */
  image?: string
  /** 宽度 px（高度自动 1.5x），默认 84 */
  width?: number
  /** 悬停 3D 倾斜 */
  tilt?: boolean
  className?: string
  onClick?: () => void
}

export default function PlayingCard({
  suit = 'spade',
  rank = 'A',
  faceDown = false,
  image,
  width = 84,
  tilt = true,
  className,
  onClick,
}: PlayingCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState('')
  const meta = SUIT_META[suit]
  const height = width * 1.5

  const onMove = (e: React.MouseEvent) => {
    if (!tilt || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTf(`perspective(600px) rotateY(${px * 16}deg) rotateX(${-py * 16}deg)`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setTf('')}
      onClick={onClick}
      className={cn('gold-sweep relative rounded-[10px] select-none transition-transform duration-200 ease-out', onClick && 'cursor-pointer', className)}
      style={{ width, height, transform: tf, transformStyle: 'preserve-3d' }}
    >
      {faceDown ? (
        <img src="/card-back.png" alt="牌背" width={width} height={height} draggable={false} className="w-full h-full object-cover rounded-[10px] card-frame" />
      ) : (
        <div className="card-frame w-full h-full rounded-[10px] bg-panel relative overflow-hidden">
          {image ? (
            <img src={image} alt={rank} draggable={false} className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ color: meta.color }}>
              <SuitIcon suit={suit} size={width * 0.42} glow />
            </div>
          )}
          {/* 左上 花色+点数 */}
          <div className="absolute top-1 left-1.5 flex flex-col items-center leading-none" style={{ color: meta.color }}>
            <span className="font-cinzel font-bold" style={{ fontSize: width * 0.16 }}>{rank}</span>
            <SuitIcon suit={suit} size={width * 0.13} />
          </div>
          {/* 右下 花色+点数（旋转 180°） */}
          <div className="absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180" style={{ color: meta.color }}>
            <span className="font-cinzel font-bold" style={{ fontSize: width * 0.16 }}>{rank}</span>
            <SuitIcon suit={suit} size={width * 0.13} />
          </div>
        </div>
      )}
    </div>
  )
}

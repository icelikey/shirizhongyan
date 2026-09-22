/**
 * <TiltCard> 卡牌 3D 悬停倾斜容器（design.md §1.2「牌即界面」+ §7.2.5 GoldSweep）。
 * 鼠标跟随 rotateX/rotateY（max 8° 可配），悬停时附带 GoldSweep 光扫与花色光晕。
 */
import { memo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TiltCardProps {
  children: ReactNode
  /** 最大倾斜角（deg），默认 8 */
  max?: number
  /** 悬停时的花色/金色光晕 box-shadow 色 */
  glow?: string
  className?: string
  style?: CSSProperties
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  /** 禁用倾斜（仅保留光扫容器样式） */
  disabled?: boolean
}

function TiltCardInner({ children, max = 8, glow, className, style, onClick, disabled = false }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tf, setTf] = useState('')
  const [hover, setHover] = useState(false)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTf(`perspective(900px) rotateY(${(px * max).toFixed(2)}deg) rotateX(${(-py * max).toFixed(2)}deg)`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setTf('')
        setHover(false)
      }}
      onClick={onClick}
      className={cn(
        'gold-sweep relative select-none transition-transform duration-200 ease-out',
        onClick && 'cursor-pointer',
        className,
      )}
      style={{
        transform: tf,
        transformStyle: 'preserve-3d',
        boxShadow: hover && glow ? `0 16px 48px rgba(0,0,0,.6), 0 0 32px ${glow}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const TiltCard = memo(TiltCardInner)
export default TiltCard

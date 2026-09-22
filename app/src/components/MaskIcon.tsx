/**
 * <MaskIcon> 用 CSS mask 渲染 public/ 下的单线 SVG，使其可着任意颜色。
 * 适用于 zodiac-*.svg / tier-*.svg / suit-*.svg / icon-*.svg / logo-mark.svg 等线性资产。
 */
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export interface MaskIconProps {
  /** 图标路径，如 /zodiac-01.svg */
  src: string
  /** 着色（默认 gold-300） */
  color?: string
  size?: number | string
  className?: string
  style?: CSSProperties
  alt?: string
}

export default function MaskIcon({ src, color = '#E3C27C', size = 24, className, style, alt }: MaskIconProps) {
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn('inline-block shrink-0', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        ...style,
      }}
    />
  )
}

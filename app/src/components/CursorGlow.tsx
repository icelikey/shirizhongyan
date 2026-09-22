/**
 * <CursorGlow> 自定义光标跟随点（design.md §7.5）。
 * 默认：原生光标 + 8px 金色柔光跟随点（mix-blend screen，滞后 lerp .18）。
 * 悬停可交互物（a/button/[data-cursor]）：放大至 28px 圆环。
 * prefers-reduced-motion 或触屏：禁用。
 */
import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const touch = window.matchMedia('(pointer: coarse)').matches
    const dot = dotRef.current
    if (reduced || touch || !dot) return

    let x = -100, y = -100, tx = -100, ty = -100, size = 8, tSize = 8
    let raf = 0

    const onMove = (e: MouseEvent) => {
      tx = e.clientX
      ty = e.clientY
      const t = e.target as HTMLElement | null
      const interactive = t?.closest('a,button,[role="button"],input,textarea,[data-cursor]')
      tSize = interactive ? 28 : 8
    }
    const loop = () => {
      x += (tx - x) * 0.18
      y += (ty - y) * 0.18
      size += (tSize - size) * 0.18
      const ring = size > 14
      dot.style.transform = `translate(${x - size / 2}px, ${y - size / 2}px)`
      dot.style.width = `${size}px`
      dot.style.height = `${size}px`
      dot.style.border = ring ? '1px solid rgba(227,194,124,.8)' : 'none'
      dot.style.background = ring ? 'transparent' : 'rgba(227,194,124,.55)'
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={dotRef}
      aria-hidden
      className="fixed top-0 left-0 z-[80] rounded-full pointer-events-none mix-blend-screen hidden md:block"
      style={{ width: 8, height: 8, boxShadow: '0 0 12px rgba(227,194,124,.5)' }}
    />
  )
}

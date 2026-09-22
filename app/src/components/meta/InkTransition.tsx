/**
 * 墨染路由过渡（design.md §7.2.2）—— 元系统三页共用。
 * useInkTransition() 返回 { inkNode, go }：
 *  - go(to, at?) 从 at（缺省屏幕中心）晕开一团墨，覆盖全屏后 navigate(to)。
 *  - inkNode 渲染在页面 JSX 末尾（fixed overlay，z-100）。
 * 新页面的入场动画（上浮 + 淡入）即「自墨色中浮现」。
 */
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

interface InkState {
  x: number
  y: number
  to: string
}

export function useInkTransition() {
  const navigate = useNavigate()
  const [ink, setInk] = useState<InkState | null>(null)

  const go = useCallback((to: string, at?: { x: number; y: number }) => {
    setInk({
      x: at?.x ?? window.innerWidth / 2,
      y: at?.y ?? window.innerHeight / 2,
      to,
    })
  }, [])

  const inkNode = (
    <AnimatePresence>
      {ink && (
        <motion.div
          className="fixed inset-0 z-[100] bg-ink pointer-events-none"
          initial={{ clipPath: `circle(0% at ${ink.x}px ${ink.y}px)` }}
          animate={{ clipPath: `circle(150% at ${ink.x}px ${ink.y}px)` }}
          transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => navigate(ink.to)}
        />
      )}
    </AnimatePresence>
  )

  return { inkNode, go }
}

/** 从鼠标事件取过渡原点 */
export const inkPoint = (e: React.MouseEvent): { x: number; y: number } => ({ x: e.clientX, y: e.clientY })

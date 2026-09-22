/**
 * <GameModal> 对局弹层（design.md §10.14）。
 * 背景 rgba(7,6,11,.7) + blur(8px)；卡片 18px 圆角金线描边；
 * 进出 scale .96→1 + fade 240ms。Esc / 点背板关闭（onClose 可选）。
 */
import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GameModalProps {
  open: boolean
  title?: string
  onClose?: () => void
  children?: ReactNode
  className?: string
}

export default function GameModal({ open, title, onClose, children, className }: GameModalProps) {
  useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-6"
          style={{ background: 'rgba(7,6,11,.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative w-full max-w-[520px] rounded-[18px] border border-[rgba(227,194,124,.28)] bg-elevated p-6',
              'shadow-[0_8px_32px_rgba(0,0,0,.5),0_1px_0_rgba(248,233,192,.04)_inset]',
              className,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || onClose) && (
              <div className="mb-4 flex items-center justify-between gap-3">
                {title ? (
                  <h3 className="gold-text font-serifsc text-[18px] font-semibold tracking-[.08em]">{title}</h3>
                ) : (
                  <span />
                )}
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(227,194,124,.2)] text-dim transition-colors hover:border-[rgba(246,227,180,.55)] hover:text-gold-300"
                    aria-label="关闭"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * <MetaModal> 中央弹层（design.md §10.14）：背景 rgba(7,6,11,.7)+blur(8px)，
 * 卡片 18px 圆角金线描边；进出 scale .96→1 + fade 240ms；Esc / 点背景关闭。
 */
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MetaModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** 竖排侧款（如「设局」） */
  sideMark?: string
  width?: number
  children: ReactNode
  className?: string
}

export default function MetaModal({ open, onClose, title, sideMark, width = 560, children, className }: MetaModalProps) {
  useEffect(() => {
    if (!open) return
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
          className="fixed inset-0 z-[90] flex items-center justify-center bg-abyss/70 backdrop-blur-[8px] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative max-h-[86dvh] w-full overflow-y-auto rounded-[18px] border border-[rgba(227,194,124,.28)] bg-panel p-6 shadow-panel',
              className,
            )}
            style={{ maxWidth: width }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || sideMark) && (
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    {typeof title === 'string' ? (
                      <h3 className="gold-text font-serifsc font-semibold text-[22px] tracking-[.08em]">{title}</h3>
                    ) : (
                      title
                    )}
                  </div>
                  {sideMark && (
                    <span className="vertical-rl font-mashan text-[14px] text-gold-500/70">{sideMark}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-faint transition-colors hover:text-gold-300"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

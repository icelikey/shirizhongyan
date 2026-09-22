/**
 * <SpeechBubble> 发言气泡（design.md §10.11）。
 * 从座位方向长出的墨色气泡（尾巴指向头像），--bg-elevated 底 + 1px 花色描边；
 * 文字逐字打出（24 字/秒）；自己发言金边；狼人队友夜晚发言朱红虚线边。
 */
import { useEffect, useState } from 'react'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

export interface SpeechBubbleProps {
  text: string
  /** 尾巴方向（指向头像一侧） */
  tail?: 'left' | 'right' | 'top' | 'bottom' | 'none'
  /** self=自己(金边) / wolf=狼队夜话(朱红虚线) / default=他人(花色描边) */
  variant?: 'default' | 'self' | 'wolf'
  /** 花色描边（variant=default 时生效） */
  suit?: Suit
  /** 逐字打出（24 字/秒） */
  typing?: boolean
  className?: string
}

const CHARS_PER_SEC = 24

const TAIL_POS: Record<string, React.CSSProperties> = {
  left: { left: -5, top: 16 },
  right: { right: -5, top: 16 },
  top: { top: -5, left: 24 },
  bottom: { bottom: -5, left: 24 },
}

export default function SpeechBubble({ text, tail = 'left', variant = 'default', suit = 'spade', typing = true, className }: SpeechBubbleProps) {
  /* 打字进度；text/typing 变化时通过渲染期调整重置（React 推荐的 adjust-state-on-render 模式） */
  const [state, setState] = useState({ text, typing, shown: typing ? 0 : text.length })
  if (state.text !== text || state.typing !== typing) {
    setState({ text, typing, shown: typing ? 0 : text.length })
  }
  const shown = state.shown

  useEffect(() => {
    if (!typing) return
    const t = setInterval(() => {
      setState((s) => (s.shown >= s.text.length ? s : { ...s, shown: s.shown + 1 }))
    }, 1000 / CHARS_PER_SEC)
    return () => clearInterval(t)
  }, [typing, text])

  const borderColor =
    variant === 'self' ? 'rgba(227,194,124,.6)' : variant === 'wolf' ? 'rgba(240,101,90,.7)' : `${SUIT_META[suit].color}66`

  return (
    <div
      className={cn('relative inline-block max-w-[320px] rounded-xl border bg-elevated px-3.5 py-2.5 text-[13px] leading-relaxed text-bone font-sanssc', className)}
      style={{ borderColor, borderStyle: variant === 'wolf' ? 'dashed' : 'solid' }}
    >
      {tail !== 'none' && (
        <span
          className="absolute w-2.5 h-2.5 rotate-45 bg-elevated"
          style={{
            ...TAIL_POS[tail],
            borderColor,
            borderStyle: variant === 'wolf' ? 'dashed' : 'solid',
            borderWidth: 0,
            borderLeftWidth: tail === 'left' || tail === 'top' ? 1 : 0,
            borderTopWidth: tail === 'top' || tail === 'right' ? 1 : 0,
            borderRightWidth: tail === 'right' || tail === 'bottom' ? 1 : 0,
            borderBottomWidth: tail === 'bottom' || tail === 'left' ? 1 : 0,
          }}
        />
      )}
      <span className="whitespace-pre-wrap break-words">
        {text.slice(0, shown)}
        {typing && shown < text.length && <span className="inline-block w-[2px] h-[1em] align-[-2px] bg-gold-300 animate-caret-blink ml-0.5" />}
      </span>
    </div>
  )
}

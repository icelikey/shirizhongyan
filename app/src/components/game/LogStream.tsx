/**
 * 记录流（右栏系统消息流水）：自动滚到底，新条目底部淡入。
 */
import { useEffect, useRef } from 'react'
import type { LogItem } from '@/engine/types'
import { cn } from '@/lib/utils'

export interface LogStreamProps {
  items: LogItem[]
  /** 结果类条目的强调色（花色） */
  accent?: string
  className?: string
}

const KIND_STYLE: Record<LogItem['kind'], string> = {
  system: 'text-faint',
  action: 'text-dim',
  result: 'text-bone',
}

export default function LogStream({ items, accent = '#E3C27C', className }: LogStreamProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items.length])
  return (
    <div ref={ref} className={cn('overflow-y-auto flex flex-col gap-1.5 pr-1', className)}>
      {items.map((it) => (
        <div
          key={it.id}
          className={cn('text-[12px] leading-relaxed animate-[logitem_.3s_ease-out]', KIND_STYLE[it.kind])}
          style={it.kind === 'result' ? { borderLeft: `2px solid ${accent}`, paddingLeft: 8 } : undefined}
        >
          {it.text}
        </div>
      ))}
      <style>{`@keyframes logitem{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

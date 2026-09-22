/**
 * 联机座位身份徽标：旅人（human）/ 影从（echo-bot）/ 外来 Agent（external-agent）。
 * 联机房不搞身份盲盒——席位出身直接标注（design.md §8 联机例外）。
 */
import { Bot, User } from 'lucide-react'
import type { SeatKind } from '@contracts/room'
import MaskIcon from '@/components/MaskIcon'
import { cn } from '@/lib/utils'

const KIND_META: Record<SeatKind, { label: string; color: string }> = {
  human: { label: '旅人', color: '#E3C27C' },
  'echo-bot': { label: '影从', color: '#4ECB9C' },
  'external-agent': { label: '外来 Agent', color: '#9B7FE8' },
}

export default function SeatKindBadge({ kind, className }: { kind: SeatKind; className?: string }) {
  const meta = KIND_META[kind]
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] tracking-widest', className)}
      style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }}
    >
      {kind === 'human' && <User size={10} />}
      {kind === 'echo-bot' && <Bot size={10} />}
      {kind === 'external-agent' && <MaskIcon src="/icon-mask.svg" size={10} color={meta.color} alt="Agent" />}
      {meta.label}
    </span>
  )
}

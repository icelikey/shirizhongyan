/**
 * 路由占位页 —— 应用页 stub，后续页面代理替换。
 * 外层已包 AppShell（TopHUD + pt-16）+ LoginGuard。
 */
import SuitIcon from '@/components/SuitIcon'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'

export interface StubProps {
  title: string
  subtitle?: string
  suit?: Suit
}

export default function Stub({ title, subtitle, suit }: StubProps) {
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 flex flex-col items-center gap-8 min-h-[60dvh]">
      <div className="flex flex-col items-center gap-3 text-center">
        {suit && (
          <span style={{ color: SUIT_META[suit].color }}>
            <SuitIcon suit={suit} size={32} glow />
          </span>
        )}
        <h1 className="gold-text font-serifsc font-black text-[40px] tracking-[.1em]">{title}</h1>
        {subtitle && <p className="text-dim text-[14px] tracking-[.25em]">{subtitle}</p>}
      </div>
      <div className="panel-bg rounded-[18px] p-10 flex flex-col items-center gap-5 max-w-[560px] w-full">
        <img src="/empty-room.png" alt="虚位以待" className="w-[280px] rounded-lg opacity-80" draggable={false} />
        <p className="vertical-rl font-mashan text-faint text-[16px] h-[120px]">牌桌已备，虚位以待</p>
        <p className="text-faint text-[12px] tracking-wider">此页由后续构建代理实现</p>
      </div>
    </div>
  )
}

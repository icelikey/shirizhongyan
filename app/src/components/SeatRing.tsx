/**
 * <SeatRing> 座位单元（design.md §10.10）。
 * 椭圆牌桌上的座位：头像 + 名牌（名字+身份标签）+ 状态灯
 * （thinking=金色沙漏动画 / submitted=✓ / dead=灰化+朱砂斜线 / idle）。
 * 当前行动座位外圈 2px 金色描边顺时针旋转光。
 */
import type { Echo } from '@/data/echoes'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import EchoAvatar from '@/components/EchoAvatar'
import { Hourglass, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SeatStatus = 'idle' | 'thinking' | 'submitted' | 'dead'

export interface SeatRingProps {
  /** 座位玩家名（真人为昵称，AI 为影从名） */
  name: string
  /** 影从数据（AI 座位）；真人座位传 avatarUrl */
  echo?: Echo
  /** 真人头像（如 /avatar-traveler.png） */
  avatarUrl?: string
  /** 身份/人设标签（如「深算」「房主」） */
  tag?: string
  status?: SeatStatus
  /** 当前行动座位（外圈旋转金光） */
  active?: boolean
  /** 花色光晕（狼人杀=spade / 猜平均数=club） */
  suit?: Suit
  /** 是否本人座位 */
  isSelf?: boolean
  onClick?: () => void
  className?: string
}

export default function SeatRing({
  name,
  echo,
  avatarUrl,
  tag,
  status = 'idle',
  active = false,
  suit,
  isSelf = false,
  onClick,
  className,
}: SeatRingProps) {
  const suitColor = suit ? SUIT_META[suit].color : '#E3C27C'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('relative flex flex-col items-center gap-1.5 outline-none group', className)}
    >
      <div className="relative">
        {/* 当前行动座位：旋转金光 */}
        {active && (
          <span
            className="absolute -inset-1.5 rounded-full animate-spin-30"
            style={{
              background: `conic-gradient(from 0deg, transparent 0%, ${suitColor} 12%, transparent 26%)`,
              animationDuration: '2.4s',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            }}
          />
        )}
        <div className={cn('relative transition-all duration-300', status === 'dead' && 'grayscale opacity-50')}>
          {echo ? (
            <EchoAvatar echo={echo} size={72} />
          ) : (
            <span className="block w-[72px] h-[72px] rounded-full overflow-hidden border border-gold-300/50 bg-panel">
              <img src={avatarUrl ?? '/avatar-traveler.png'} alt={name} width={72} height={72} className="w-full h-full object-cover" draggable={false} />
            </span>
          )}
          {/* 死亡朱砂斜线 */}
          {status === 'dead' && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="block w-[120%] h-[2px] bg-cinnabar-hi rotate-[-30deg] shadow-[0_0_8px_#F0655A]" />
            </span>
          )}
        </div>
        {/* 状态灯 */}
        {status === 'thinking' && (
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ink border border-gold-300/50 flex items-center justify-center">
            <Hourglass size={13} className="text-gold-300 animate-breathe" />
          </span>
        )}
        {status === 'submitted' && (
          <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ink border border-ok/60 flex items-center justify-center">
            <Check size={13} className="text-ok" />
          </span>
        )}
      </div>
      {/* 名牌 */}
      <div className="flex flex-col items-center leading-tight">
        <span className={cn('text-[13px] font-sanssc font-medium', isSelf ? 'text-gold-300' : 'text-bone')}>{name}</span>
        {tag && (
          <span
            className="text-[10px] tracking-widest px-1.5 rounded-full border mt-0.5"
            style={{ color: suitColor, borderColor: `${suitColor}55`, background: `${suitColor}14` }}
          >
            {tag}
          </span>
        )}
      </div>
    </button>
  )
}

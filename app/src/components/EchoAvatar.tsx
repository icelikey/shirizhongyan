/**
 * <EchoAvatar> 智能体头像（design.md §10.8）。
 * 圆形裁切立绘 + 1px 金环；右下角生肖小印；在线状态点（绿=在线/金=对局中/灰=离线）。
 * 四规格 32/48/72/120。悬停 120 规格时立绘轻微放大 1.05。
 */
import type { Echo } from '@/data/echoes'
import { getEcho } from '@/data/echoes'
import { ZODIAC } from '@/data/zodiac'
import MaskIcon from '@/components/MaskIcon'
import { cn } from '@/lib/utils'

export type EchoStatus = 'online' | 'in-game' | 'offline'

const STATUS_COLOR: Record<EchoStatus, string> = {
  online: '#4ECB9C',
  'in-game': '#E3C27C',
  offline: '#6E6880',
}

export interface EchoAvatarProps {
  /** Echo 对象或 id */
  echo: Echo | string
  size?: 32 | 48 | 72 | 120 | number
  status?: EchoStatus
  /** 右下角生肖小印 */
  showZodiac?: boolean
  className?: string
}

export default function EchoAvatar({ echo, size = 48, status, showZodiac = false, className }: EchoAvatarProps) {
  const data = typeof echo === 'string' ? getEcho(echo) : echo
  if (!data) return null
  const zodiac = ZODIAC[data.zodiacIndex]
  return (
    <span className={cn('relative inline-block shrink-0 group', className)} style={{ width: size, height: size }} title={data.name}>
      <span
        className="block w-full h-full rounded-full overflow-hidden border border-gold-300/50 bg-panel"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(7,6,11,.6)' }}
      >
        <img
          src={data.portrait}
          alt={data.name}
          width={size}
          height={size}
          draggable={false}
          className={cn(
            'w-full h-full object-cover object-top transition-transform duration-300 ease-ink',
            size >= 120 && 'group-hover:scale-105',
          )}
        />
      </span>
      {showZodiac && zodiac && size >= 48 && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-ink border border-gold-300/40 flex items-center justify-center"
          style={{ width: size * 0.34, height: size * 0.34 }}
        >
          <MaskIcon src={zodiac.seal} alt={zodiac.name} size={size * 0.26} color="#E3C27C" />
        </span>
      )}
      {status && (
        <span
          className={cn('absolute rounded-full border border-abyss', status !== 'offline' && 'animate-pulse-dot')}
          style={{
            width: Math.max(8, size * 0.22),
            height: Math.max(8, size * 0.22),
            backgroundColor: STATUS_COLOR[status],
            right: showZodiac && size >= 48 ? size * 0.3 : 0,
            top: 0,
            boxShadow: `0 0 6px ${STATUS_COLOR[status]}`,
          }}
        />
      )}
    </span>
  )
}

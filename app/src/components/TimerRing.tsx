/**
 * <TimerRing> 行动计时环（design.md §10.12）。
 * 56px 圆环倒计时；剩余 <10s 转朱砂色 + 呼吸加速；归零抖动。
 * 受控组件：由父级传入 total 与 left（秒）。
 */
import { cn } from '@/lib/utils'

export interface TimerRingProps {
  /** 总秒数 */
  total: number
  /** 剩余秒数 */
  left: number
  size?: number
  className?: string
}

export default function TimerRing({ total, left, size = 56, className }: TimerRingProps) {
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0
  const urgent = left > 0 && left < 10
  const zero = left <= 0
  const color = zero || urgent ? '#F0655A' : '#E3C27C'
  const r = 45
  const c = 2 * Math.PI * r
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', urgent && 'animate-pulse-dot', zero && 'animate-[shake_.3s_ease-in-out_2]', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(227,194,124,.12)" strokeWidth="7" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <span className="relative font-mono font-semibold" style={{ color, fontSize: size * 0.32 }}>
        {Math.max(0, Math.ceil(left))}
      </span>
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}`}</style>
    </div>
  )
}

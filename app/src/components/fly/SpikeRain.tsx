/**
 * ============================================================================
 * 脉冲雨图（src/components/fly/SpikeRain.tsx）
 * ----------------------------------------------------------------------------
 * 把响应表里那段 `rain: [[t_ms, poolIndex], ...]` 画成雨：横轴是时间，
 * 每一道泳道是一个读出池，一个点就是一次脉冲（已按池聚合采样）。
 *
 * 这不是装饰。它是「这颗大脑真的在跑」最直接的证据——同一张牌每次跑
 * 出来的雨型是一样的（分布已烤进响应表），而不同牌之间一眼可辨：
 * 静默运动侧时 mn9 泳道会骤然变密，这正对应响应表里 lick 概率的跃升。
 *
 * 降级纪律（DESIGN.md）：prefers-reduced-motion 下不播落下动画，
 * 直接铺点。演出可以没有，信息不能没有。
 * ============================================================================
 */
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { FLY_BEHAVIOR_COLOR } from './flyMeta'

export interface SpikeRainProps {
  /** `[[t_ms, poolIndex], ...]`；poolIndex 为 -1 表示不属于任何读出池 */
  rain: number[][]
  /** 泳道名（与 poolIndex 对应） */
  poolOrder: string[]
  /** 记录时长（ms），用于把 t 归一化到横向位置 */
  durationMs: number
  /** 换牌时改变它可重播动画 */
  replayKey?: string | number
  /** 高度（px） */
  height?: number
  className?: string
}

/** 泳道 → 颜色：mn9 用吐舌色（它就是伸喙运动神经元），其余走池的语义色 */
const LANE_COLOR: Record<string, string> = {
  mn9: FLY_BEHAVIOR_COLOR.lick,
  motor: FLY_BEHAVIOR_COLOR.charge,
  relay: FLY_BEHAVIOR_COLOR.groom,
  center: FLY_BEHAVIOR_COLOR.drink,
  total: '#E3C27C',
}

/** 演出上限：一次最多画这么多点。删点只影响观感，不影响任何判定。 */
const MAX_DOTS = 160

export default function SpikeRain({
  rain,
  poolOrder,
  durationMs,
  replayKey,
  height = 132,
  className,
}: SpikeRainProps) {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const lanes = poolOrder.length > 0 ? poolOrder : ['total']
  const duration = Math.max(1, durationMs)

  const dots = useMemo(() => {
    const stride = Math.max(1, Math.ceil(rain.length / MAX_DOTS))
    const out: { key: string; x: number; lane: number; delay: number }[] = []
    let i = 0
    for (const point of rain) {
      const t = Number(point[0] ?? 0)
      const lane = Number(point[1] ?? -1)
      if (lane >= 0 && lane < lanes.length && i % stride === 0) {
        out.push({
          key: `${t}-${lane}-${i}`,
          x: Math.min(100, Math.max(0, (t / duration) * 100)),
          lane,
          delay: (t / duration) * 0.9,
        })
      }
      i += 1
    }
    return out
  }, [rain, lanes.length, duration])

  if (rain.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-[rgba(227,194,124,.12)] bg-[rgba(7,6,11,.6)]',
          className,
        )}
        style={{ height }}
      >
        <span className="text-[12px] text-faint">此牌无脉冲采样（网络未起振）</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-[rgba(227,194,124,.12)] bg-[rgba(7,6,11,.72)]',
        className,
      )}
      style={{ height }}
    >
      {/* 泳道分隔线 + 泳道名 */}
      {lanes.map((name, i) => (
        <div
          key={name}
          className="absolute left-0 right-0 border-t border-[rgba(227,194,124,.07)]"
          style={{ top: `${(i / lanes.length) * 100}%`, height: `${100 / lanes.length}%` }}
        >
          <span
            className="absolute left-1.5 top-1 font-mono text-[10px] tracking-wider"
            style={{ color: `${LANE_COLOR[name] ?? '#E3C27C'}BB` }}
          >
            {name}
          </span>
        </div>
      ))}

      {/* 脉冲点 */}
      {dots.map((d) => (
        <span
          key={`${replayKey ?? ''}-${d.key}`}
          className="absolute h-[3px] w-[3px] rounded-full"
          style={{
            left: `calc(${d.x}% - 1.5px)`,
            top: `calc(${(d.lane / lanes.length) * 100}% + 16px)`,
            background: LANE_COLOR[lanes[d.lane]] ?? '#E3C27C',
            boxShadow: reduced ? 'none' : `0 0 6px ${LANE_COLOR[lanes[d.lane]] ?? '#E3C27C'}`,
            opacity: reduced ? 0.75 : undefined,
            animation: reduced
              ? undefined
              : `fly-rain-fall .9s cubic-bezier(.22,1,.36,1) ${d.delay}s both`,
          }}
        />
      ))}

      {/* 时间刻度 */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1.5 pb-0.5 font-mono text-[9px] text-faint/70">
        <span>0 ms</span>
        <span>{duration} ms</span>
      </div>
    </div>
  )
}

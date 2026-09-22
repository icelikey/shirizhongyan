/**
 * <RadarChart> 迷你雷达图（agent.md §A3 / 图鉴卡）。
 * SVG 正多边形网格 + 数据多边形（花色渐变填充 30%），轴尖标注维度名。
 */
import { memo, useId } from 'react'
import { cn } from '@/lib/utils'

export interface RadarChartProps {
  /** 各维度值 0-100，顺序对应 labels */
  values: number[]
  labels: string[]
  /** 主题色（默认金） */
  color?: string
  size?: number
  /** 是否显示轴标签（小尺寸可关） */
  showLabels?: boolean
  className?: string
}

function RadarChartInner({ values, labels, color = '#E3C27C', size = 160, showLabels = true, className }: RadarChartProps) {
  const gid = useId()
  const n = Math.min(values.length, labels.length)
  if (n < 3) return null

  const cx = 50
  const cy = 50
  const R = 34 // 数据半径（viewBox 100）
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const pt = (i: number, r: number) => `${(cx + r * Math.cos(angle(i))).toFixed(2)},${(cy + r * Math.sin(angle(i))).toFixed(2)}`

  const rings = [0.33, 0.66, 1]
  const dataPts = values
    .slice(0, n)
    .map((v, i) => pt(i, (Math.max(0, Math.min(100, v)) / 100) * R))
    .join(' ')

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label={`雷达图：${labels.join('/')}`}
    >
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0.18" />
        </radialGradient>
      </defs>
      {/* 网格环 */}
      {rings.map((k) => (
        <polygon
          key={k}
          points={Array.from({ length: n }).map((_, i) => pt(i, R * k)).join(' ')}
          fill="none"
          stroke="rgba(227,194,124,.18)"
          strokeWidth="0.6"
        />
      ))}
      {/* 轴线 */}
      {Array.from({ length: n }).map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + R * Math.cos(angle(i))}
          y2={cy + R * Math.sin(angle(i))}
          stroke="rgba(227,194,124,.14)"
          strokeWidth="0.6"
        />
      ))}
      {/* 数据多边形 */}
      <polygon points={dataPts} fill={`url(#${gid})`} stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
      {values.slice(0, n).map((v, i) => {
        const r = (Math.max(0, Math.min(100, v)) / 100) * R
        return <circle key={i} cx={cx + r * Math.cos(angle(i))} cy={cy + r * Math.sin(angle(i))} r="1.4" fill={color} />
      })}
      {/* 轴标签 */}
      {showLabels &&
        labels.slice(0, n).map((lb, i) => {
          const lr = R + 11
          const x = cx + lr * Math.cos(angle(i))
          const y = cy + lr * Math.sin(angle(i))
          return (
            <text
              key={lb}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.5"
              fill="#A89F8D"
              style={{ fontFamily: '"Noto Sans SC", sans-serif' }}
            >
              {lb}
            </text>
          )
        })}
    </svg>
  )
}

const RadarChart = memo(RadarChartInner)
export default RadarChart

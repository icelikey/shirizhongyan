/**
 * ============================================================================
 * 碎境爬塔 · 手写内联 SVG 图标库（spire-map.md §5）
 * ============================================================================
 * - 14 枚遗物图标 + 6 枚药水图标：64 viewBox，琥珀单线，stroke=currentColor
 *   （颜色由父级 text-* / style.color 控制，默认琥珀 #F2A93B）。
 * - 节点字形（剑 / 鬼面 / ？/ 火焰 / 刀币 / 箱 / 玉玺）同套笔触，供地图玺印节点。
 * - 未知 id → 通用印章 / 通用瓶兜底。
 * ============================================================================
 */
import type { CSSProperties, ReactNode } from 'react'
import type { NodeType } from '@/data/spire/types'
import { cn } from '@/lib/utils'

export interface SpireIconProps {
  id: string
  size?: number
  className?: string
  style?: CSSProperties
}

/* ── 遗物（14） ───────────────────────────────────────────────────────────── */
const RELIC_PATHS: Record<string, ReactNode> = {
  /* 朱砂印：方玺 + 印面一点朱 */
  zhushayin: (
    <>
      <rect x="16" y="14" width="32" height="32" rx="4" />
      <path d="M24 46h16l3 8H21l3-8Z" />
      <circle cx="32" cy="30" r="5" fill="currentColor" stroke="none" />
    </>
  ),
  /* 龟甲：六边甲 + 甲纹 */
  guijia: (
    <>
      <path d="M32 8 52 20v24L32 56 12 44V20L32 8Z" />
      <path d="M32 8v24m0 0 20 12M32 32 12 44M32 32l20-12M32 32 12 20M32 32v24" />
    </>
  ),
  /* 日晷残片：半圆晷面 + 断针 */
  rigui: (
    <>
      <path d="M12 46a20 20 0 0 1 40 0Z" />
      <path d="M32 46 42 22" />
      <path d="M42 22l6-8" strokeDasharray="4 4" />
      <path d="M18 40h4m20-14 3-3M26 32l2-4" />
    </>
  ),
  /* 刀币：刀形币 */
  daobi: (
    <>
      <path d="M38 8c-8 10-16 22-18 34-1 7 3 12 9 13 7 1 11-4 12-10" />
      <path d="M38 8c4 2 7 6 8 10-6 16-10 24-14 30" />
      <circle cx="34" cy="47" r="4" />
    </>
  ),
  /* 魂珀：琥珀坠 + 内焰 */
  hunpo: (
    <>
      <path d="M32 10c10 8 16 16 16 25a16 16 0 1 1-32 0c0-9 6-17 16-25Z" />
      <path d="M32 28c4 4 6 7 6 10a6 6 0 1 1-12 0c0-3 2-6 6-10Z" />
    </>
  ),
  /* 引路灯：提灯 */
  yinlu: (
    <>
      <path d="M24 18a8 8 0 0 1 16 0" />
      <path d="M22 18h20l2 26a10 10 0 0 1-10 8h-4a10 10 0 0 1-10-8l2-26Z" />
      <path d="M32 28v10m-6 8h12" />
    </>
  ),
  /* 骨哨：哨骨 */
  gushao: (
    <>
      <path d="M14 40c10-2 22-10 30-22l6 6c-8 12-18 20-28 24l-8-8Z" />
      <circle cx="44" cy="18" r="5" />
      <path d="M20 44l-4 6m10-2-2 6" />
    </>
  ),
  /* 铁券：符券铁版 */
  tiequan: (
    <>
      <rect x="18" y="10" width="28" height="44" rx="3" />
      <path d="M25 20h14M25 28h14M25 36h9" />
      <path d="M25 44h14" strokeDasharray="3 3" />
    </>
  ),
  /* 明镜：圆镜 + 座 */
  mingjing: (
    <>
      <circle cx="32" cy="26" r="16" />
      <circle cx="32" cy="26" r="9" />
      <path d="M32 42v8m-10 6h20l-4-6H26l-4 6Z" />
    </>
  ),
  /* 业火盏：灯盏 + 业火 */
  yehuo: (
    <>
      <path d="M32 12c5 6 9 9 9 14a9 9 0 1 1-18 0c0-5 4-8 9-14Z" />
      <path d="M16 42h32l-4 10H20l-4-10Z" />
    </>
  ),
  /* 镇纸：纸 + 镇尺 */
  zhenzhi: (
    <>
      <path d="M16 14h32v36H16z" />
      <path d="M22 22h20M22 30h14" />
      <rect x="24" y="38" width="16" height="6" rx="2" fill="currentColor" stroke="none" />
    </>
  ),
  /* 沙漏 */
  shalou: (
    <>
      <path d="M20 10h24M20 54h24" />
      <path d="M23 14c0 10 6 12 9 18-3 6-9 8-9 18h18c0-10-6-12-9-18 3-6 9-8 9-18H23Z" />
      <path d="M28 46h8" fill="currentColor" />
    </>
  ),
  /* 星盘：浑仪环 + 星 */
  xingpan: (
    <>
      <circle cx="32" cy="32" r="20" />
      <ellipse cx="32" cy="32" rx="20" ry="8" />
      <path d="M32 20l2.4 6.6L41 29l-6.6 2.4L32 38l-2.4-6.6L23 29l6.6-2.4L32 20Z" fill="currentColor" stroke="none" />
    </>
  ),
  /* 残符：符纸 + 残印 */
  canfu: (
    <>
      <path d="M20 8h24v40l-6 8-6-6-6 6-6-8V8Z" />
      <path d="M26 16h12M26 24h12" />
      <path d="M26 34c2-4 10-4 12 0" />
    </>
  ),
}
const RELIC_FALLBACK: ReactNode = (
  <>
    <path d="M32 10 50 32 32 54 14 32Z" />
    <circle cx="32" cy="32" r="6" />
  </>
)

/* ── 药水（6） ────────────────────────────────────────────────────────────── */
const POTION_PATHS: Record<string, ReactNode> = {
  /* 金创药：圆瓶 + 十字 */
  jinchuang: (
    <>
      <path d="M26 8h12v8l8 12a16 16 0 1 1-28 0l8-12V8Z" />
      <path d="M32 32v12m-6-6h12" />
    </>
  ),
  /* 厉石散：方瓶 + 升力箭 */
  lishi: (
    <>
      <path d="M26 8h12v10l6 8v22a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V26l6-8V8Z" />
      <path d="M32 44V30m-5 5 5-6 5 6" />
    </>
  ),
  /* 青锋酿：葫芦瓶 + 叶刃 */
  qingfeng: (
    <>
      <path d="M28 8h8v6a10 10 0 0 1 8 16 14 14 0 1 1-24 0 10 10 0 0 1 8-16V8Z" />
      <path d="M26 40c6-2 10-6 12-12 2 8-2 14-12 12Z" />
    </>
  ),
  /* 毒雾瓶：瓶 + 骷雾 */
  duwu: (
    <>
      <path d="M26 8h12v8l8 12a16 16 0 1 1-28 0l8-12V8Z" />
      <circle cx="27" cy="36" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="37" cy="36" r="2.4" fill="currentColor" stroke="none" />
      <path d="M28 44h8" />
    </>
  ),
  /* 寒石散：瓶 + 霜花 */
  hanshi: (
    <>
      <path d="M26 8h12v10l6 8v22a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V26l6-8V8Z" />
      <path d="M32 30v14m-6-11 12 7m0-11-12 7" />
    </>
  ),
  /* 火油瓶：瓶 + 火苗 */
  huoyou: (
    <>
      <path d="M26 8h12v8l8 12a16 16 0 1 1-28 0l8-12V8Z" />
      <path d="M32 30c4 4 6 6 6 9a6 6 0 1 1-12 0c0-3 2-5 6-9Z" />
    </>
  ),
}
const POTION_FALLBACK: ReactNode = (
  <>
    <path d="M26 8h12v8l8 12a16 16 0 1 1-28 0l8-12V8Z" />
    <circle cx="32" cy="38" r="5" />
  </>
)

function SpireSvg({ size, className, style, label, children }: { size: number; className?: string; style?: CSSProperties; label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={label}
      className={cn('shrink-0', className)}
      style={{ color: '#F2A93B', ...style }}
    >
      {children}
    </svg>
  )
}

/** 遗物图标（14 枚 + 兜底印章） */
export function RelicIcon({ id, size = 20, className, style }: SpireIconProps) {
  return (
    <SpireSvg size={size} className={className} style={style} label={`遗物 ${id}`}>
      {RELIC_PATHS[id] ?? RELIC_FALLBACK}
    </SpireSvg>
  )
}

/** 药水图标（6 枚 + 兜底瓶） */
export function PotionIcon({ id, size = 20, className, style }: SpireIconProps) {
  return (
    <SpireSvg size={size} className={className} style={style} label={`药水 ${id}`}>
      {POTION_PATHS[id] ?? POTION_FALLBACK}
    </SpireSvg>
  )
}

/* ── 地图节点字形（剑 / 鬼面 / ？/ 火焰 / 刀币 / 箱 / 玉玺） ─────────────────── */
const NODE_GLYPHS: Record<NodeType, ReactNode> = {
  /* 战斗：交刃 */
  battle: (
    <>
      <path d="M18 14l24 24m4 4 4 4M42 14 18 46l-4 4" />
      <path d="M14 10l6 6m24 24 6 6" />
    </>
  ),
  /* 精英：鬼面 */
  elite: (
    <>
      <path d="M32 12c12 0 18 8 18 18 0 12-8 20-18 22-10-2-18-10-18-22 0-10 6-18 18-18Z" />
      <path d="M22 30l6 3m8 0 6-3" />
      <path d="M26 40c2 2 4 2 6 0 2 2 4 2 6 0" />
      <path d="M20 14l4 6m20-6-4 6" />
    </>
  ),
  /* 事件：？ */
  event: (
    <>
      <path d="M24 22a8 8 0 1 1 12 7c-3 2-4 4-4 7" />
      <circle cx="32" cy="46" r="2.6" fill="currentColor" stroke="none" />
    </>
  ),
  /* 篝火：火焰 */
  rest: (
    <>
      <path d="M32 10c6 8 12 12 12 20a12 12 0 1 1-24 0c0-8 6-12 12-20Z" />
      <path d="M32 30c3 3 5 5 5 8a5 5 0 1 1-10 0c0-3 2-5 5-8Z" />
    </>
  ),
  /* 商店：刀币（与遗物同形） */
  shop: (
    <>
      <path d="M38 8c-8 10-16 22-18 34-1 7 3 12 9 13 7 1 11-4 12-10" />
      <path d="M38 8c4 2 7 6 8 10-6 16-10 24-14 30" />
      <circle cx="34" cy="47" r="4" />
    </>
  ),
  /* 宝箱 */
  treasure: (
    <>
      <path d="M12 26a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v4H12v-4Z" />
      <path d="M12 30h40v16a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V30Z" />
      <path d="M32 26v10m-4-5h8" />
    </>
  ),
  /* Boss：大型玉玺 */
  boss: (
    <>
      <rect x="14" y="12" width="36" height="36" rx="5" />
      <path d="M32 20v16m-8-8h16M24 40h16" />
      <path d="M22 48h20l4 8H18l4-8Z" />
    </>
  ),
}

export interface NodeGlyphProps {
  type: NodeType
  size?: number
  className?: string
  style?: CSSProperties
}

/** 节点字形（内嵌于 56px 玺印） */
export function NodeGlyph({ type, size = 24, className, style }: NodeGlyphProps) {
  return (
    <SpireSvg size={size} className={className} style={style} label={`节点 ${type}`}>
      {NODE_GLYPHS[type]}
    </SpireSvg>
  )
}

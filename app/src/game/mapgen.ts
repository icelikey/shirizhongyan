/**
 * ============================================================================
 * 碎境爬塔 · 分支地图生成（spire-map.md §3.1）
 * ============================================================================
 * - 每层 15 行：row 0 固定 3 个战斗起点；row 14 固定 1 个 Boss；
 *   row 1–13 每行 2–4 节点。
 * - 类型分布：战斗 45% / 事件 18% / 精英 10%（第 5 行后）/ 篝火 12%（第 12 行必出 1）
 *   / 商店 8% / 宝箱 7%，并保证每层至少 1 精英、1 商店、1 宝箱。
 * - 连线：相邻行间按「归一化列位最近邻」连 1–2 条出边（55% 概率第二条），
 *   贪心避交叉；回填入度保证每个节点可达、每行必有通路。
 * - 种子随机：seed = hash(`${runId}#floor-${n}`)，同一 run 同一层地图恒定。
 *   生成的 MapNode[] 由页面写入 spire store 持久化（initFloorMap）。
 * ============================================================================
 */
import type { MapNode, NodeType } from '@/data/spire/types'

export const MAP_ROWS = 15
export const BOSS_ROW = MAP_ROWS - 1
/** 第 12 行（1-indexed）= 下标 11，必出篝火 */
const REST_GUARANTEE_ROW = 11
/** 精英允许出现的起始行（第 5 行后，0-indexed） */
const ELITE_MIN_ROW = 5

/* ── 种子随机 ─────────────────────────────────────────────────────────────── */
/** xfnv-1a 字符串哈希 */
export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 PRNG： deterministic 0..1 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 由节点 id 派生的稳定 0..1 抖动（布局用，不与生成逻辑抢流） */
export function idJitter(id: string, salt: number): number {
  return (hashSeed(`${id}#${salt}`) % 1000) / 1000
}

/* ── 类型分配 ─────────────────────────────────────────────────────────────── */
const WEIGHTS: [NodeType, number][] = [
  ['battle', 0.45],
  ['event', 0.18],
  ['elite', 0.1],
  ['rest', 0.12],
  ['shop', 0.08],
  ['treasure', 0.07],
]

function rollType(rng: () => number, row: number, rowPicks: NodeType[]): NodeType {
  for (let attempt = 0; attempt < 24; attempt++) {
    let r = rng()
    let pick: NodeType = 'battle'
    for (const [t, w] of WEIGHTS) {
      r -= w
      if (r <= 0) {
        pick = t
        break
      }
    }
    if (pick === 'elite' && row < ELITE_MIN_ROW) continue
    // 同一行内精英/商店/篝火至多各 1 个，避免体验扎堆
    if ((pick === 'elite' || pick === 'shop' || pick === 'rest') && rowPicks.includes(pick)) continue
    return pick
  }
  return 'battle'
}

/* ── 主生成 ───────────────────────────────────────────────────────────────── */
export function generateFloor(runId: string, floor: number): MapNode[] {
  const rng = mulberry32(hashSeed(`${runId}#floor-${floor}`))

  // 1) 行节点数
  const rowCounts: number[] = [3]
  for (let r = 1; r <= BOSS_ROW - 1; r++) rowCounts.push(2 + Math.floor(rng() * 3)) // 2–4
  rowCounts.push(1) // Boss 行

  // 2) 类型
  const types: NodeType[][] = rowCounts.map((count, row) => {
    if (row === 0) return Array<NodeType>(count).fill('battle')
    if (row === BOSS_ROW) return ['boss']
    const picks: NodeType[] = []
    for (let c = 0; c < count; c++) picks.push(rollType(rng, row, picks))
    return picks
  })

  // 3) 强制约束
  const midRows: number[] = []
  for (let r = 1; r <= BOSS_ROW - 1; r++) midRows.push(r)
  const ensure = (want: NodeType, rows: number[]) => {
    if (types.some((row, r) => r > 0 && r < BOSS_ROW && row.includes(want))) return
    const candidates = rows.filter((r) => types[r].length > 0)
    if (candidates.length === 0) return
    const row = candidates[Math.floor(rng() * candidates.length)]
    // 优先替换战斗节点，保持分布观感
    let col = types[row].findIndex((t) => t === 'battle')
    if (col < 0) col = Math.floor(rng() * types[row].length)
    types[row][col] = want
  }
  // 第 12 行必出篝火
  if (!types[REST_GUARANTEE_ROW].includes('rest')) {
    types[REST_GUARANTEE_ROW][Math.floor(rng() * types[REST_GUARANTEE_ROW].length)] = 'rest'
  }
  ensure('elite', midRows.filter((r) => r >= ELITE_MIN_ROW))
  ensure('shop', midRows.filter((r) => r >= 3))
  ensure('treasure', midRows.filter((r) => r >= 2))

  // 4) 建节点
  const nodes: MapNode[] = []
  const idOf = (row: number, col: number) => `f${floor}-r${row}-c${col}`
  rowCounts.forEach((count, row) => {
    for (let col = 0; col < count; col++) {
      nodes.push({ id: idOf(row, col), row, col, type: types[row][col], next: [], done: false })
    }
  })
  const at = (row: number, col: number) => nodes.find((n) => n.row === row && n.col === col)!
  const xOf = (row: number, col: number) => (col + 0.5) / rowCounts[row]

  // 5) 连边（相邻行；最近邻 1–2 条；贪心避交叉；回填入度）
  const crosses = (a1: number, b1: number, a2: number, b2: number) => (a1 - a2) * (b1 - b2) < 0
  for (let row = 0; row < BOSS_ROW; row++) {
    const curCount = rowCounts[row]
    const nxtCount = rowCounts[row + 1]
    const edges: [number, number][] = []
    const hasEdge = (c: number, j: number) => edges.some(([a, b]) => a === c && b === j)
    const tryAdd = (c: number, j: number) => {
      if (hasEdge(c, j)) return false
      const x1 = xOf(row, c)
      const y1 = xOf(row + 1, j)
      // 无交叉边优先：与已存在的边相交则跳过
      for (const [a, b] of edges) {
        if (crosses(x1, y1, xOf(row, a), xOf(row + 1, b))) return false
      }
      edges.push([c, j])
      return true
    }
    // 按列位与下一行最近邻对齐
    const nearest = (c: number): number[] => {
      const x = xOf(row, c)
      return Array.from({ length: nxtCount }, (_, j) => j).sort(
        (a, b) => Math.abs(xOf(row + 1, a) - x) - Math.abs(xOf(row + 1, b) - x),
      )
    }
    for (let c = 0; c < curCount; c++) {
      const order = nearest(c)
      let added = tryAdd(c, order[0]) ? 1 : 0
      // 55% 概率第二条边；若首选被交叉拒绝则顺延
      const wantTwo = rng() < 0.55
      for (const j of order.slice(1)) {
        if (added >= (wantTwo ? 2 : 1)) break
        if (tryAdd(c, j)) added++
      }
      // 保底：每个节点至少一条出边（放弃避交叉）
      if (added === 0) {
        edges.push([c, order[0]])
      }
    }
    // 回填入度：下一行每个节点至少一条入边
    for (let j = 0; j < nxtCount; j++) {
      if (edges.some(([, b]) => b === j)) continue
      const x = xOf(row + 1, j)
      const src = Array.from({ length: curCount }, (_, c) => c).sort(
        (a, b) => Math.abs(xOf(row, a) - x) - Math.abs(xOf(row, b) - x),
      )
      let done = false
      for (const c of src) {
        if (!hasEdge(c, j) && tryAdd(c, j)) {
          done = true
          break
        }
      }
      if (!done) edges.push([src[0], j]) // 放弃避交叉的保底
    }
    // 写回节点
    for (const [c, j] of edges) {
      at(row, c).next.push(idOf(row + 1, j))
    }
  }

  return nodes
}

/* ── 布局（UI 用）：x/y ∈ 0..1，y 自下而上（row 0 在底部） ────────────────── */
export interface NodePos { x: number; y: number }
export function layoutNodes(nodes: MapNode[]): Map<string, NodePos> {
  const rowCounts = new Map<number, number>()
  nodes.forEach((n) => rowCounts.set(n.row, (rowCounts.get(n.row) ?? 0) + 1))
  const pos = new Map<string, NodePos>()
  for (const n of nodes) {
    const count = rowCounts.get(n.row) ?? 1
    const baseX = (n.col + 0.5) / count
    // 稳定抖动（±4% 宽、±1.2% 高），让地图更「手工」
    const jx = (idJitter(n.id, 7) - 0.5) * 0.08
    const jy = (idJitter(n.id, 13) - 0.5) * 0.024
    pos.set(n.id, {
      x: Math.min(0.94, Math.max(0.06, baseX + jx)),
      y: n.row / (MAP_ROWS - 1) + jy,
    })
  }
  return pos
}

/* ── 自检（开发辅助）：连通性 + 分布统计 ──────────────────────────────────── */
export function debugStats(nodes: MapNode[]): { counts: Record<string, number>; unreachable: number } {
  const counts: Record<string, number> = {}
  const reached = new Set<string>()
  const queue = nodes.filter((n) => n.row === 0).map((n) => n.id)
  nodes.forEach((n) => {
    counts[n.type] = (counts[n.type] ?? 0) + 1
  })
  while (queue.length) {
    const id = queue.shift()!
    if (reached.has(id)) continue
    reached.add(id)
    const n = nodes.find((x) => x.id === id)
    if (n) queue.push(...n.next)
  }
  return { counts, unreachable: nodes.length - reached.size }
}

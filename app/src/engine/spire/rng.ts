/**
 * 确定性随机数（mulberry32），状态存于 BattleState.rngState，
 * 使引擎可被 structuredClone / 冒烟脚本确定性回放。
 */

/** 返回 [0,1) 浮点并推进状态 */
export function nextRandom(s: { rngState: number }): number {
  s.rngState = (s.rngState + 0x6d2b79f5) | 0
  let t = s.rngState
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** [min, max] 闭区间整数 */
export function randInt(s: { rngState: number }, min: number, max: number): number {
  return min + Math.floor(nextRandom(s) * (max - min + 1))
}

/** 洗牌（Fisher–Yates，原地） */
export function shuffle<T>(s: { rngState: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/** 权重随机 */
export function weightedPick<T>(s: { rngState: number }, items: T[], weight: (t: T) => number): T {
  const total = items.reduce((sum, it) => sum + weight(it), 0)
  let roll = nextRandom(s) * total
  for (const it of items) {
    roll -= weight(it)
    if (roll <= 0) return it
  }
  return items[items.length - 1]
}

/** 供奖励 roll 使用的独立随机源（UI 侧无需确定性时可用 Math.random） */
export function rngFromSeed(seed: number): () => number {
  const holder = { rngState: seed | 0 }
  return () => nextRandom(holder)
}

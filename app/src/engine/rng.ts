/**
 * ============================================================================
 * 引擎内使用的确定性随机源（mulberry32）。
 * 以对局种子驱动，保证同种子可复现；种子由页面以 `hash(roomId) ^ Date.now()` 生成。
 * ============================================================================
 */

/** 字符串 → 32 位种子（FNV-1a 变体） */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 易用的随机源封装 */
export class Rng {
  private nextFn: () => number

  constructor(seed: number) {
    this.nextFn = mulberry32(seed)
  }

  /** [0,1) */
  next(): number {
    return this.nextFn()
  }

  /** [min,max) 实数 */
  range(min: number, max: number): number {
    return min + this.nextFn() * (max - min)
  }

  /** [min,max] 整数 */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /** 概率 p 命中 */
  chance(p: number): boolean {
    return this.nextFn() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.nextFn() * arr.length))]
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFn() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  /** 近似标准正态（中心极限，6 次叠加） */
  gaussian(): number {
    let s = 0
    for (let i = 0; i < 6; i++) s += this.nextFn()
    return (s - 3) / 1.5
  }
}

/**
 * 十日倒计时逻辑（design.md §8 / home.md S0）。
 * 以会话创建日（login 时间）为第 1 日，每 24h 进一日，第 10 日结束即「终焉」。
 */

export const DAY_MS = 24 * 60 * 60 * 1000
export const TOTAL_DAYS = 10

export interface CountdownState {
  /** 当前第几日（1-10，超过 10 则为 10） */
  day: number
  /** 当日剩余毫秒（进入下一日之前） */
  remainMs: number
  /** 距终焉（第 10 日结束）的总毫秒 */
  totalRemainMs: number
  /** 十日总进度 0-1 */
  totalProgress: number
  /** 当日进度 0-1 */
  dayProgress: number
  /** 是否处于危机时段（第 10 日最后 1 小时，全局金色转朱砂） */
  crisis: boolean
}

/** 由会话创建时间戳计算十日倒计时状态 */
export function getCountdown(createdAt: number, now: number = Date.now()): CountdownState {
  const elapsed = Math.max(0, now - createdAt)
  const endAt = createdAt + TOTAL_DAYS * DAY_MS
  const totalRemainMs = Math.max(0, endAt - now)
  const day = Math.min(TOTAL_DAYS, Math.floor(elapsed / DAY_MS) + 1)
  const remainMs = totalRemainMs === 0 ? 0 : DAY_MS - (elapsed % DAY_MS)
  return {
    day,
    remainMs,
    totalRemainMs,
    totalProgress: Math.min(1, elapsed / (TOTAL_DAYS * DAY_MS)),
    dayProgress: totalRemainMs === 0 ? 1 : (elapsed % DAY_MS) / DAY_MS,
    crisis: totalRemainMs > 0 && totalRemainMs <= 60 * 60 * 1000,
  }
}

/** 格式化为 `HH:MM:SS` */
export function formatHMS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** 完整展示文案：`第 N 日 · HH:MM:SS 至终焉` */
export function formatCountdown(state: CountdownState): string {
  return `第 ${state.day} 日 · ${formatHMS(state.remainMs)} 至终焉`
}

/**
 * 每次 tick 的推荐间隔（毫秒）。
 * 供组件 setInterval 使用；保持简单，固定 1s。
 */
export const COUNTDOWN_TICK_MS = 1000

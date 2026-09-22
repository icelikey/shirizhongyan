/**
 * 元系统（大厅/世界/影从）共享原型数据与工具。
 * 仅服务于 src/pages/Lobby|World|Agent 与 src/components/meta/**。
 */
import type { Echo, Suit } from '@/data/echoes'
import type { EchoStatus } from '@/components/EchoAvatar'

/* ── 8 位常驻影从在线状态（原型假数据，Lobby 与 Agent 共用） ───────────── */
export const ECHO_STATUS: Record<string, EchoStatus> = {
  baize: 'online',
  eshou: 'in-game',
  xuanji: 'online',
  qingnang: 'online',
  zhuyin: 'offline',
  ajiu: 'online',
  shouzhuo: 'in-game',
  baixiao: 'online',
}

export const STATUS_LABEL: Record<EchoStatus, string> = {
  online: '在线',
  'in-game': '对局中',
  offline: '离线',
}

export const STATUS_COLOR: Record<EchoStatus, string> = {
  online: '#4ECB9C',
  'in-game': '#E3C27C',
  offline: '#6E6880',
}

/* ── 游戏路由 ─────────────────────────────────────────────────────────── */
export type MetaGame = 'werewolf' | 'guess'

/** 生成对局路由（契约：/game/<game>/<timestamp>） */
export const gameRoute = (game: MetaGame): string => `/game/${game}/${Date.now()}`

/**
 * 影从邀战对应的游戏：♠ 玄渊 → 狼人杀；♣ 青野 → 猜平均数；
 * ♥ 丹丘（心理）→ 狼人杀；♦ 金壤大陆未开启 → null（禁用邀战）。
 */
export const gameForEcho = (echo: Echo): MetaGame | null => {
  if (echo.suit === 'spade') return 'werewolf'
  if (echo.suit === 'club') return 'guess'
  if (echo.suit === 'heart') return 'werewolf'
  return null
}

export const GAME_META: Record<MetaGame, { name: string; suit: Suit; ticketMin: number; ticketMax: number }> = {
  werewolf: { name: '月影狼人杀', suit: 'spade', ticketMin: 10, ticketMax: 30 },
  guess: { name: '猜平均数', suit: 'club', ticketMin: 5, ticketMax: 20 },
}

/* ── 影从四维假数据（攻击性 / 欺骗 / 计算 / 心理，0-100） ─────────────── */
export interface EchoRadar {
  aggression: number
  deception: number
  calculation: number
  psychology: number
}

export const ECHO_RADAR: Record<string, EchoRadar> = {
  baize: { aggression: 42, deception: 66, calculation: 96, psychology: 80 },
  eshou: { aggression: 88, deception: 95, calculation: 62, psychology: 74 },
  xuanji: { aggression: 35, deception: 40, calculation: 98, psychology: 58 },
  qingnang: { aggression: 30, deception: 55, calculation: 70, psychology: 96 },
  zhuyin: { aggression: 64, deception: 58, calculation: 88, psychology: 62 },
  ajiu: { aggression: 58, deception: 72, calculation: 55, psychology: 94 },
  shouzhuo: { aggression: 18, deception: 35, calculation: 90, psychology: 66 },
  baixiao: { aggression: 46, deception: 82, calculation: 76, psychology: 88 },
}

export const RADAR_DIMS: { key: keyof EchoRadar; label: string }[] = [
  { key: 'aggression', label: '攻击性' },
  { key: 'deception', label: '欺骗' },
  { key: 'calculation', label: '计算' },
  { key: 'psychology', label: '心理' },
]

/* ── 恩怨条种子（玩家尚未与影从交手时的原型展示值） ────────────────────── */
export interface RivalStat {
  won: number
  lost: number
}

export const ECHO_RIVAL_SEED: Record<string, RivalStat> = {
  baize: { won: 4, lost: 8 },
  eshou: { won: 5, lost: 7 },
  xuanji: { won: 3, lost: 9 },
  qingnang: { won: 6, lost: 4 },
  zhuyin: { won: 2, lost: 5 },
  ajiu: { won: 7, lost: 5 },
  shouzhuo: { won: 4, lost: 4 },
  baixiao: { won: 5, lost: 6 },
}

/** 恩怨纪要种子（store echoMemories 无笔记时展示） */
export const ECHO_NOTE_SEED: Record<string, string[]> = {
  baize: ['第 2 日 · 狼人杀对座，TA 第三轮点破你的悍跳。', '第 4 日 · 你再遇白泽，险胜半票。'],
  eshou: ['第 3 日 · 讹兽悍跳预言家，你被带节奏出局。', '第 5 日 · 你识破了 TA 的倒钩。'],
  xuanji: ['第 2 日 · 猜平均数败于璇玑，差 0.7。', '第 4 日 · TA 的第三层思维碾压全场。'],
  qingnang: ['第 3 日 · 青囊与你结盟两轮，末轮拆盟。', '第 6 日 · TA 替你解了一次围。'],
  zhuyin: ['第 5 日 · 烛阴在资源局压你一头。'],
  ajiu: ['第 2 日 · 阿九凭直觉放逐了你。', '第 5 日 · 你骗过了 TA 一次，TA 记到现在。'],
  shouzhuo: ['第 4 日 · 守拙全程弃守，最后一轮反杀。'],
  baixiao: ['第 3 日 · 你向百晓生买过一条假情报。', '第 6 日 · TA 把你的底牌卖给了对面。'],
}

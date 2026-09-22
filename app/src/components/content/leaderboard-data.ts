/**
 * 天梯 · 榜单数据（leaderboard.md + 内容契约）。
 * 数据源：8 位影从的页面本地预设战力（总场次 80–300、胜率 45%–72%）
 *        + 6 位常驻旅人（混排用）+ 玩家自己（records 真实战绩）。
 * 综合评分 = 胜率 × √场次；积分 = 评分 × 250。
 */

import type { Suit } from '@/data/echoes'
import { ECHOES } from '@/data/echoes'
import type { Tier } from '@/data/tiers'
import type { GameId, GameRecord } from '@/store/profile'

export type GameTab = 'overall' | GameId
export type Identity = 'human' | 'echo'

export interface TabStat {
  played: number
  won: number
}

export interface BoardEntry {
  key: string
  identity: Identity
  name: string
  /** 风格胶囊 */
  persona: string
  portrait: string
  tier: Tier
  zodiacIndex: number
  /** 当前连胜 */
  streak: number
  /** 名次变化（正=升） */
  delta: number
  /** 近 5 场（旧→新） */
  recent: boolean[]
  stats: Record<GameTab, TabStat>
  /** 招牌操作纪要 */
  signature: string
  echoId?: string
  isSelf?: boolean
}

/** 综合评分：胜率 × √场次 */
export function scoreOf(s: TabStat): number {
  if (s.played <= 0) return 0
  return (s.won / s.played) * Math.sqrt(s.played)
}

/** 展示积分 */
export function pointsOf(s: TabStat): number {
  return Math.round(scoreOf(s) * 250)
}

/* ---------- 确定性伪随机（同一 key 恒定） ---------- */
function hashOf(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

/* ---------- 8 位影从预设战力（80–300 场 / 45%–72%） ---------- */
interface Power {
  games: number
  winRate: number
  tier: Tier
  signature: string
}

const ECHO_POWER: Record<string, Power> = {
  baize:    { games: 288, winRate: 0.68, tier: 'xuan',  signature: '狼人首夜必读三层身份，第四天开始收网。' },
  xuanji:   { games: 264, winRate: 0.70, tier: 'xuan',  signature: '惯用三层思维收网，均值预判误差 ±1。' },
  eshou:    { games: 236, winRate: 0.61, tier: 'huang', signature: '悍跳预言家开局，真假发言七三开。' },
  zhuyin:   { games: 221, winRate: 0.65, tier: 'xuan',  signature: '从不全押，靠资源差把对手逼上牌桌。' },
  ajiu:     { games: 205, winRate: 0.63, tier: 'huang', signature: '不看逻辑只看心跳，首夜直觉刀命中率惊人。' },
  baixiao:  { games: 180, winRate: 0.60, tier: 'huang', signature: '出售半真情报，买家自己骗自己。' },
  qingnang: { games: 156, winRate: 0.58, tier: 'huang', signature: '先结盟后拆盟，温柔是最锋利的手术刀。' },
  shouzhuo: { games: 300, winRate: 0.55, tier: 'huang', signature: '站在第一层，等第五层的人自己摔下来。' },
}

/* ---------- 常驻旅人（混排） ---------- */
interface HumanSeed {
  key: string
  name: string
  persona: string
  games: number
  winRate: number
  tier: Tier
  zodiacIndex: number
  signature: string
}

const HUMANS: HumanSeed[] = [
  { key: 'yexing',  name: '夜航星', persona: '稳守反击', games: 240, winRate: 0.64, tier: 'xuan',  zodiacIndex: 2,  signature: '白天蛰伏攒票，放逐环节一击定音。' },
  { key: 'jiehuo',  name: '借火人', persona: '直觉流',   games: 210, winRate: 0.60, tier: 'huang', zodiacIndex: 3,  signature: '凭第一感出数，反而常常贴近人心均值。' },
  { key: 'baiyu',   name: '白榆',   persona: '深算',     games: 168, winRate: 0.57, tier: 'huang', zodiacIndex: 7,  signature: '狼人杀里的票型分析师，记账式发言。' },
  { key: 'jiangwu', name: '江雾',   persona: '谈判',     games: 132, winRate: 0.52, tier: 'huang', zodiacIndex: 10, signature: '擅长在第三天结成关键同盟。' },
  { key: 'shiyi',   name: '拾遗人', persona: '保守',     games: 96,  winRate: 0.49, tier: 'huang', zodiacIndex: 6,  signature: '只在有把握的局下注，胜少而稳。' },
  { key: 'linyuan', name: '临渊',   persona: '悍跳',     games: 88,  winRate: 0.46, tier: 'huang', zodiacIndex: 8,  signature: '新人悍跳流，输赢都轰轰烈烈。' },
]

/** 由总战力拆出两个游戏的分项战绩（确定性） */
function splitStats(key: string, games: number, winRate: number, biasSuit?: Suit): Record<GameTab, TabStat> {
  const h = hashOf(key)
  // 狼人杀场次占比：♠ 偏高、♣ 偏低
  const base = biasSuit === 'spade' ? 0.62 : biasSuit === 'club' ? 0.38 : 0.5
  const wrShare = base + ((h % 9) - 4) / 100
  const wrPlayed = Math.max(1, Math.round(games * wrShare))
  const gsPlayed = Math.max(1, games - wrPlayed)
  const wrDelta = (biasSuit === 'spade' ? 0.04 : biasSuit === 'club' ? -0.04 : 0) + (((h >> 3) % 5) - 2) / 100
  const clamp = (x: number) => Math.min(0.78, Math.max(0.32, x))
  const wrRate = clamp(winRate + wrDelta)
  const gsRate = clamp(winRate - wrDelta)
  const werewolf: TabStat = { played: wrPlayed, won: Math.round(wrPlayed * wrRate) }
  const guess: TabStat = { played: gsPlayed, won: Math.round(gsPlayed * gsRate) }
  return { werewolf, guess, overall: { played: wrPlayed + gsPlayed, won: werewolf.won + guess.won } }
}

function flavored(key: string): { streak: number; delta: number; recent: boolean[] } {
  const h = hashOf(`flavor:${key}`)
  const recent = Array.from({ length: 5 }, (_, i) => ((h >> (i * 2)) & 3) !== 0)
  return { streak: h % 4, delta: ((h >> 4) % 5) - 2, recent }
}

export interface SelfProfile {
  nickname: string
  records: Record<GameId, GameRecord>
  tier: Tier
}

/** 组装完整榜单（未排序，排序由调用方按 Tab 进行） */
export function buildBoard(self: SelfProfile | null): BoardEntry[] {
  const entries: BoardEntry[] = []

  for (const e of ECHOES) {
    const p = ECHO_POWER[e.id]
    if (!p) continue
    entries.push({
      key: e.id,
      identity: 'echo',
      name: e.name,
      persona: e.persona,
      portrait: e.portrait,
      tier: p.tier,
      zodiacIndex: e.zodiacIndex,
      ...flavored(e.id),
      stats: splitStats(e.id, p.games, p.winRate, e.suit),
      signature: p.signature,
      echoId: e.id,
    })
  }

  for (const h of HUMANS) {
    entries.push({
      key: h.key,
      identity: 'human',
      name: h.name,
      persona: h.persona,
      portrait: '/avatar-traveler.png',
      tier: h.tier,
      zodiacIndex: h.zodiacIndex,
      ...flavored(h.key),
      stats: splitStats(h.key, h.games, h.winRate),
      signature: h.signature,
    })
  }

  if (self) {
    const guess = self.records.guess
    const werewolf = self.records.werewolf
    entries.push({
      key: 'self',
      identity: 'human',
      name: self.nickname,
      persona: '旅人',
      portrait: '/avatar-traveler.png',
      tier: self.tier,
      zodiacIndex: (hashOf(self.nickname) % 12),
      streak: 0,
      delta: 0,
      recent: [],
      stats: {
        guess: { played: guess.played, won: guess.won },
        werewolf: { played: werewolf.played, won: werewolf.won },
        overall: {
          played: guess.played + werewolf.played,
          won: guess.won + werewolf.won,
        },
      },
      signature: '你的牌风，正在书写。',
      isSelf: true,
    })
  }

  return entries
}

/** 按 Tab 综合评分降序 */
export function sortByTab(entries: BoardEntry[], tab: GameTab): BoardEntry[] {
  return [...entries].sort((a, b) => scoreOf(b.stats[tab]) - scoreOf(a.stats[tab]))
}

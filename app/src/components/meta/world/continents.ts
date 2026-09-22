/**
 * 四大陆配置（world.md §四块大陆）。
 * 坐标为地图内容层（1600×1000）像素中心点。
 */
import type { Suit } from '@/data/echoes'
import type { MetaGame } from '@/components/meta/data'

export interface ContinentMeta {
  suit: Suit
  /** 大陆名 */
  name: string
  /** 一句话主题 */
  theme: string
  image: string
  /** 主场游戏（迷雾大陆为 null） */
  homeGame: MetaGame | null
  homeLabel?: string
  locked: boolean
  lockTip?: string
  /** 内容层中心坐标 px */
  cx: number
  cy: number
  /** 常态浮动周期 s（错开） */
  floatDur: number
}

export const MAP_W = 1600
export const MAP_H = 1000
/** 中央十日轮（世界中枢） */
export const HUB = { cx: 800, cy: 470 }

export const CONTINENTS: ContinentMeta[] = [
  {
    suit: 'spade',
    name: '玄渊',
    theme: '博弈与欺骗之地',
    image: '/continent-spade.png',
    homeGame: 'werewolf',
    homeLabel: '狼人杀主场',
    locked: false,
    cx: 300,
    cy: 220,
    floatDur: 7,
  },
  {
    suit: 'heart',
    name: '丹丘',
    theme: '心理与谈判之地',
    image: '/continent-heart.png',
    homeGame: null,
    homeLabel: '千面牌楼主场',
    // S6 扩展：丹丘大陆已解锁（迷雾散去），主场玩法 = 千面牌楼（扑克肉鸽爬塔 /game/poker）
    locked: false,
    cx: 1130,
    cy: 200,
    floatDur: 8,
  },
  {
    suit: 'club',
    name: '青野',
    theme: '计算与概率之地',
    image: '/continent-club.png',
    homeGame: 'guess',
    homeLabel: '猜平均数主场',
    locked: false,
    cx: 290,
    cy: 750,
    floatDur: 9,
  },
  {
    suit: 'diamond',
    name: '金壤',
    theme: '资源与竞逐之地',
    image: '/continent-diamond.png',
    homeGame: null,
    homeLabel: '碎境爬塔主场',
    // S2 扩展：金壤大陆已解锁（迷雾散去），主场玩法 = 碎境爬塔（单人登塔，非对局路由）
    locked: false,
    cx: 1140,
    cy: 740,
    floatDur: 10,
  },
]

/**
 * 大厅模拟房间数据（lobby.md §房间卡列表 / §默认数据）。
 * 席位模型：6 席；'echo:<id>' 影从入座 / 'human' 真人入座 / null 空位。
 */
import type { MetaGame } from '@/components/meta/data'

export type Seat = `echo:${string}` | 'human' | null

export interface LobbyRoom {
  id: string
  name: string
  /** 'spire' = 碎境爬塔观战假房（S2 扩展，仅「全部」Tab 展示，点击直入 /game/spire） */
  game: MetaGame | 'spire'
  /** 房主显示名 */
  host: string
  hostIsEcho: boolean
  seats: Seat[]
  ticket: number
  status: 'waiting' | 'playing' | 'locked'
  tags: string[]
  /** 锁定提示（迷雾大陆） */
  lockTip?: string
}

export const seatCount = (room: LobbyRoom): number => room.seats.filter(Boolean).length

/** 碎境爬塔观战假房 ×2（S2 扩展）：「全部」Tab 下展示，点击进入 /game/spire */
export const SPIRE_WATCH_ROOMS: LobbyRoom[] = [
  {
    id: 'r-spire-watch-xuanyuan',
    name: '登塔观战 · 玄渊层激斗',
    game: 'spire',
    host: '烛阴',
    hostIsEcho: true,
    seats: ['echo:zhuyin', 'human', null, null, null, null],
    ticket: 12,
    status: 'playing',
    tags: ['肉鸽牌局', '观战'],
  },
  {
    id: 'r-spire-watch-speed',
    name: '碎境竞速 · 冲层实况',
    game: 'spire',
    host: '百晓生',
    hostIsEcho: true,
    seats: ['echo:baixiao', 'human', 'human', null, null, null],
    ticket: 12,
    status: 'playing',
    tags: ['肉鸽牌局', '观战'],
  },
]

export const LOBBY_ROOMS: LobbyRoom[] = [
  {
    id: 'r-xuanyuan-newbie',
    name: '子夜玄渊 · 新手房',
    game: 'werewolf',
    host: '白泽',
    hostIsEcho: true,
    seats: ['echo:baize', 'echo:eshou', 'human', null, null, null],
    ticket: 10,
    status: 'waiting',
    tags: ['新手友好', '影从代打允许'],
  },
  {
    id: 'r-qingye-calc',
    name: '青野演算场',
    game: 'guess',
    host: '璇玑',
    hostIsEcho: true,
    seats: ['echo:xuanji', 'echo:shouzhuo', null, null, null, null],
    ticket: 10,
    status: 'waiting',
    tags: ['影从代打允许'],
  },
  {
    id: 'r-moon-high',
    name: '月影高阶 · 悍跳之夜',
    game: 'werewolf',
    host: '借火人',
    hostIsEcho: false,
    seats: ['echo:eshou', 'echo:baize', 'human', 'human', 'human', null],
    ticket: 25,
    status: 'playing',
    tags: ['高强度'],
  },
  {
    id: 'r-diamond-trial',
    name: '金壤试炼 · 待启',
    game: 'guess',
    host: '烛阴',
    hostIsEcho: true,
    seats: [null, null, null, null, null, null],
    ticket: 20,
    status: 'locked',
    tags: ['竞逐'],
    lockTip: '金壤大陆尚未开启',
  },
  {
    id: 'r-danqiu-mind',
    name: '丹丘心战 · 读心局',
    game: 'werewolf',
    host: '青囊',
    hostIsEcho: true,
    seats: ['echo:qingnang', 'echo:ajiu', 'human', null, null, null],
    ticket: 15,
    status: 'waiting',
    tags: ['心理战', '影从代打允许'],
  },
  {
    id: 'r-abacus-speed',
    name: '算珠无双 · 速算房',
    game: 'guess',
    host: '七分熟',
    hostIsEcho: false,
    seats: ['human', 'human', null, null, null, null],
    ticket: 5,
    status: 'waiting',
    tags: ['新手友好'],
  },
  {
    id: 'r-xuanyuan-review',
    name: '玄渊复盘局',
    game: 'werewolf',
    host: '百晓生',
    hostIsEcho: true,
    seats: ['echo:baixiao', 'echo:baize', 'echo:eshou', 'human', 'human', 'human'],
    ticket: 15,
    status: 'playing',
    tags: ['高强度'],
  },
  {
    id: 'r-qingye-morning',
    name: '青野晨练场',
    game: 'guess',
    host: '守拙',
    hostIsEcho: true,
    seats: ['echo:shouzhuo', 'human', 'human', 'human', null, null],
    ticket: 10,
    status: 'waiting',
    tags: ['影从代打允许', '新手友好'],
  },
]

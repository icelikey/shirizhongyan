/**
 * 8 位常驻智能体（影从）数据 —— 全游戏共享。
 * 立绘路径位于 public/ 下，引用方式 `/<文件名>`。
 */

/** 扑克四花色：♠ 玄渊(欺骗) ♥ 丹丘(心理) ♣ 青野(计算) ♦ 金壤(资源) */
export type Suit = 'spade' | 'heart' | 'club' | 'diamond'

export const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond']

export const SUIT_META: Record<Suit, {
  /** 中文花色大陆名 */
  realm: string
  /** 花色符号 */
  symbol: string
  /** 语义色 */
  color: string
  /** 光晕色 */
  glow: string
  /** 语义描述 */
  domain: string
  /** 图标路径 */
  icon: string
}> = {
  spade:   { realm: '玄渊', symbol: '♠', color: '#8B93F8', glow: 'rgba(139,147,248,.35)', domain: '博弈与欺骗', icon: '/suit-spade.svg' },
  heart:   { realm: '丹丘', symbol: '♥', color: '#EE6A72', glow: 'rgba(238,106,114,.35)', domain: '心理与谈判', icon: '/suit-heart.svg' },
  club:    { realm: '青野', symbol: '♣', color: '#4ECB9C', glow: 'rgba(78,203,156,.35)',  domain: '计算与概率', icon: '/suit-club.svg' },
  diamond: { realm: '金壤', symbol: '♦', color: '#F2A93B', glow: 'rgba(242,169,59,.35)',  domain: '资源与竞逐', icon: '/suit-diamond.svg' },
}

export interface Echo {
  id: string
  /** 名号 */
  name: string
  /** 所属花色大陆 */
  suit: Suit
  /** 人设标签（如：深算 / 悍跳） */
  persona: string
  /** 人设一句话 */
  tagline: string
  /** 守护生肖（zodiac 索引 0-11，对应 鼠..猪） */
  zodiacIndex: number
  /** 立绘路径 */
  portrait: string
  /** 假数据：历史胜率 0-1 */
  winRate: number
  /** 假数据：总对局数 */
  games: number
  /** 签名语录 */
  quote: string
  /** 三行档案（速览用） */
  bio: string[]
  /** 新手推荐 */
  beginner?: boolean
}

export const ECHOES: Echo[] = [
  {
    id: 'baize', name: '白泽', suit: 'spade', persona: '深算',
    tagline: '通晓万物的冷峻谋士，星盘里藏着每一局的终局。',
    zodiacIndex: 4, portrait: '/echo-baize.png', winRate: 0.682, games: 1327,
    quote: '你的犹豫，早已写在星盘之上。',
    bio: ['白泽神兽化形，知鬼神之事。', '狼人杀场上的活史书，记得每一张脸的每一次撒谎。', '从不提高音量——因为不需要。'],
  },
  {
    id: 'eshou', name: '讹兽', suit: 'spade', persona: '悍跳',
    tagline: '人面兔身的狡黠骗徒，谎言是它指尖的纸牌。',
    zodiacIndex: 3, portrait: '/echo-eshou.png', winRate: 0.611, games: 986,
    quote: '我说真话的时候，你信吗？',
    bio: ['其肉美，食之，言不真矣。', '悍跳预言家是它的开场白。', '被它骗过一次的人，会怀疑整个世界。'],
  },
  {
    id: 'xuanji', name: '璇玑', suit: 'club', persona: '计算',
    tagline: '机关术士少女，算珠环绕成浑天仪。',
    zodiacIndex: 0, portrait: '/echo-xuanji.png', winRate: 0.703, games: 1558,
    quote: '每一颗算珠，都是一次心跳。',
    bio: ['青野大陆的机关天才。', '猜平均数的不败传说，脑内有一座活的浑天仪。', '概率于她，不是预测，是呼吸。'],
    beginner: true,
  },
  {
    id: 'qingnang', name: '青囊', suit: 'heart', persona: '谈判',
    tagline: '提药箱的温婉说客，药香里能读出人心。',
    zodiacIndex: 7, portrait: '/echo-qingnang.png', winRate: 0.594, games: 743,
    quote: '你的伤在心里，让我看看。',
    bio: ['悬壶济世的游医，也是谈判桌上的执刀人。', '她的温柔是最锋利的手术刀。', '联盟在她手中结成，也在她手中拆解。'],
  },
  {
    id: 'zhuyin', name: '烛阴', suit: 'diamond', persona: '资源',
    tagline: '衔烛之龙化形的富商，睁眼为昼，闭眼为夜。',
    zodiacIndex: 5, portrait: '/echo-zhuyin.png', winRate: 0.655, games: 1102,
    quote: '筹码即时间，而我掌管昼夜。',
    bio: ['钟山之神，视为昼，瞑为夜。', '金壤大陆最大的庄家。', '他从不赌运气——只囤积让别人不得不赌的资源。'],
  },
  {
    id: 'ajiu', name: '阿九', suit: 'heart', persona: '直觉',
    tagline: '九尾狐少女，漫不经心地洞穿一切。',
    zodiacIndex: 2, portrait: '/echo-ajiu.png', winRate: 0.638, games: 891,
    quote: '别解释啦，你的尾巴已经露出来了。',
    bio: ['青丘九尾，生而读心。', '不看逻辑，只看心跳——准确率却高得可怕。', '最讨厌输，输完会记仇到下一个十日。'],
    beginner: true,
  },
  {
    id: 'shouzhuo', name: '守拙', suit: 'club', persona: '保守',
    tagline: '石佛般的老龟棋手，不动如山。',
    zodiacIndex: 11, portrait: '/echo-shouzhuo.png', winRate: 0.576, games: 2014,
    quote: '急什么，十日还长。',
    bio: ['活了太久的老龟，见过太多个十日轮回。', '最稳的下注者，从不全押，从不崩盘。', '他的胜利来得慢，但很少缺席。'],
    beginner: true,
  },
  {
    id: 'baixiao', name: '百晓生', suit: 'diamond', persona: '情报',
    tagline: '摇扇的情报贩子，扇面写满密文。',
    zodiacIndex: 8, portrait: '/echo-baixiao.png', winRate: 0.622, games: 1204,
    quote: '这局的消息，作价几何？',
    bio: ['没有他不知道的事，只有你不愿付的价。', '信鸽与卷轴是他延伸的耳目。', '和他同桌，先想清楚：你买的是情报，还是他卖你的圈套。'],
  },
]

export const getEcho = (id: string): Echo | undefined => ECHOES.find((e) => e.id === id)

/** 新手三选一推荐（home.md §L Step2） */
export const BEGINNER_ECHOES: Echo[] = ECHOES.filter((e) => e.beginner)

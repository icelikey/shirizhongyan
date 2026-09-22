/**
 * 十二生肖段位数据 —— 世界地图 / 档案共用。
 * 每块花色大陆各有 12 生肖印记，按顺序点亮（store.profile.zodiac）。
 * 生肖印章 SVG 位于 public/zodiac-01.svg … zodiac-12.svg。
 */

export interface ZodiacMeta {
  /** 索引 0-11 */
  index: number
  /** 生肖名 */
  name: string
  /** 地支 */
  branch: string
  /** 印章路径 */
  seal: string
  /** 段位称号（点亮后获得） */
  title: string
}

export const ZODIAC: ZodiacMeta[] = [
  { index: 0,  name: '鼠', branch: '子', seal: '/zodiac-01.svg', title: '子鼠 · 窥机' },
  { index: 1,  name: '牛', branch: '丑', seal: '/zodiac-02.svg', title: '丑牛 · 负重' },
  { index: 2,  name: '虎', branch: '寅', seal: '/zodiac-03.svg', title: '寅虎 · 啸林' },
  { index: 3,  name: '兔', branch: '卯', seal: '/zodiac-04.svg', title: '卯兔 · 三窟' },
  { index: 4,  name: '龙', branch: '辰', seal: '/zodiac-05.svg', title: '辰龙 · 腾渊' },
  { index: 5,  name: '蛇', branch: '巳', seal: '/zodiac-06.svg', title: '巳蛇 · 衔尾' },
  { index: 6,  name: '马', branch: '午', seal: '/zodiac-07.svg', title: '午马 · 追日' },
  { index: 7,  name: '羊', branch: '未', seal: '/zodiac-08.svg', title: '未羊 · 跪乳' },
  { index: 8,  name: '猴', branch: '申', seal: '/zodiac-09.svg', title: '申猴 · 捞月' },
  { index: 9,  name: '鸡', branch: '酉', seal: '/zodiac-10.svg', title: '酉鸡 · 司晨' },
  { index: 10, name: '狗', branch: '戌', seal: '/zodiac-11.svg', title: '戌狗 · 守夜' },
  { index: 11, name: '猪', branch: '亥', seal: '/zodiac-12.svg', title: '亥猪 · 藏锋' },
]

/** 点亮一枚生肖所需胜场 */
export const WINS_PER_ZODIAC = 3

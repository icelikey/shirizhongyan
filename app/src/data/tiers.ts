/**
 * 天地玄黄位阶数据 —— 世界 / 顶栏 / 天梯共用。
 * 升阶条件：四花色大陆各点亮满 12 生肖（见 store.profile.tryPromote）。
 */

export type Tier = 'huang' | 'xuan' | 'di' | 'tian'

export interface TierMeta {
  id: Tier | 'honghuang'
  /** 篆字 */
  char: string
  /** 位阶名 */
  name: string
  /** 色值 */
  color: string
  /** 质感描述 */
  texture: string
  /** 玉玺印章路径 */
  seal: string
  /** 位阶文案 */
  lore: string
}

export const TIERS: TierMeta[] = [
  {
    id: 'huang', char: '黄', name: '黄阶', color: '#E8C15A', texture: '黄铜哑光', seal: '/tier-huang.svg',
    lore: '初入牌局之间的旅人，皆以黄阶立身。',
  },
  {
    id: 'xuan', char: '玄', name: '玄阶', color: '#9B7FE8', texture: '紫晶微光', seal: '/tier-xuan.svg',
    lore: '四大陆生肖尽数点亮者，晋玄阶，窥见牌局之里的影子。',
  },
  {
    id: 'di', char: '地', name: '地阶', color: '#C98A4B', texture: '青铜锈纹', seal: '/tier-di.svg',
    lore: '地阶行者，言出即注，四座皆听。',
  },
  {
    id: 'tian', char: '天', name: '天阶', color: '#7FC8E8', texture: '天青琉光', seal: '/tier-tian.svg',
    lore: '天阶之上，十日亦需让路。',
  },
  {
    id: 'honghuang', char: '洪', name: '洪荒', color: 'linear-gradient(135deg,#F8E9C0,#EE6A72,#9B7FE8,#4ECB9C)', texture: '虹彩流动', seal: '/tier-honghuang.svg',
    lore: '传说之位。世界每十日终结，唯洪荒者可改写规则。',
  },
]

export const TIER_ORDER: Tier[] = ['huang', 'xuan', 'di', 'tian']

export const getTier = (id: Tier): TierMeta => TIERS.find((t) => t.id === id)!

/** 升阶所需：每花色大陆点亮的生肖数 */
export const ZODIAC_PER_SUIT_FOR_PROMOTE = 12

/**
 * 碎境爬塔 · 药水（spire-combat.md §1.5）
 * 6 种，药水栏 3 格（上限由 store/spire.ts MAX_POTIONS 控制）。
 * icon 为 lucide-react 图标名（由 UI 映射，非 emoji）。
 */
import type { PotionDef } from '@/data/spire/types'

export const POTIONS: PotionDef[] = [
  {
    id: 'jinchuang', name: '金疮药', icon: 'HeartPulse',
    desc: '回复 12 点生命。',
    effects: [{ kind: 'heal', value: 12 }],
  },
  {
    id: 'liejiu', name: '烈酒', icon: 'Wine',
    desc: '力量 +2。',
    effects: [{ kind: 'applyStatus', value: 2, status: 'strength' }],
  },
  {
    id: 'tiepi', name: '铁皮散', icon: 'Shield',
    desc: '获得 12 点格挡。',
    effects: [{ kind: 'block', value: 12 }],
  },
  {
    id: 'yanwu', name: '烟雾弹', icon: 'CloudFog',
    desc: '使一名敌人虚弱 3 层。',
    effects: [{ kind: 'applyStatus', value: 3, status: 'weak' }],
  },
  {
    id: 'dubiao', name: '毒镖', icon: 'Crosshair',
    desc: '使一名敌人中毒 5 层。',
    effects: [{ kind: 'applyStatus', value: 5, status: 'poison' }],
  },
  {
    id: 'ningshen', name: '凝神茶', icon: 'Coffee',
    desc: '抽 2 张牌，能量 +1。',
    effects: [{ kind: 'draw', value: 2 }, { kind: 'gainEnergy', value: 1 }],
  },
]

const POTION_MAP = new Map(POTIONS.map((p) => [p.id, p]))

export function hasPotion(id: string): boolean {
  return POTION_MAP.has(id)
}

export function getPotion(id: string): PotionDef {
  const def = POTION_MAP.get(id)
  if (!def) throw new Error(`unknown potion id: ${id}`)
  return def
}

/** 需要选择敌方目标的药水 */
export function potionNeedsTarget(id: string): boolean {
  return id === 'yanwu' || id === 'dubiao'
}

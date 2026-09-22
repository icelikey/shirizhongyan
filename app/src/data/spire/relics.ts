/**
 * 碎境爬塔 · 遗物（spire-combat.md §1.4）
 * 14 件：普通 5 / 罕见 6 / Boss 3。icon 为 lucide-react 图标名（由 UI 映射，非 emoji）。
 * 战斗内生效者由引擎按 id 在 switch 中结算；其余由地图页处理。
 */
import type { DeckStyle, RelicDef } from '@/data/spire/types'

export const RELICS: RelicDef[] = [
  // ---- 普通 ----
  { id: 'sundial-shard', name: '日晷残片', rarity: 'common', icon: 'Sun', desc: '每场战斗首回合能量 +1。' },
  { id: 'bronze-bell', name: '青铜铃', rarity: 'common', icon: 'Bell', desc: '每场战斗首回合多抽 2 张牌。' },
  { id: 'cinnabar-seal', name: '朱砂印', rarity: 'common', icon: 'Stamp', desc: '你的攻击牌伤害 +2。' },
  { id: 'tortoise-shell', name: '龟甲', rarity: 'common', icon: 'Shell', desc: '每场战斗开始时获得 8 点格挡。' },
  { id: 'wine-gourd', name: '酒葫芦', rarity: 'common', icon: 'Wine', desc: '休息时额外回复 10 点生命。（地图页生效）' },
  // ---- 罕见 ----
  { id: 'fragment-scroll', name: '残卷', rarity: 'uncommon', icon: 'ScrollText', desc: '每回合你打出的第一张技能牌费用 -1。' },
  { id: 'cornucopia', name: '聚宝盆', rarity: 'uncommon', icon: 'Coins', desc: '金币获取 +25%。' },
  { id: 'wolf-brush', name: '狼毫', rarity: 'uncommon', icon: 'Brush', desc: '诅咒与事件选项获得优待。（纯标记，地图页生效）' },
  { id: 'paper-doll', name: '替身纸人', rarity: 'uncommon', icon: 'PersonStanding', desc: '每场战斗免死一次，以 1 点生命存活（Boss 战无效）。' },
  { id: 'beacon-tower', name: '烽火台', rarity: 'uncommon', icon: 'TowerControl', desc: '看见精英敌人的意图详情。' },
  { id: 'abacus', name: '算盘', rarity: 'uncommon', icon: 'Calculator', desc: '每打出 3 张牌，抽 1 张牌。' },
  // ---- Boss ----
  { id: 'heart-mirror', name: '护心镜', rarity: 'boss', icon: 'ShieldHalf', desc: '每场战斗第一次受击伤害减半。' },
  { id: 'incense', name: '燃香', rarity: 'boss', icon: 'FlameKindling', desc: '每回合开始时灼烧全体敌人 1 层。' },
  { id: 'shore-shoes', name: '登岸草鞋', rarity: 'boss', icon: 'Footprints', desc: '在地图上每走过 3 个节点，回复 3 点生命。（地图页生效）' },
]

const RELIC_MAP = new Map(RELICS.map((r) => [r.id, r]))

export function hasRelic(id: string): boolean {
  return RELIC_MAP.has(id)
}

export function getRelic(id: string): RelicDef {
  const def = RELIC_MAP.get(id)
  if (!def) throw new Error(`unknown relic id: ${id}`)
  return def
}

/** 三风格起始遗物（与 SpireHub 契约影从对应） */
export const STARTER_RELICS: Record<DeckStyle, string> = {
  blade: 'cinnabar-seal',
  bulwark: 'tortoise-shell',
  trick: 'bronze-bell',
}

export const COMMON_RELIC_IDS = RELICS.filter((r) => r.rarity === 'common').map((r) => r.id)
export const UNCOMMON_RELIC_IDS = RELICS.filter((r) => r.rarity === 'uncommon').map((r) => r.id)
export const BOSS_RELIC_IDS = RELICS.filter((r) => r.rarity === 'boss').map((r) => r.id)

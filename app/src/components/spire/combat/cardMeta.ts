/**
 * 战斗 UI 元数据：卡牌三色系归类 / 状态层展示 / 遗物·药水图标映射（lucide，非 emoji）。
 */
import type { CardRarity, StatusId } from '@/data/spire/types'

// ---------------------------------------------------------- 三色系（spire-combat.md §1.3）
export type CardFamily = 'blade' | 'bulwark' | 'trick'

const BLADE_IDS = new Set(['moye', 'lianhuan', 'pojia', 'jieli', 'xueji', 'zhongjie', 'luanpifeng', 'xuanfeng'])
const BULWARK_IDS = new Set(['jinzhong', 'tiebu', 'shouwei', 'panshi', 'huixiang', 'yufeng'])

export function familyOf(cardId: string): CardFamily {
  if (BLADE_IDS.has(cardId)) return 'blade'
  if (BULWARK_IDS.has(cardId)) return 'bulwark'
  return 'trick'
}

export const FAMILY_META: Record<CardFamily, { label: string; color: string; glow: string }> = {
  blade: { label: '刃', color: '#EE6A72', glow: 'rgba(238,106,114,.35)' },
  bulwark: { label: '壁垒', color: '#E3C27C', glow: 'rgba(227,194,124,.35)' },
  trick: { label: '诡道', color: '#9B7FE8', glow: 'rgba(155,127,232,.35)' },
}

// ---------------------------------------------------------- 稀有度边框
export const RARITY_META: Record<CardRarity, { label: string; border: string; glow?: string }> = {
  common: { label: '普通', border: 'rgba(227,194,124,.18)' },
  uncommon: { label: '罕见', border: 'rgba(227,194,124,.45)' },
  rare: { label: '稀有', border: 'rgba(246,227,180,.7)', glow: '0 0 18px rgba(227,194,124,.35)' },
  curse: { label: '诅咒', border: 'rgba(216,68,60,.6)', glow: '0 0 14px rgba(216,68,60,.3)' },
}

// ---------------------------------------------------------- 状态层
export const STATUS_META: Record<StatusId, { name: string; color: string; desc: string }> = {
  strength: { name: '力量', color: '#F0655A', desc: '攻击伤害 +N（永久叠层）' },
  dexterity: { name: '敏捷', color: '#4ECB9C', desc: '获得格挡 +N（永久叠层）' },
  vulnerable: { name: '易伤', color: '#F2A93B', desc: '受到攻击伤害 +50%，每回合 -1 层' },
  weak: { name: '虚弱', color: '#8B93F8', desc: '造成攻击伤害 -25%，每回合 -1 层' },
  poison: { name: '中毒', color: '#7FE87F', desc: '回合开始受 N 伤，层数 -1' },
  burn: { name: '灼烧', color: '#F08A3C', desc: '回合结束受 2 伤，层数 -1' },
}

export const CARD_TYPE_LABEL: Record<string, string> = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
}

/**
 * 丹丘牌楼 · 词条池（poker.md §1.1）——24 条，四类各六条。
 * 词条永久附着在 52 张牌上（0–2 条/张），跨局保留（pokerStore persist）。
 * 引擎按 trigger 结算：
 *  - onPlay    打出该牌时结算（计分修正 / 打出后效果）
 *  - inHand    该牌停留在手牌时持续/触发
 *  - onDiscard 弃牌动作包含该牌时结算
 */

export type AffixKind = 'attack' | 'defense' | 'scheme' | 'luck'
export type AffixTrigger = 'onPlay' | 'inHand' | 'onDiscard'

export interface AffixDef {
  id: string
  name: string
  kind: AffixKind
  trigger: AffixTrigger
  desc: string
  /** 数值载荷（筹码/倍率×10/概率%/HP/币，按 effect 语义解释） */
  value: number
  /** 引擎结算键 */
  effect: AffixEffect
}

export type AffixEffect =
  // 攻
  | 'chips_flat'        // 打出时筹码 +value
  | 'mult_if_spade'     // 该牌为 ♠ 时倍率 +value/10
  | 'draw_on_play'      // 打出后抽 value 张
  | 'chips_if_pair_up'  // 牌型为对子以上额外筹码 +value
  | 'mult_if_face'      // 该牌为 J/Q/K 时倍率 +value/10
  // 守
  | 'bet_reduce_inhand' // 在手牌时对手压注 -value（可叠）
  | 'ward_on_play'      // 打出后本场减伤 value
  | 'heal_on_play'      // 打出后回 value HP
  | 'extra_play_inhand' // 在手牌时出牌数 +value（一局一次）
  | 'refund_discard'    // 弃牌时若含此牌多得 value 次弃牌机会
  | 'immune_big_bet'    // 在手牌时免疫一次大额压注（≥value）
  // 谋
  | 'mult_if_flush'     // 牌型含同花则倍率 +value/10
  | 'chips_if_straight' // 含顺子则筹码 +value
  | 'draw_if_five'      // 打出 5 张则额外抽 value 张
  | 'halve_next_bet'    // 对手下次压注减半
  | 'chips_mul_if_ace'  // 含 A 则筹码 ×value/100
  | 'pair_value_double' // 含对子则该对子面值 ×2 计
  // 运
  | 'copy_on_play'      // 打出后 value% 复制回手牌
  | 'coins_on_play'     // 打出后 value% 得 5 人心币（概率为 value，币固定 5）
  | 'nullify_bet'       // 打出后 value% 免对手本次压注
  | 'first_play_chips'  // 每局首次打出筹码 +value
  | 'mult_if_no_discard'// 若本场未用弃牌则倍率 +value/10
  | 'buff_random_hand'  // 打出后随机一张手牌临时 +value 筹码

export const AFFIX_KIND_META: Record<AffixKind, { name: string; color: string; glyph: string }> = {
  attack:  { name: '攻', color: '#EE6A72', glyph: '刃' },
  defense: { name: '守', color: '#4ECB9C', glyph: '垣' },
  scheme:  { name: '谋', color: '#8B93F8', glyph: '筹' },
  luck:    { name: '运', color: '#F2A93B', glyph: '骰' },
}

export const AFFIXES: AffixDef[] = [
  // ── 攻（朱红）────────────────────────────
  { id: 'atk-chips8',    name: '朱批',   kind: 'attack', trigger: 'onPlay', effect: 'chips_flat',       value: 8,  desc: '打出时：筹码 +8' },
  { id: 'atk-chips15',   name: '裂帛',   kind: 'attack', trigger: 'onPlay', effect: 'chips_flat',       value: 15, desc: '打出时：筹码 +15' },
  { id: 'atk-spade',     name: '玄锋',   kind: 'attack', trigger: 'onPlay', effect: 'mult_if_spade',    value: 10, desc: '打出时：若该牌为 ♠，倍率 +1' },
  { id: 'atk-draw',      name: '连珠',   kind: 'attack', trigger: 'onPlay', effect: 'draw_on_play',     value: 1,  desc: '打出后：抽 1 张牌' },
  { id: 'atk-pairup',    name: '成双',   kind: 'attack', trigger: 'onPlay', effect: 'chips_if_pair_up', value: 20, desc: '打出时：若组成对子以上牌型，额外筹码 +20' },
  { id: 'atk-face',      name: '冠冕',   kind: 'attack', trigger: 'onPlay', effect: 'mult_if_face',     value: 5,  desc: '打出时：若该牌为 J/Q/K，倍率 +0.5' },
  // ── 守（青玉）────────────────────────────
  { id: 'def-betdown',   name: '示弱',   kind: 'defense', trigger: 'inHand', effect: 'bet_reduce_inhand', value: 1,  desc: '在手牌时：对手压注 -1（可叠加）' },
  { id: 'def-ward',      name: '结界',   kind: 'defense', trigger: 'onPlay', effect: 'ward_on_play',    value: 2,  desc: '打出后：本场对决减伤 2' },
  { id: 'def-heal',      name: '回春',   kind: 'defense', trigger: 'onPlay', effect: 'heal_on_play',    value: 2,  desc: '打出后：回复 2 HP' },
  { id: 'def-extraplay', name: '续命',   kind: 'defense', trigger: 'inHand', effect: 'extra_play_inhand', value: 1, desc: '在手牌时：出牌次数 +1（每局一次）' },
  { id: 'def-refund',    name: '回袖',   kind: 'defense', trigger: 'onDiscard', effect: 'refund_discard', value: 1, desc: '弃牌时：若含此牌，多得 1 次弃牌机会' },
  { id: 'def-immune',    name: '不动',   kind: 'defense', trigger: 'inHand', effect: 'immune_big_bet',  value: 10, desc: '在手牌时：免疫一次大额压注（≥10）' },
  // ── 谋（靛紫）────────────────────────────
  { id: 'sch-flush',     name: '染墨',   kind: 'scheme', trigger: 'onPlay', effect: 'mult_if_flush',     value: 10,  desc: '打出时：若牌型含同花，倍率 +1' },
  { id: 'sch-straight',  name: '连环',   kind: 'scheme', trigger: 'onPlay', effect: 'chips_if_straight', value: 25,  desc: '打出时：若牌型含顺子，筹码 +25' },
  { id: 'sch-five',      name: '满势',   kind: 'scheme', trigger: 'onPlay', effect: 'draw_if_five',      value: 1,   desc: '打出时：若打出 5 张，额外抽 1 张' },
  { id: 'sch-halve',     name: '攻心',   kind: 'scheme', trigger: 'onPlay', effect: 'halve_next_bet',    value: 50,  desc: '打出后：对手下次压注减半' },
  { id: 'sch-ace',       name: '执牛耳', kind: 'scheme', trigger: 'onPlay', effect: 'chips_mul_if_ace',  value: 120, desc: '打出时：若牌型含 A，筹码 ×1.2' },
  { id: 'sch-pairface',  name: '对影',   kind: 'scheme', trigger: 'onPlay', effect: 'pair_value_double', value: 2,   desc: '打出时：若含对子，该对子面值 ×2 计入筹码' },
  // ── 运（琥珀）────────────────────────────
  { id: 'lck-copy',      name: '回魂',   kind: 'luck', trigger: 'onPlay', effect: 'copy_on_play',      value: 25, desc: '打出后：25% 概率复制该牌回手牌' },
  { id: 'lck-coins',     name: '横财',   kind: 'luck', trigger: 'onPlay', effect: 'coins_on_play',     value: 15, desc: '打出后：15% 概率得 5 人心币' },
  { id: 'lck-nullify',   name: '空门',   kind: 'luck', trigger: 'onPlay', effect: 'nullify_bet',       value: 10, desc: '打出后：10% 概率免对手本次压注' },
  { id: 'lck-first',     name: '开门彩', kind: 'luck', trigger: 'onPlay', effect: 'first_play_chips',  value: 30, desc: '每局首次打出：筹码 +30' },
  { id: 'lck-nodiscard', name: '沉住气', kind: 'luck', trigger: 'onPlay', effect: 'mult_if_no_discard', value: 5, desc: '打出时：若本场未使用弃牌，倍率 +0.5' },
  { id: 'lck-buffhand',  name: '点金',   kind: 'luck', trigger: 'onPlay', effect: 'buff_random_hand',  value: 8,  desc: '打出后：随机一张手牌临时 +8 筹码' },
]

export const AFFIX_MAP: Record<string, AffixDef> = Object.fromEntries(AFFIXES.map((a) => [a.id, a]))

export function getAffix(id: string): AffixDef {
  const a = AFFIX_MAP[id]
  if (!a) throw new Error(`unknown affix: ${id}`)
  return a
}

/** 词条品质倾向：祭坛重摇/注灵/初始分配共用的随机池（简单均匀） */
export function randomAffixId(rng: () => number, exclude: string[] = []): string {
  const pool = AFFIXES.filter((a) => !exclude.includes(a.id))
  return pool[Math.floor(rng() * pool.length)].id
}

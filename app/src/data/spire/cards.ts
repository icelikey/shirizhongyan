/**
 * 碎境爬塔 · 卡牌数据（spire-combat.md §1.3）
 * 30 张可收集卡 + 诅咒牌「业债」（CURSE_CARD_ID）。
 * 三色系仅作 UI 边框归类：刃=攻击红 / 壁垒=防御金 / 诡道=策略紫。
 * 升级版在牌库中以 '+id' 存储（见 store/spire.ts）。
 */
import type { CardDef, DeckStyle } from '@/data/spire/types'
import { CURSE_CARD_ID } from '@/data/spire/types'

export const CARDS: CardDef[] = [
  // ============ 刃（攻击红） ============
  {
    id: 'moye', name: '墨刃', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'damage', value: 6 }],
    art: '/card-art-blade.png', desc: '造成 6 点伤害。墨落之处，刃已至。',
    upgraded: { effects: [{ kind: 'damage', value: 9 }], desc: '造成 9 点伤害。墨落之处，刃已至。' },
  },
  {
    id: 'lianhuan', name: '连环刃', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'damage', value: 4, times: 2 }],
    art: '/card-art-flurry.png', desc: '造成 4 点伤害 2 次。环环相扣，密不透风。',
    upgraded: { effects: [{ kind: 'damage', value: 5, times: 2 }], desc: '造成 5 点伤害 2 次。环环相扣，密不透风。' },
  },
  {
    id: 'pojia', name: '破甲斩', cost: 2, type: 'attack', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'damage', value: 8 }, { kind: 'applyStatus', value: 2, status: 'vulnerable' }],
    art: '/card-art-pierce.png', desc: '造成 8 点伤害，施加 2 层易伤。甲破之处，再无遮拦。',
    upgraded: { effects: [{ kind: 'damage', value: 11 }, { kind: 'applyStatus', value: 2, status: 'vulnerable' }], desc: '造成 11 点伤害，施加 2 层易伤。' },
  },
  {
    id: 'jieli', name: '借力打力', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'damage', value: 0 }],
    art: '/card-art-pierce.png', desc: '造成等同于你当前格挡值的伤害。他强由他强，清风拂山岗。',
    upgraded: { cost: 0, effects: [{ kind: 'damage', value: 0 }], desc: '造成等同于你当前格挡值的伤害。' },
  },
  {
    id: 'xueji', name: '血祭刀', cost: 1, type: 'attack', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'selfDamage', value: 3 }, { kind: 'damage', value: 14 }],
    art: '/card-art-pierce.png', desc: '自损 3 点生命，造成 14 点伤害。以血饲刃，刃必饮血。',
    upgraded: { effects: [{ kind: 'selfDamage', value: 3 }, { kind: 'damage', value: 17 }], desc: '自损 3 点生命，造成 17 点伤害。' },
  },
  {
    id: 'zhongjie', name: '终结式', cost: 2, type: 'attack', rarity: 'rare', target: 'enemy',
    effects: [{ kind: 'damage', value: 10 }, { kind: 'executeThreshold', value: 8 }],
    art: '/card-art-pierce.png', desc: '造成 10 点伤害；若敌方生命低于 50%，改为共造成 18 点。终焉一式，不留余地。',
    upgraded: { effects: [{ kind: 'damage', value: 13 }, { kind: 'executeThreshold', value: 8 }], desc: '造成 13 点伤害；若敌方生命低于 50%，改为共造成 21 点。' },
  },
  {
    id: 'luanpifeng', name: '乱披风', cost: 1, type: 'attack', rarity: 'uncommon', target: 'none',
    effects: [{ kind: 'randomMultiDamage', value: 3, times: 3 }],
    art: '/card-art-flurry.png', desc: '随机对敌方造成 3 点伤害 3 次。刀光乱披，敌我不辨。',
    upgraded: { effects: [{ kind: 'randomMultiDamage', value: 4, times: 3 }], desc: '随机对敌方造成 4 点伤害 3 次。' },
  },
  {
    id: 'xuanfeng', name: '旋风斩', cost: 1, type: 'attack', rarity: 'uncommon', target: 'allEnemies',
    effects: [{ kind: 'damageAll', value: 4 }],
    art: '/card-art-flurry.png', desc: '对全体敌人造成 4 点伤害。风卷残云，无一幸免。',
    upgraded: { effects: [{ kind: 'damageAll', value: 7 }], desc: '对全体敌人造成 7 点伤害。' },
  },
  // ============ 壁垒（防御金） ============
  {
    id: 'jinzhong', name: '金钟罩', cost: 1, type: 'skill', rarity: 'common', target: 'self',
    effects: [{ kind: 'block', value: 5 }],
    art: '/card-art-shield.png', desc: '获得 5 点格挡。钟声一响，刀枪不入。',
    upgraded: { effects: [{ kind: 'block', value: 8 }], desc: '获得 8 点格挡。钟声一响，刀枪不入。' },
  },
  {
    id: 'tiebu', name: '铁布衫', cost: 2, type: 'skill', rarity: 'common', target: 'self',
    effects: [{ kind: 'block', value: 8 }],
    art: '/card-art-iron.png', desc: '获得 8 点格挡。铁衣裹身，岿然不动。',
    upgraded: { effects: [{ kind: 'block', value: 11 }], desc: '获得 11 点格挡。铁衣裹身，岿然不动。' },
  },
  {
    id: 'shouwei', name: '以守为攻', cost: 1, type: 'attack', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'block', value: 5 }, { kind: 'damage', value: 5 }],
    art: '/card-art-iron.png', desc: '获得 5 点格挡，造成 5 点伤害。守中有攻，攻守易形。',
    upgraded: { effects: [{ kind: 'block', value: 8 }, { kind: 'damage', value: 8 }], desc: '获得 8 点格挡，造成 8 点伤害。' },
  },
  {
    id: 'panshi', name: '磐石', cost: 2, type: 'skill', rarity: 'uncommon', target: 'self',
    effects: [{ kind: 'block', value: 12 }, { kind: 'applyStatus', value: 1, status: 'weak' }],
    art: '/card-art-shield.png', desc: '获得 12 点格挡，自身虚弱 1 回合。磐石无转移，亦难转圜。',
    upgraded: { effects: [{ kind: 'block', value: 15 }, { kind: 'applyStatus', value: 1, status: 'weak' }], desc: '获得 15 点格挡，自身虚弱 1 回合。' },
  },
  {
    id: 'huixiang', name: '回响盾', cost: 1, type: 'skill', rarity: 'uncommon', target: 'self',
    effects: [{ kind: 'block', value: 6 }, { kind: 'blockNextTurn', value: 6 }],
    art: '/card-art-shield.png', desc: '获得 6 点格挡，下回合再获得 6 点格挡。盾声回响，余韵不绝。',
    upgraded: { effects: [{ kind: 'block', value: 9 }, { kind: 'blockNextTurn', value: 6 }], desc: '获得 9 点格挡，下回合再获得 6 点格挡。' },
  },
  {
    id: 'yufeng', name: '御风', cost: 1, type: 'skill', rarity: 'uncommon', target: 'self',
    effects: [{ kind: 'block', value: 4 }, { kind: 'applyStatus', value: 1, status: 'dexterity' }],
    art: '/card-art-iron.png', desc: '获得 4 点格挡，敏捷 +1。御风而行，身法愈巧。',
    upgraded: { effects: [{ kind: 'block', value: 7 }, { kind: 'applyStatus', value: 1, status: 'dexterity' }], desc: '获得 7 点格挡，敏捷 +1。' },
  },
  // ============ 诡道（策略紫） ============
  {
    id: 'guanxing', name: '观星', cost: 0, type: 'skill', rarity: 'common', target: 'none',
    effects: [{ kind: 'draw', value: 2 }],
    art: '/card-art-stargaze.png', desc: '抽 2 张牌。夜观星象，已知天命。',
    upgraded: { effects: [{ kind: 'draw', value: 3 }], desc: '抽 3 张牌。夜观星象，已知天命。' },
  },
  {
    id: 'xipai', name: '洗牌', cost: 0, type: 'skill', rarity: 'common', target: 'none',
    effects: [{ kind: 'discardHandDraw', value: 0 }],
    art: '/card-art-emptyfort.png', desc: '弃掉全部手牌，抽等量牌。牌局重洗，乾坤再定。',
    upgraded: { effects: [{ kind: 'discardHandDraw', value: 0 }, { kind: 'draw', value: 1 }], desc: '弃掉全部手牌，抽等量 +1 张牌。' },
  },
  {
    id: 'jiedao', name: '借刀杀人', cost: 2, type: 'skill', rarity: 'rare', target: 'enemy',
    effects: [{ kind: 'damage', value: 50 }],
    art: '/card-art-scheme.png', desc: '令目标敌人以自身攻击值的 50% 攻击自己。刀不必在我手。',
    upgraded: { effects: [{ kind: 'damage', value: 70 }], desc: '令目标敌人以自身攻击值的 70% 攻击自己。' },
  },
  {
    id: 'lianhuanji', name: '连环计', cost: 1, type: 'skill', rarity: 'uncommon', target: 'none',
    effects: [{ kind: 'doubleNextAttack', value: 1 }],
    art: '/card-art-scheme.png', desc: '你打出的下一张攻击牌结算两次。计中藏计，环环相扣。',
    upgraded: { cost: 0, effects: [{ kind: 'doubleNextAttack', value: 1 }], desc: '你打出的下一张攻击牌结算两次。' },
  },
  {
    id: 'fudi', name: '釜底抽薪', cost: 1, type: 'skill', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'reduceEnemyStrength', value: 4 }, { kind: 'draw', value: 1 }],
    art: '/card-art-scheme.png', desc: '目标敌人失去 4 点力量 1 回合，抽 1 张牌。薪尽则火灭。',
    upgraded: { effects: [{ kind: 'reduceEnemyStrength', value: 6 }, { kind: 'draw', value: 1 }], desc: '目标敌人失去 6 点力量 1 回合，抽 1 张牌。' },
  },
  {
    id: 'duji', name: '毒计', cost: 1, type: 'skill', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'applyStatus', value: 4, status: 'poison' }],
    art: '/card-art-poison.png', desc: '施加 4 层中毒。鸩酒入喉，七日断肠。',
    upgraded: { effects: [{ kind: 'applyStatus', value: 7, status: 'poison' }], desc: '施加 7 层中毒。鸩酒入喉，七日断肠。' },
  },
  {
    id: 'huogong', name: '火攻', cost: 1, type: 'skill', rarity: 'common', target: 'enemy',
    effects: [{ kind: 'applyStatus', value: 4, status: 'burn' }],
    art: '/card-art-fire.png', desc: '施加 4 层灼烧。东风已起，火烧连营。',
    upgraded: { effects: [{ kind: 'applyStatus', value: 7, status: 'burn' }], desc: '施加 7 层灼烧。东风已起，火烧连营。' },
  },
  {
    id: 'kongcheng', name: '空城计', cost: 2, type: 'skill', rarity: 'rare', target: 'self', exhaust: true,
    effects: [{ kind: 'invulnerable', value: 1 }],
    art: '/card-art-emptyfort.png', desc: '本回合无敌。消耗。城门大开，琴声自若。',
    upgraded: { cost: 1, effects: [{ kind: 'invulnerable', value: 1 }], desc: '本回合无敌。消耗。城门大开，琴声自若。' },
  },
  {
    id: 'zouweishang', name: '走为上', cost: 0, type: 'skill', rarity: 'uncommon', target: 'none', exhaust: true,
    effects: [{ kind: 'draw', value: 3 }, { kind: 'gainEnergy', value: 1 }],
    art: '/card-art-escape.png', desc: '抽 3 张牌，能量 +1。消耗。三十六计，走为上计。',
    upgraded: { effects: [{ kind: 'draw', value: 4 }, { kind: 'gainEnergy', value: 1 }], desc: '抽 4 张牌，能量 +1。消耗。' },
  },
  {
    id: 'lidaitaojiang', name: '李代桃僵', cost: 1, type: 'skill', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'block', value: 0 }],
    art: '/card-art-escape.png', desc: '获得等同于目标敌人下回合攻击值的格挡。桃僵李代，以彼之道。',
    upgraded: { cost: 0, effects: [{ kind: 'block', value: 0 }], desc: '获得等同于目标敌人下回合攻击值的格挡。' },
  },
  {
    id: 'zhisang', name: '指桑骂槐', cost: 1, type: 'skill', rarity: 'uncommon', target: 'allEnemies',
    effects: [{ kind: 'applyStatus', value: 2, status: 'weak' }],
    art: '/card-art-scheme.png', desc: '全体敌人虚弱 2 层。指桑之辞，骂在槐心。',
    upgraded: { effects: [{ kind: 'applyStatus', value: 3, status: 'weak' }], desc: '全体敌人虚弱 3 层。' },
  },
  {
    id: 'andu', name: '暗度陈仓', cost: 1, type: 'skill', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'damage', value: 4 }, { kind: 'draw', value: 1 }, { kind: 'gainEnergy', value: 1 }],
    art: '/card-art-escape.png', desc: '造成 4 点伤害，抽 1 张牌，能量 +1。明修栈道，暗度陈仓。',
    upgraded: { effects: [{ kind: 'damage', value: 7 }, { kind: 'draw', value: 1 }, { kind: 'gainEnergy', value: 1 }], desc: '造成 7 点伤害，抽 1 张牌，能量 +1。' },
  },
  {
    id: 'fanjian', name: '反间计', cost: 1, type: 'skill', rarity: 'uncommon', target: 'enemy',
    effects: [{ kind: 'applyStatus', value: 2, status: 'weak' }, { kind: 'applyStatus', value: 1, status: 'vulnerable' }],
    art: '/card-art-scheme.png', desc: '施加 2 层虚弱与 1 层易伤。疑心生暗鬼，反间乱敌心。',
    upgraded: { effects: [{ kind: 'applyStatus', value: 3, status: 'weak' }, { kind: 'applyStatus', value: 1, status: 'vulnerable' }], desc: '施加 3 层虚弱与 1 层易伤。' },
  },
  // ============ 能力牌（Power） ============
  {
    id: 'zhanyi', name: '战意', cost: 1, type: 'power', rarity: 'rare', target: 'self',
    effects: [],
    art: '/card-art-power.png', desc: '能力：每回合开始时力量 +1。战意如火，愈战愈烈。',
    upgraded: { effects: [{ kind: 'applyStatus', value: 1, status: 'strength' }], desc: '能力：每回合开始时力量 +1。打出时立刻力量 +1。' },
  },
  {
    id: 'guixi', name: '龟息', cost: 1, type: 'power', rarity: 'rare', target: 'self',
    effects: [],
    art: '/card-art-power.png', desc: '能力：每回合开始时获得 4 点格挡。龟息凝神，不动如山。',
    upgraded: { effects: [{ kind: 'block', value: 6 }], desc: '能力：每回合开始时获得 4 点格挡。打出时立刻获得 6 点格挡。' },
  },
  {
    id: 'xingpan', name: '星盘', cost: 2, type: 'power', rarity: 'rare', target: 'self',
    effects: [],
    art: '/card-art-stargaze.png', desc: '能力：每回合多抽 1 张牌。星盘一转，天机尽览。',
    upgraded: { cost: 1, effects: [], desc: '能力：每回合多抽 1 张牌。星盘一转，天机尽览。' },
  },
  // ============ 诅咒 ============
  {
    id: CURSE_CARD_ID, name: '业债', cost: 0, type: 'skill', rarity: 'curse', target: 'none',
    effects: [],
    art: '/card-art-poison.png', desc: '无法打出。终焉的业债，牌组中洗不去的污点。',
    upgraded: { effects: [], desc: '无法打出。终焉的业债，牌组中洗不去的污点。' },
  },
]

const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]))

/** 去掉牌库 id 的升级前缀 '+' */
export function baseCardId(id: string): string {
  return id.startsWith('+') ? id.slice(1) : id
}

export function isUpgradedId(id: string): boolean {
  return id.startsWith('+')
}

export function hasCard(id: string): boolean {
  return CARD_MAP.has(baseCardId(id))
}

export function getCard(id: string): CardDef {
  const def = CARD_MAP.get(baseCardId(id))
  if (!def) throw new Error(`unknown card id: ${id}`)
  return def
}

/** 三风格起始牌组（spire-combat.md §1.3） */
export const STARTER_DECKS: Record<DeckStyle, string[]> = {
  blade: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'lianhuan', 'pojia'],
  bulwark: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'tiebu', 'shouwei'],
  trick: ['moye', 'moye', 'moye', 'moye', 'jinzhong', 'jinzhong', 'jinzhong', 'jinzhong', 'guanxing', 'duji'],
}

/** 奖励掉落池（不含诅咒），按稀有度分组 */
export const CARD_POOL_BY_RARITY = {
  common: CARDS.filter((c) => c.rarity === 'common').map((c) => c.id),
  uncommon: CARDS.filter((c) => c.rarity === 'uncommon').map((c) => c.id),
  rare: CARDS.filter((c) => c.rarity === 'rare').map((c) => c.id),
} as const

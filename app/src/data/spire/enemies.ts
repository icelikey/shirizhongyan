/**
 * 碎境爬塔 · 敌人名册（spire-combat.md §1.6）
 * 8 普通 + 3 精英 + 3 Boss + 1 召唤物（小伥鬼，复用纸人立绘）。
 * 数值基准：普通 HP 24–42 攻 5–11；精英 HP 56–80 攻 9–16；Boss HP 120–180 多阶段。
 */
import type { EnemyDef } from '@/data/spire/types'

export const ENEMIES: EnemyDef[] = [
  // ============ 普通 ============
  {
    id: 'zhiren', name: '纸人斥候', art: '/enemy-zhiren.png', hp: [24, 28], tier: 'normal',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 5, weight: 3, label: '纸刃' },
      { kind: 'debuff', value: 0, status: 'weak', statusValue: 1, weight: 2, label: '纸缚' },
      { kind: 'attack', value: 7, weight: 3, label: '碎纸斩' },
    ],
    quote: '一纸一世界，一剪一轮回。',
  },
  {
    id: 'dashou', name: '赌坊打手', art: '/enemy-dashou.png', hp: [32, 38], tier: 'normal',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 8, weight: 3, label: '铁拳' },
      { kind: 'block', value: 6, weight: 2, label: '护住钱袋' },
      { kind: 'attack', value: 10, weight: 3, label: '讨债重击' },
    ],
    quote: '欠债还钱，天经地义！',
  },
  {
    id: 'shanxiao', name: '山魈', art: '/enemy-shanxiao.png', hp: [36, 42], tier: 'normal',
    floors: [1, 2, 3], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 9, weight: 3, label: '撕抓' },
      { kind: 'attackMulti', value: 3, times: 2, weight: 2, label: '连爪' },
      { kind: 'buff', value: 0, status: 'strength', statusValue: 2, weight: 1, label: '山啸' },
    ],
    quote: '山中无日月，唯有饿与杀。',
  },
  {
    id: 'daoshu', name: '盗宝鼠', art: '/enemy-daoshu.png', hp: [24, 30], tier: 'normal',
    floors: [1, 2, 3], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 6, weight: 3, label: '啮咬' },
      { kind: 'debuff', value: 0, status: 'vulnerable', statusValue: 1, weight: 2, label: '撒沙迷眼' },
      { kind: 'block', value: 8, weight: 1, label: '蜷缩' },
    ],
    quote: '吱——宝贝都是我的！',
  },
  {
    id: 'youhun', name: '迷雾幽魂', art: '/enemy-youhun.png', hp: [28, 34], tier: 'normal',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'debuff', value: 0, status: 'weak', statusValue: 2, weight: 2, label: '迷雾侵蚀' },
      { kind: 'attack', value: 7, weight: 3, label: '幽魂触手' },
      { kind: 'attack', value: 5, weight: 2, label: '寒息' },
    ],
    quote: '雾起时，归路已断。',
  },
  {
    id: 'kuilei', name: '金甲傀儡', art: '/enemy-kuilei.png', hp: [38, 42], tier: 'normal',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'block', value: 10, weight: 2, label: '金甲合拢' },
      { kind: 'attack', value: 9, weight: 3, label: '重拳' },
      { kind: 'attackMulti', value: 6, times: 2, weight: 2, label: '机关连打' },
    ],
    quote: '（齿轮转动的嗡鸣）',
  },
  {
    id: 'shadao', name: '沙盗', art: '/enemy-shadao.png', hp: [30, 36], tier: 'normal',
    floors: [1, 2, 3], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 8, weight: 3, label: '弯刀' },
      { kind: 'attack', value: 5, status: 'poison', statusValue: 2, weight: 2, label: '淬毒沙刃' },
      { kind: 'debuff', value: 0, status: 'weak', statusValue: 1, weight: 1, label: '扬沙' },
    ],
    quote: '这片沙海，埋过不少旅人。',
  },
  {
    id: 'zhuyao', name: '烛火妖', art: '/enemy-zhuyao.png', hp: [26, 32], tier: 'normal',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 6, status: 'burn', statusValue: 2, weight: 3, label: '烛泪灼心' },
      { kind: 'attack', value: 9, weight: 3, label: '焰尾扫' },
      { kind: 'block', value: 5, weight: 1, label: '火苗收敛' },
    ],
    quote: '借火而行的人，终将被火收藏。',
  },
  // ============ 精英 ============
  {
    id: 'panguan', name: '牌九判官', art: '/elite-panguan.png', hp: [64, 72], tier: 'elite',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 12, weight: 3, label: '判官笔' },
      { kind: 'debuff', value: 0, status: 'vulnerable', statusValue: 2, weight: 2, label: '定罪' },
      { kind: 'attackMulti', value: 4, times: 3, weight: 3, label: '牌九连珠' },
      { kind: 'buff', value: 0, status: 'strength', statusValue: 2, weight: 1, label: '加注' },
    ],
    quote: '牌九一翻，是非立判。',
  },
  {
    id: 'cike', name: '玄渊刺客', art: '/elite-cike.png', hp: [56, 64], tier: 'elite',
    floors: [1, 2, 3], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 11, weight: 3, label: '背刺' },
      { kind: 'attackMulti', value: 7, times: 2, weight: 2, label: '双刃' },
      { kind: 'debuff', value: 0, status: 'weak', statusValue: 2, weight: 1, label: '封喉雾' },
      { kind: 'buff', value: 0, status: 'strength', statusValue: 3, weight: 1, label: '潜行蓄力' },
    ],
    quote: '玄渊之下，无名无姓。',
  },
  {
    id: 'aoshou', name: '守金鳌', art: '/elite-aoshou.png', hp: [72, 80], tier: 'elite',
    floors: [1, 2, 3], pattern: 'cycle',
    moves: [
      { kind: 'block', value: 14, weight: 2, label: '金壳御守' },
      { kind: 'attack', value: 13, weight: 3, label: '鳌钳碎金' },
      { kind: 'attack', value: 9, status: 'vulnerable', statusValue: 1, weight: 2, label: '震地' },
    ],
    quote: '金山在背，寸土不让。',
  },
  // ============ Boss ============
  {
    id: 'taowu', name: '守关兽·梼杌', art: '/boss-taowu.png', hp: [124, 140], tier: 'boss',
    floors: [1], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 12, weight: 3, label: '梼杌裂地' },
      { kind: 'summon', value: 1, summonId: 'xiaochang', weight: 2, label: '召唤伥鬼' },
      { kind: 'attackMulti', value: 8, times: 2, weight: 3, label: '乱牙' },
    ],
    quote: '顽石之子，守此碎境千载。',
    phaseTwo: {
      threshold: 0.5,
      moves: [
        { kind: 'attack', value: 16, weight: 3, label: '碎境之怒' },
        { kind: 'attackMulti', value: 9, times: 2, weight: 3, label: '噬魂乱牙' },
        { kind: 'buff', value: 0, status: 'strength', statusValue: 3, weight: 1, label: '凶性大发' },
        { kind: 'summon', value: 1, summonId: 'xiaochang', weight: 1, label: '召唤伥鬼' },
      ],
      quote: '吼——碎境既碎，尔等亦碎！',
    },
  },
  {
    id: 'qianmian', name: '千面狐', art: '/boss-qianmian.png', hp: [132, 150], tier: 'boss',
    floors: [2], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 11, weight: 3, label: '狐火弹' },
      { kind: 'debuff', value: 0, status: 'weak', statusValue: 2, weight: 2, label: '假面低语' },
      { kind: 'attackMulti', value: 7, times: 2, weight: 3, label: '千爪' },
    ],
    quote: '你看见的，是第几张脸？',
    // 千面狐不做半血转阶段：phaseTwo 行动表作为「换面」后的第二副面孔，
    // 由引擎按 id 特判——每 3 回合换面并附加 1 回合镜像反伤。
    phaseTwo: {
      threshold: 0,
      moves: [
        { kind: 'attack', value: 13, weight: 3, label: '真容一瞥' },
        { kind: 'debuff', value: 0, status: 'vulnerable', statusValue: 2, weight: 2, label: '镜中咒' },
        { kind: 'attack', value: 9, status: 'burn', statusValue: 2, weight: 2, label: '狐焰' },
      ],
      quote: '镜碎千面，孰真孰假？',
    },
  },
  {
    id: 'zhongyan', name: '终焉使者', art: '/boss-zhongyan.png', hp: [152, 180], tier: 'boss',
    floors: [3], pattern: 'cycle',
    moves: [
      { kind: 'attack', value: 10, status: 'burn', statusValue: 2, weight: 3, label: '十日凌空' },
      { kind: 'attackMulti', value: 6, times: 3, weight: 3, label: '日冕连射' },
      { kind: 'buff', value: 0, status: 'strength', statusValue: 2, weight: 1, label: '聚光' },
    ],
    quote: '第十日已至，万物归一。',
    phaseTwo: {
      threshold: 0.5,
      moves: [
        { kind: 'attack', value: 22, weight: 3, label: '蚀夜终斩' },
        { kind: 'attack', value: 14, status: 'weak', statusValue: 1, weight: 2, label: '永夜侵蚀' },
        { kind: 'debuff', value: 0, status: 'vulnerable', statusValue: 2, weight: 2, label: '终焉宣告' },
        { kind: 'attackMulti', value: 8, times: 2, weight: 2, label: '残日回旋' },
      ],
      quote: '日蚀之时，终焉降临——尔将长眠于无日之夜！',
    },
  },
  // ============ 召唤物（梼杌 summon，复用纸人立绘） ============
  {
    id: 'xiaochang', name: '小伥鬼', art: '/enemy-zhiren.png', hp: [14, 18], tier: 'normal',
    floors: [], pattern: 'weighted',
    moves: [
      { kind: 'attack', value: 4, weight: 3, label: '小鬼抓挠' },
      { kind: 'attack', value: 6, weight: 2, label: '怨念冲撞' },
    ],
    quote: '为虎作伥，不得超生。',
  },
]

const ENEMY_MAP = new Map(ENEMIES.map((e) => [e.id, e]))

export function hasEnemy(id: string): boolean {
  return ENEMY_MAP.has(id)
}

export function getEnemy(id: string): EnemyDef {
  const def = ENEMY_MAP.get(id)
  if (!def) throw new Error(`unknown enemy id: ${id}`)
  return def
}

export const NORMAL_ENEMY_IDS = ENEMIES.filter((e) => e.tier === 'normal' && e.id !== 'xiaochang').map((e) => e.id)
export const ELITE_ENEMY_IDS = ENEMIES.filter((e) => e.tier === 'elite').map((e) => e.id)
export const BOSS_ENEMY_IDS = ENEMIES.filter((e) => e.tier === 'boss').map((e) => e.id)

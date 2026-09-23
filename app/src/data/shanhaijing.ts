/**
 * 山海经 / 古典志怪意象层。
 *
 * 这些条目是视觉与玩法锚点，不是把古籍内容直接当作游戏规则。
 * 角色的具体人格、能力数值和世界事件仍由本项目原创数据决定。
 */
export interface ShanHaiAnchor {
  id: string
  name: string
  sourceLabel: string
  motif: string
  gameplay: string
}

export const SHANHAI_ANCHORS: Record<string, ShanHaiAnchor> = {
  baize: {
    id: 'baize',
    name: '白泽意象',
    sourceLabel: '古典志怪谱系',
    motif: '知万物而不轻易开口；它的价值在于把见闻整理成可验证的线索。',
    gameplay: '偏向证据整理、矛盾追踪与公开信息复盘。',
  },
  eshou: {
    id: 'eshou',
    name: '讹兽意象',
    sourceLabel: '古典志怪谱系',
    motif: '真假从来不只取决于一句话，也取决于谁在什么时刻相信了它。',
    gameplay: '偏向误导、伪装和迫使对手提前表态。',
  },
  xuanji: {
    id: 'xuanji',
    name: '星官与浑天意象',
    sourceLabel: '东方天文想象 · 本项目原创角色',
    motif: '把星位、时刻与行动排列成可推演的局面，但不把概率当成命运。',
    gameplay: '偏向概率计算、行动排序与资源预算。',
  },
  zhuyin: {
    id: 'zhuyin',
    name: '烛阴意象',
    sourceLabel: '《山海经》神话意象再创作',
    motif: '昼夜可以切换，代价不会消失；每一次借来的时间都要在后面偿还。',
    gameplay: '偏向资源积累、时机交换和高风险结算。',
  },
}

export function getShanHaiAnchor(id: string): ShanHaiAnchor | undefined {
  return SHANHAI_ANCHORS[id]
}

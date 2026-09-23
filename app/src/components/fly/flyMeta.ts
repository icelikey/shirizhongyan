/**
 * ============================================================================
 * flyTease 视觉词表（src/components/fly/flyMeta.ts）
 * ----------------------------------------------------------------------------
 * 只做「行为 → 视觉」的映射，不含逻辑。
 *
 * 为什么单独一层：六种行为在牌桌、结算板、雨图、图鉴四处出现，
 * 若各写各的颜色，同一行为在不同位置的观感会漂移。集中在这里。
 *
 * 配色纪律（见 DESIGN.md）：四花色本身不改；行为色是新增的语义色，
 * 从既有色语言里取——朱红/金/青/紫蓝沿用花色系，汲饮与僵住各补一档
 * 偏冷的色，让「冷」在视觉上就等于「退缩与停滞」。
 * ============================================================================
 */
import { FLY_BEHAVIOR_META, type FlyBehavior } from '@contracts/flyTease'

/** 行为 → 主色 */
export const FLY_BEHAVIOR_COLOR: Record<FlyBehavior, string> = {
  lick: '#EE6A72',
  charge: '#F2A93B',
  groom: '#4ECB9C',
  drink: '#5FB8D6',
  retreat: '#8B93F8',
  freeze: '#A6A2B8',
}

/** 行为 → 一个字，用于空间极小的徽记（牌桌角标、雨图泳道名） */
export const FLY_BEHAVIOR_GLYPH: Record<FlyBehavior, string> = {
  lick: '舌',
  charge: '击',
  groom: '须',
  drink: '饮',
  retreat: '退',
  freeze: '僵',
}

/** 通道 tier → 一句话定位（牌桌分组标题用） */
export const FLY_TIER_NOTE: Record<string, string> = {
  source: '感受层 · 刺激的入口',
  relay: '一级中继',
  motor: '运动侧',
  center: '中枢（食管下区）',
}

export function behaviorLabel(b: FlyBehavior): string {
  return FLY_BEHAVIOR_META[b].label
}

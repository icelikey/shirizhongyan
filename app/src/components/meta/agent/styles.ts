/**
 * 契约影从六种心性风格（agent.md §A2 + 任务契约：冷静/激进/直觉/沉默/狡黠/均衡）。
 *
 * 注：store 的 Companion.style 类型只覆盖 'calm'|'sharp'|'warm'|'balanced' 四值；
 * 六种风格的 key 以字符串写入（updateCompanion 运行时兼容），读取处按 string 比较。
 */
import { Brain, Flame, Sparkles, EyeOff, VenetianMask, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface StyleDef {
  key: string
  name: string
  quote: string
  icon: LucideIcon
  /** 两条行为倾向（1-5） */
  tendencies: { label: string; value: number }[]
  /** 胜率档案雷达五轴基值（计算/欺诈/稳健/表达/直觉，0-100） */
  radar: number[]
}

export const STYLES: StyleDef[] = [
  {
    key: 'calm',
    name: '冷静计算型',
    quote: '每一手，都算到第三步',
    icon: Brain,
    tendencies: [
      { label: '计算', value: 4 },
      { label: '激进', value: 1 },
    ],
    radar: [92, 40, 82, 45, 55],
  },
  {
    key: 'sharp',
    name: '激进悍跳型',
    quote: '先声夺人，气势即真相',
    icon: Flame,
    tendencies: [
      { label: '计算', value: 2 },
      { label: '激进', value: 5 },
    ],
    radar: [58, 76, 34, 90, 62],
  },
  {
    key: 'intuitive',
    name: '直觉流',
    quote: '心血来潮，从不出错——大概',
    icon: Sparkles,
    tendencies: [
      { label: '计算', value: 2 },
      { label: '激进', value: 3 },
    ],
    radar: [44, 56, 50, 62, 95],
  },
  {
    key: 'silent',
    name: '沉默观察者',
    quote: '言多必失，我看，我听',
    icon: EyeOff,
    tendencies: [
      { label: '计算', value: 4 },
      { label: '激进', value: 1 },
    ],
    radar: [76, 52, 86, 24, 70],
  },
  {
    key: 'cunning',
    name: '狡黠搅局者',
    quote: '水越浑，鱼越肥',
    icon: VenetianMask,
    tendencies: [
      { label: '计算', value: 3 },
      { label: '激进', value: 4 },
    ],
    radar: [64, 90, 44, 82, 50],
  },
  {
    key: 'balanced',
    name: '均衡游走型',
    quote: '随形就势，无迹可寻',
    icon: Scale,
    tendencies: [
      { label: '计算', value: 3 },
      { label: '激进', value: 3 },
    ],
    radar: [66, 60, 66, 60, 66],
  },
]

export const RADAR_AXES = ['计算', '欺诈', '稳健', '表达', '直觉']

export const getStyle = (key: string): StyleDef => STYLES.find((s) => s.key === key) ?? STYLES[5]

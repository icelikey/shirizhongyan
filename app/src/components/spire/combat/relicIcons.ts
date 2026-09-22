/** 遗物 id → lucide 图标（与 relics.ts 的 icon 字段一致，非 emoji）。 */
import {
  Bell,
  Brush,
  Calculator,
  Coins,
  FlameKindling,
  Footprints,
  PersonStanding,
  ScrollText,
  Shell,
  ShieldHalf,
  Stamp,
  Sun,
  TowerControl,
  Wine,
} from 'lucide-react'

export const RELIC_ICON: Record<string, typeof Sun> = {
  'sundial-shard': Sun,
  'bronze-bell': Bell,
  'cinnabar-seal': Stamp,
  'tortoise-shell': Shell,
  'wine-gourd': Wine,
  'fragment-scroll': ScrollText,
  cornucopia: Coins,
  'wolf-brush': Brush,
  'paper-doll': PersonStanding,
  'beacon-tower': TowerControl,
  abacus: Calculator,
  'heart-mirror': ShieldHalf,
  incense: FlameKindling,
  'shore-shoes': Footprints,
}

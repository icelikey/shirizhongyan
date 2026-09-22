/** 飘字与抖动：页面维护，按 target 分发到单位组件渲染。 */
export interface Floater {
  id: number
  target: 'player' | string
  text: string
  cls: 'dmg' | 'block' | 'heal' | 'status' | 'info' | 'label'
}

export const FLOATER_CLS: Record<Floater['cls'], string> = {
  dmg: 'text-cinnabar-hi font-mono font-semibold text-xl',
  block: 'text-[#7FC8E8] font-mono font-semibold text-lg',
  heal: 'text-ok font-mono font-semibold text-lg',
  status: 'text-suit-diamond font-sanssc text-sm',
  info: 'text-gold-300 font-sanssc text-sm',
  label: 'text-bone font-serifsc text-base',
}

/**
 * <ZodiacSeal> 生肖印（design.md §10.6）。
 * 40px 圆形篆刻章。点亮=金色浮雕 + 呼吸光；未点亮=线稿 24% 透明度。
 * 印章图：/zodiac-01.svg … /zodiac-12.svg。
 */
import { ZODIAC, WINS_PER_ZODIAC } from '@/data/zodiac'
import MaskIcon from '@/components/MaskIcon'
import { cn } from '@/lib/utils'

export interface ZodiacSealProps {
  /** 生肖索引 0-11（鼠..猪） */
  index: number
  /** 是否已点亮 */
  lit?: boolean
  /** 距点亮的胜场进度 0-3（未点亮时 tooltip 显示） */
  progress?: number
  size?: number
  className?: string
  onClick?: () => void
}

export default function ZodiacSeal({ index, lit = false, progress = 0, size = 40, className, onClick }: ZodiacSealProps) {
  const meta = ZODIAC[index]
  if (!meta) return null
  const tip = lit
    ? `${meta.title} · 胜场 ${WINS_PER_ZODIAC}/${WINS_PER_ZODIAC} · 已点亮`
    : `${meta.name}（${meta.branch}） · 胜场 ${progress}/${WINS_PER_ZODIAC}`
  return (
    <button
      type="button"
      title={tip}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border transition-all duration-300 ease-ink',
        lit
          ? 'border-gold-300/70 bg-gold-300/15 shadow-gold-glow animate-breathe'
          : 'border-gold-300/15 bg-transparent hover:border-gold-300/40',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <MaskIcon
        src={meta.seal}
        alt={meta.name}
        size={size * 0.78}
        color={lit ? '#F8E9C0' : '#E3C27C'}
        className={cn('transition-opacity', lit ? 'opacity-100' : 'opacity-25')}
        style={lit ? { filter: 'drop-shadow(0 0 4px rgba(227,194,124,.5))' } : undefined}
      />
    </button>
  )
}

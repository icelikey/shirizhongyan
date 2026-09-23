/**
 * ============================================================================
 * 刺激牌桌（src/components/fly/FlyCardDeck.tsx）
 * ----------------------------------------------------------------------------
 * 本作的**信息主体**。52 张牌各自的六行为分布全都摊在这里，谁都能读。
 * 玩家要做的不是「猜」，是**读表 + 读人**：
 *
 *   - 读表：哪张牌最容易做出蛐蛐本轮要的行为（`behavior[mood]`）；
 *   - 读人：那张牌太显眼了，别人大概率也会打，撞车就摊薄。
 *
 * 所以牌桌必须把两件事同时摊开——行为分布（表）与可打中程度（人挤人的诱因）。
 *
 * 布局刻意做成矩阵：行为 = 行（强度 Hz）× 列（静默档）。这不是装饰，
 * 而是让「强度越高越强」与「静默改变通路」这两条真实规律肉眼可见。
 * ============================================================================
 */
import { useMemo } from 'react'
import {
  FLY_HIT_FLOOR,
  type FlyBehavior,
  type FlyTeaseAtlas,
} from '@contracts/flyTease'
import { cn } from '@/lib/utils'
import { FLY_BEHAVIOR_COLOR, FLY_BEHAVIOR_GLYPH, behaviorLabel } from './flyMeta'

export interface FlyCardDeckProps {
  atlas: FlyTeaseAtlas
  /** 本轮蛐蛐偏好；用它标出「打中概率」 */
  mood: FlyBehavior
  /** 已选中的牌下标（未选为 null） */
  selected: number | null
  /** 已提交或非可选状态时置灰 */
  disabled?: boolean
  onPick: (index: number) => void
  className?: string
}

/** 六段行为条：段宽正比于概率，颜色即行为 */
function BehaviorBar({
  behavior,
  emphasize,
}: {
  behavior: Record<FlyBehavior, number>
  emphasize: FlyBehavior
}) {
  const keys = Object.keys(behavior) as FlyBehavior[]
  return (
    <div className="flex h-[5px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,.06)]">
      {keys.map((b) => (
        <span
          key={b}
          style={{
            width: `${Math.max(0, behavior[b] ?? 0) * 100}%`,
            background: FLY_BEHAVIOR_COLOR[b],
            opacity: b === emphasize ? 1 : 0.45,
          }}
        />
      ))}
    </div>
  )
}

export default function FlyCardDeck({
  atlas,
  mood,
  selected,
  disabled,
  onPick,
  className,
}: FlyCardDeckProps) {
  /** 通道 → 强度 → 静默档 → 牌 */
  const matrix = useMemo(() => {
    const silenceCols: string[] = []
    const byChannel = new Map<
      string,
      Map<number, Map<string, (typeof atlas.cards)[number]>>
    >()
    for (const card of atlas.cards) {
      if (!silenceCols.includes(card.silence)) silenceCols.push(card.silence)
      const rates =
        byChannel.get(card.channel) ??
        new Map<number, Map<string, (typeof atlas.cards)[number]>>()
      const cells = rates.get(card.rate) ?? new Map()
      cells.set(card.silence, card)
      rates.set(card.rate, cells)
      byChannel.set(card.channel, rates)
    }
    // 静默档排序：none 放最后（它是最不"反转"的那一档，做右侧参照）
    silenceCols.sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)))
    return { silenceCols, byChannel }
  }, [atlas.cards])

  const channelLabel = useMemo(() => {
    const m = new Map(atlas.groups.map((g) => [g.id, g]))
    return m
  }, [atlas.groups])

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {[...matrix.byChannel.entries()].map(([channelId, rates]) => {
        const ch = channelLabel.get(channelId)
        return (
          <div key={channelId} className="panel-bg rounded-xl p-2.5">
            {/* 通道标题行 */}
            <div className="mb-2 flex items-baseline gap-2 px-0.5">
              <span className="font-mashan text-[15px] text-bone">{ch?.label ?? channelId}</span>
              <span className="text-[10px] text-faint">{ch?.desc}</span>
              <span className="ml-auto font-mono text-[10px] text-dim">{ch?.size ?? 0} 神经元</span>
            </div>

            {/* 列头：静默档 */}
            <div className="mb-1 flex gap-1.5 pl-[46px]">
              {matrix.silenceCols.map((s) => (
                <div key={s} className="flex-1 text-center font-mono text-[10px] text-dim">
                  {s === 'none' ? '不静默' : `静默·${channelLabel.get(s)?.label ?? s}`}
                </div>
              ))}
            </div>

            {/* 行：强度 */}
            {[...rates.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([rate, cells]) => (
                <div key={rate} className="mb-1.5 flex items-stretch gap-1.5">
                  <div className="flex w-[40px] shrink-0 items-center justify-end pr-1 font-mono text-[11px] text-dim">
                    {rate}
                    <span className="ml-0.5 text-[9px] text-faint">Hz</span>
                  </div>
                  {matrix.silenceCols.map((s) => {
                    const card = cells.get(s)
                    if (!card) {
                      return (
                        <div
                          key={s}
                          className="flex-1 rounded-md border border-dashed border-[rgba(227,194,124,.10)]"
                        />
                      )
                    }
                    const hit = card.behavior[mood] ?? 0
                    const canHit = hit >= FLY_HIT_FLOOR
                    const isSel = selected === card.index
                    const moodColor = FLY_BEHAVIOR_COLOR[mood]
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        onClick={() => onPick(card.index)}
                        title={`${card.id}｜主导 ${behaviorLabel(card.top)} ${(card.spread * 100).toFixed(0)}% 果断｜打中 ${behaviorLabel(mood)} ${(hit * 100).toFixed(0)}%`}
                        className={cn(
                          'group flex-1 rounded-md border px-1.5 py-1 text-left transition-all duration-200',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          isSel
                            ? 'border-gold-300 bg-[rgba(227,194,124,.14)]'
                            : canHit
                              ? 'border-[rgba(227,194,124,.22)] bg-[rgba(12,10,19,.62)] hover:border-[rgba(227,194,124,.5)]'
                              : 'border-[rgba(227,194,124,.07)] bg-[rgba(12,10,19,.35)]',
                        )}
                        style={
                          isSel
                            ? { boxShadow: `0 0 0 1px ${moodColor}66, 0 0 16px ${moodColor}44` }
                            : undefined
                        }
                      >
                        <BehaviorBar behavior={card.behavior} emphasize={mood} />
                        <div className="mt-1 flex items-center gap-1">
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] font-mashan text-[10px] text-ink"
                            style={{ background: FLY_BEHAVIOR_COLOR[card.top] }}
                          >
                            {FLY_BEHAVIOR_GLYPH[card.top]}
                          </span>
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: canHit ? moodColor : '#6B6577' }}
                          >
                            {(hit * 100).toFixed(0)}%
                          </span>
                          {card.spread > 0.2 && (
                            <span className="ml-auto font-mono text-[9px] text-faint">犹豫</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
          </div>
        )
      })}
    </div>
  )
}

/**
 * ============================================================================
 * 本轮结算板（src/components/fly/FlyRevealBoard.tsx）
 * ----------------------------------------------------------------------------
 * 揭晓时把一轮的因果链原样摊开，一步不漏：
 *
 *   牌 → 主导行为 → 打中偏好多少 → 撞了几个人 → 怒气积到哪 → 得分
 *
 * 为什么要把中间量都显示出来：本作的争议点全在中间。玩家会问
 * 「我明明打中了为什么只有 1 分」（拥挤）、「为什么大家都没分」（集体激怒）。
 * 把拥挤系数与怒气值摊在明面上，规则就不需要靠嘴解释，
 * 也正好对上规则书 rb-flytease 里那几条可质询条款。
 *
 * 点座位名可看那张牌的脉冲雨——那是「这不是随机数」的证据。
 * ============================================================================
 */
import { useState } from 'react'
import {
  FLY_BEHAVIOR_META,
  FLY_HIT_FLOOR,
  type FlyBehavior,
  type FlyTeaseAtlas,
  type FlyTeaseReveal,
} from '@contracts/flyTease'
import { cn } from '@/lib/utils'
import SpikeRain from './SpikeRain'
import { FLY_BEHAVIOR_COLOR, FLY_BEHAVIOR_GLYPH, behaviorLabel } from './flyMeta'

export interface FlyRevealBoardProps {
  reveal: FlyTeaseReveal
  atlas: FlyTeaseAtlas
  /** 座位号 → 展示名 */
  seatNames: Map<number, string>
  mySeat: number | null
  /** 怒气阈值（来自游戏参数） */
  rageThreshold: number
  className?: string
}

/** 六个行为点阵：亮的是本轮偏好，其余留暗底做参照 */
function MoodPips({ mood }: { mood: FlyBehavior }) {
  const all = Object.keys(FLY_BEHAVIOR_META) as FlyBehavior[]
  return (
    <div className="flex items-center gap-1">
      {all.map((b) => (
        <span
          key={b}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-[4px] font-mashan text-[11px] transition-all',
            b === mood ? 'text-ink' : 'text-faint/60',
          )}
          style={
            b === mood
              ? { background: FLY_BEHAVIOR_COLOR[b], boxShadow: `0 0 12px ${FLY_BEHAVIOR_COLOR[b]}88` }
              : { background: 'rgba(255,255,255,.05)' }
          }
          title={behaviorLabel(b)}
        >
          {FLY_BEHAVIOR_GLYPH[b]}
        </span>
      ))}
    </div>
  )
}

export default function FlyRevealBoard({
  reveal,
  atlas,
  seatNames,
  mySeat,
  rageThreshold,
  className,
}: FlyRevealBoardProps) {
  const [peekSeat, setPeekSeat] = useState<number | null>(null)

  const moodColor = FLY_BEHAVIOR_COLOR[reveal.cricketMood]
  const ragePct = Math.min(100, (reveal.rage / Math.max(1, rageThreshold)) * 100)
  const rows = Object.keys(reveal.values)
    .map(Number)
    .sort((a, b) => a - b)

  /** 被点开看雨图的那张牌 */
  const peekCardIndex = peekSeat != null ? reveal.values[peekSeat] : null
  const peekRain = peekCardIndex != null ? reveal.rain[peekCardIndex] : undefined

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* 蛐蛐本轮偏好 + 怒气 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] tracking-[.25em] text-faint">蛐蛐偏好</span>
          <span
            className="font-mashan text-[19px]"
            style={{ color: moodColor, textShadow: `0 0 16px ${moodColor}55` }}
          >
            {behaviorLabel(reveal.cricketMood)}
          </span>
          <MoodPips mood={reveal.cricketMood} />
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[11px] tracking-[.2em] text-faint">怒气</span>
            <span className="relative block h-2 w-36 overflow-hidden rounded-full bg-[rgba(255,255,255,.08)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${ragePct}%`,
                  background: reveal.raged
                    ? 'linear-gradient(90deg,#F0655A,#EE6A72)'
                    : 'linear-gradient(90deg,#E3C27C,#F2A93B)',
                }}
              />
            </span>
            <span
              className={cn('font-mono text-[12px]', reveal.raged ? 'text-[#F0655A]' : 'text-gold-300')}
            >
              {reveal.rage.toFixed(1)} / {rageThreshold}
            </span>
          </span>
        </div>
        {reveal.raged && (
          <p className="mt-2 rounded-md border border-[rgba(240,101,90,.35)] bg-[rgba(240,101,90,.10)] px-2.5 py-1.5 text-[12px] text-[#F8B0A6]">
            全场怒气越过阈值 —— 蛐蛐反击，
            <span className="text-[#F0655A]">本轮全体得分归零</span>。
            「扑击」的怒气权重最高，多人同时扑击最容易引爆。
          </p>
        )}
      </div>

      {/* 逐座因果链 */}
      <div className="panel-bg rounded-xl p-3">
        <div className="mb-2 flex items-center gap-3 text-[10px] tracking-[.2em] text-faint">
          <span className="w-[86px]">座位</span>
          <span className="w-[42px]">行为</span>
          <span className="w-[54px] text-right">打中</span>
          <span className="w-[54px] text-right">拥挤</span>
          <span className="w-[82px] pl-2">所用牌</span>
          <span className="ml-auto">本轮得分</span>
        </div>
        <div className="flex flex-col gap-1">
          {rows.map((seat) => {
            const top = reveal.tops[seat]
            const hit = reveal.hits[seat] ?? 0
            const crowd = reveal.crowd[seat] ?? 1
            const gain = reveal.gains[seat] ?? 0
            const cardIdx = reveal.values[seat]
            const card = atlas.cards[cardIdx]
            const mine = seat === mySeat
            const canHit = hit >= FLY_HIT_FLOOR
            return (
              <button
                key={seat}
                type="button"
                onClick={() => setPeekSeat(peekSeat === seat ? null : seat)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-2 py-1.5 text-left transition-colors',
                  peekSeat === seat
                    ? 'border-[rgba(227,194,124,.4)] bg-[rgba(227,194,124,.07)]'
                    : 'border-transparent hover:bg-[rgba(255,255,255,.03)]',
                )}
              >
                <span
                  className={cn(
                    'w-[86px] shrink-0 truncate text-[12px]',
                    mine ? 'text-gold-300' : 'text-bone',
                  )}
                >
                  {seatNames.get(seat) ?? `${seat + 1} 号位`}
                </span>
                <span className="flex w-[42px] shrink-0 items-center gap-1">
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-[3px] font-mashan text-[10px] text-ink"
                    style={{ background: FLY_BEHAVIOR_COLOR[top] }}
                  >
                    {FLY_BEHAVIOR_GLYPH[top]}
                  </span>
                  {top === reveal.cricketMood && (
                    <span className="text-[10px]" style={{ color: moodColor }}>
                      中
                    </span>
                  )}
                </span>
                <span
                  className="w-[54px] shrink-0 text-right font-mono text-[12px]"
                  style={{ color: canHit ? moodColor : '#6B6577' }}
                >
                  {(hit * 100).toFixed(0)}%
                </span>
                <span className="w-[54px] shrink-0 text-right font-mono text-[12px] text-dim">
                  ×{crowd.toFixed(2)}
                </span>
                <span className="w-[82px] shrink-0 truncate pl-2 font-mono text-[10px] text-faint">
                  {card ? card.id.replace('ft:', '') : `#${cardIdx}`}
                </span>
                <span className="ml-auto font-mono text-[14px] text-gold-300">+{gain}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 点座位看脉冲雨 */}
      {peekCardIndex != null && (
        <div className="panel-bg rounded-xl p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] tracking-[.2em] text-faint">脉冲雨</span>
            <span className="font-mono text-[11px] text-dim">
              {seatNames.get(peekSeat ?? 0) ?? `${(peekSeat ?? 0) + 1} 号位`} · {atlas.cards[peekCardIndex]?.id}
            </span>
            <span className="ml-auto font-mono text-[10px] text-faint">
              {atlas.cards[peekCardIndex]?.totalSpikes ?? 0} 次脉冲 · 引擎 {reveal.engine}
            </span>
          </div>
          <SpikeRain
            rain={peekRain ?? []}
            poolOrder={reveal.poolOrder}
            durationMs={atlas.durationMs}
            replayKey={peekCardIndex}
            height={120}
          />
          {atlas.cards[peekCardIndex] && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-dim">
              {Object.entries(atlas.cards[peekCardIndex].pools).map(([k, v]) => (
                <span key={k}>
                  {k} {v.toFixed(1)} Hz
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

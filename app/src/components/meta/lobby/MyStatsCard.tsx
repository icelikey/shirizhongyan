/**
 * 我的数据卡（lobby.md §L3）—— 紧凑四格：
 * 位阶 / 总胜率（count-up）/ 当前生肖进度（契约影从花色大陆的下一枚）/ 碎片总计。
 */
import { useEffect, useState } from 'react'
import { useProfile } from '@/store/profile'
import { SUITS, getEcho } from '@/data/echoes'
import { ZODIAC, WINS_PER_ZODIAC } from '@/data/zodiac'
import { getTier } from '@/data/tiers'
import FragmentChip from '@/components/FragmentChip'
import MaskIcon from '@/components/MaskIcon'
import TierSeal from '@/components/TierSeal'

/** 挂载时数字 count-up（600ms） */
function useCountUp(target: number, duration = 600): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

export default function MyStatsCard() {
  const tier = useProfile((s) => s.tier)
  const records = useProfile((s) => s.records)
  const zodiac = useProfile((s) => s.zodiac)
  const wins = useProfile((s) => s.winsTowardZodiac)
  const companion = useProfile((s) => s.companion)
  const fragments = useProfile((s) => s.fragments)

  const played = records.guess.played + records.werewolf.played
  const won = records.guess.won + records.werewolf.won
  const rate = played > 0 ? Math.round((won / played) * 100) : 0
  const shownRate = useCountUp(rate)

  // 当前生肖：契约影从所在大陆的下一枚未点亮生肖
  const suit = companion ? getEcho(companion.echoId)?.suit ?? 'club' : 'club'
  const lit = zodiac[suit]
  const nextIdx = lit.length >= 12 ? -1 : ZODIAC.find((z) => !lit.includes(z.index))?.index ?? -1
  const next = nextIdx >= 0 ? ZODIAC[nextIdx] : null
  const tierMeta = getTier(tier)

  return (
    <div className="panel-bg rounded-[14px] p-5">
      <h3 className="font-serifsc text-[15px] tracking-[.2em] text-dim">我的数据</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* 位阶 */}
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-2.5">
          <TierSeal tier={tier} size={34} glow />
          <div className="leading-tight">
            <div className="text-[13px] text-bone">{tierMeta.name}</div>
            <div className="text-[10px] tracking-wider text-faint">当前位阶</div>
          </div>
        </div>
        {/* 总胜率 */}
        <div className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-2.5">
          <div className="font-mono text-[20px] leading-none text-gold-300">
            {shownRate}
            <span className="text-[12px]">%</span>
          </div>
          <div className="mt-1 text-[10px] tracking-wider text-faint">总胜率 · {played} 局</div>
        </div>
        {/* 当前生肖进度 */}
        <div className="col-span-2 flex items-center gap-3 rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-2.5">
          {next ? (
            <>
              <MaskIcon src={next.seal} alt={next.name} size={30} color="#E3C27C" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-bone">{next.title}</span>
                  <span className="font-mono text-[11px] text-dim">
                    {wins[suit]}/{WINS_PER_ZODIAC}
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(227,194,124,.12)]">
                  <div
                    className="h-full rounded-full bg-gold-300 transition-all duration-700 ease-ink"
                    style={{ width: `${(wins[suit] / WINS_PER_ZODIAC) * 100}%`, boxShadow: '0 0 6px rgba(227,194,124,.6)' }}
                  />
                </div>
              </div>
            </>
          ) : (
            <span className="text-[12px] text-dim">此大陆生肖已尽数点亮</span>
          )}
        </div>
        {/* 碎片总计 */}
        <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-2.5">
          {SUITS.map((s) => (
            <FragmentChip key={s} suit={s} count={fragments[s]} size="sm" />
          ))}
        </div>
      </div>
    </div>
  )
}

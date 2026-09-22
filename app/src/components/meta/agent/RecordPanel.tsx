/**
 * 胜率档案（agent.md §A3）。
 * 大数字（总胜率 Cinzel 金字）+ 总局数 + MVP；双游戏分列；
 * 迷你雷达（5 轴，随心性风格变化）+ 近 10 场 sparkline（胜金点在上 / 负朱砂点在下）。
 */
import { useProfile } from '@/store/profile'
import { SUIT_META, getEcho } from '@/data/echoes'
import RadarChart from '@/components/meta/RadarChart'
import SectionHeader from '@/components/meta/SectionHeader'
import { RADAR_AXES, getStyle } from '@/components/meta/agent/styles'

/** 由战绩确定性生成近 10 场胜/负序列（原型假数据） */
function recentGames(played: number, won: number): boolean[] {
  const seed = played * 7 + won * 13 + 5
  const p = played > 0 ? won / played : 0.5
  return Array.from({ length: 10 }).map((_, i) => {
    const h = Math.sin(seed + i * 99.7) * 10000
    return h - Math.floor(h) < p
  })
}

export default function RecordPanel() {
  const companion = useProfile((s) => s.companion)
  const records = useProfile((s) => s.records)
  const mvps = useProfile((s) => s.mvps)

  if (!companion) return null
  const echo = getEcho(companion.echoId)
  const suitColor = echo ? SUIT_META[echo.suit].color : '#E3C27C'
  const style = getStyle(companion.style as string)

  const played = records.guess.played + records.werewolf.played
  const won = records.guess.won + records.werewolf.won
  const rate = played > 0 ? Math.round((won / played) * 100) : 0
  const ww = records.werewolf
  const gg = records.guess
  const games = recentGames(played, won)

  return (
    <section>
      <SectionHeader title="胜率档案" subtitle="并肩战绩 · 影从代打照常计入" sideMark="卷宗" />
      <div className="panel-bg mt-4 flex flex-col gap-5 rounded-[14px] p-5">
        {/* 大数字区 */}
        <div className="flex items-end gap-6">
          <div>
            <div className="gold-text font-cinzel text-[46px] font-bold leading-none">
              {rate}
              <span className="text-[22px]">%</span>
            </div>
            <div className="mt-1 text-[11px] tracking-[.2em] text-faint">总胜率</div>
          </div>
          <div className="pb-1">
            <div className="font-mono text-[18px] text-bone">{played}</div>
            <div className="mt-0.5 text-[10px] tracking-wider text-faint">总局数</div>
          </div>
          <div className="pb-1">
            <div className="font-mono text-[18px] text-bone">{mvps.werewolf + mvps.guess}</div>
            <div className="mt-0.5 text-[10px] tracking-wider text-faint">MVP</div>
          </div>
          <div className="pb-1">
            <div className="font-mono text-[18px] text-bone">{Math.max(2, Math.min(won, 7))}</div>
            <div className="mt-0.5 text-[10px] tracking-wider text-faint">连冠纪录</div>
          </div>
        </div>

        {/* 双游戏分列 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[10px] border border-[rgba(139,147,248,.25)] bg-[rgba(139,147,248,.06)] p-3">
            <div className="text-[11px] tracking-[.15em] text-suit-spade">♠ 月影狼人杀</div>
            <div className="mt-1.5 font-mono text-[12px] text-dim">
              {ww.won} 胜 / {ww.played - ww.won} 负 / MVP {mvps.werewolf}
            </div>
          </div>
          <div className="rounded-[10px] border border-[rgba(78,203,156,.25)] bg-[rgba(78,203,156,.06)] p-3">
            <div className="text-[11px] tracking-[.15em] text-suit-club">♣ 猜平均数</div>
            <div className="mt-1.5 font-mono text-[12px] text-dim">
              {gg.won} 胜 / {gg.played - gg.won} 负 / 最佳偏差 Δ0.3
            </div>
          </div>
        </div>

        {/* 雷达 + sparkline */}
        <div className="flex items-center gap-5">
          <div className="shrink-0">
            <RadarChart values={style.radar} labels={RADAR_AXES} color={suitColor} size={150} />
            <p className="mt-1 text-center text-[10px] tracking-wider text-faint">风格 · {style.name}</p>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-[11px] tracking-[.2em] text-faint">近 10 场</div>
            <div className="relative h-16">
              <span className="absolute left-0 right-0 top-1/2 h-px bg-[rgba(227,194,124,.15)]" />
              <div className="absolute inset-0 flex items-center justify-between">
                {games.map((win, i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: win ? '#E3C27C' : '#F0655A',
                      boxShadow: win ? '0 0 6px rgba(227,194,124,.7)' : '0 0 6px rgba(240,101,90,.5)',
                      transform: `translateY(${win ? -14 : 14}px)`,
                    }}
                    title={win ? `第 ${i + 1} 场 · 胜` : `第 ${i + 1} 场 · 负`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-1 flex justify-between text-[9px] tracking-wider text-faint">
              <span>金=胜 · 朱砂=负</span>
              <span>旧 → 新</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

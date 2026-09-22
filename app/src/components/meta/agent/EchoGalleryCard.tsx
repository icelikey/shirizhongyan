/**
 * 常驻影从图鉴卡（agent.md §右区卡片）。
 * 立绘上 2/3 + 信息下 1/3：名 / 花色 / 生肖 / 人设胶囊 / 胜率 / 状态点 +
 * 四维雷达（攻击性/欺骗/计算/心理，假数据）+ 恩怨条（读 store.echoMemories，未相遇用种子）。
 * 悬停 3D 倾斜 + 花色光晕；点击 → 详情 Modal。
 */
import { motion } from 'framer-motion'
import { useProfile } from '@/store/profile'
import type { Echo } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { ZODIAC } from '@/data/zodiac'
import MaskIcon from '@/components/MaskIcon'
import SuitIcon from '@/components/SuitIcon'
import RadarChart from '@/components/meta/RadarChart'
import TiltCard from '@/components/meta/TiltCard'
import { ECHO_RADAR, ECHO_RIVAL_SEED, ECHO_STATUS, RADAR_DIMS, STATUS_COLOR } from '@/components/meta/data'

export interface EchoGalleryCardProps {
  echo: Echo
  index: number
  onOpen: (echo: Echo) => void
}

export default function EchoGalleryCard({ echo, index, onOpen }: EchoGalleryCardProps) {
  const memory = useProfile((s) => s.echoMemories[echo.id])
  const suit = SUIT_META[echo.suit]
  const status = ECHO_STATUS[echo.id] ?? 'offline'
  const zodiac = ZODIAC[echo.zodiacIndex]
  const radar = ECHO_RADAR[echo.id]
  const seed = ECHO_RIVAL_SEED[echo.id] ?? { won: 0, lost: 0 }
  const rival = memory?.met ? { won: memory.wonAgainst, lost: memory.lostTo } : seed
  const total = rival.won + rival.lost
  const wonPct = total > 0 ? (rival.won / total) * 100 : 50

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <TiltCard
        max={7}
        glow={suit.glow}
        onClick={() => onOpen(echo)}
        className="panel-bg overflow-hidden rounded-[14px]"
      >
        {/* 立绘（上 2/3） */}
        <div className="relative h-[240px] overflow-hidden">
          <img
            src={echo.portrait}
            alt={echo.name}
            draggable={false}
            className="h-full w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent to-transparent" />
          {/* 状态点 */}
          <span
            className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-ink/80 px-2 py-1 text-[10px] tracking-wider"
            style={{ color: STATUS_COLOR[status] }}
          >
            <i className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full" style={{ background: STATUS_COLOR[status] }} />
            {status === 'online' ? '在线' : status === 'in-game' ? '对局中' : '离线'}
          </span>
        </div>

        {/* 信息（下 1/3） */}
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <h4 className="font-serifsc text-[18px] font-semibold text-bone">{echo.name}</h4>
            <span
              className="flex items-center gap-1 rounded-full px-1.5 py-px text-[9px] tracking-wider"
              style={{ color: suit.color, background: `${suit.color}14`, border: `1px solid ${suit.color}33` }}
            >
              <SuitIcon suit={echo.suit} size={10} />
              {suit.realm} · {echo.persona}
            </span>
            {zodiac && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-faint">
                <MaskIcon src={zodiac.seal} size={14} color="#C6A15B" alt={zodiac.name} />
                {zodiac.branch}
                {zodiac.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <RadarChart
              values={RADAR_DIMS.map((d) => radar[d.key])}
              labels={RADAR_DIMS.map((d) => d.label)}
              color={suit.color}
              size={118}
              className="shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div>
                <span className="font-mono text-[20px] text-gold-300">{(echo.winRate * 100).toFixed(0)}%</span>
                <span className="ml-1.5 text-[10px] tracking-wider text-faint">历史胜率</span>
              </div>
              <div className="font-mono text-[11px] text-dim">{echo.games} 场对局</div>
              <p className="line-clamp-2 text-[10px] leading-relaxed text-faint">{echo.tagline}</p>
            </div>
          </div>

          {/* 恩怨条 */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[10px] tracking-wider">
              <span className="text-faint">{memory?.met ? '交手' : '传闻交手'} {total} 次</span>
              <span>
                <span className="font-mono text-gold-300">你 {rival.won} 胜</span>
                <span className="mx-1 text-faint">·</span>
                <span className="font-mono text-cinnabar-hi">{rival.lost} 负</span>
              </span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
              <span
                className="h-full rounded-l-full bg-gold-300 transition-all duration-700"
                style={{ width: `${wonPct}%`, boxShadow: '0 0 6px rgba(227,194,124,.5)' }}
              />
              <span className="h-full flex-1 rounded-r-full bg-cinnabar/70" />
            </div>
          </div>
        </div>
      </TiltCard>
    </motion.div>
  )
}

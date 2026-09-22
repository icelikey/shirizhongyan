/**
 * 天梯 UI 组件（leaderboard.md）。
 * - IdentityChip  身份盲盒迷你牌：盲盒=牌背朝下；揭盅 rotateY 翻成 旅人印记 / 影从印记
 * - Podium        前三点将台（金银铜大卡，冠军居中更高 + 卡缘流光）
 * - BoardRow      榜单行（名次/身份牌/头像/位阶/生肖/数据列/近 5 场）
 * - PlayerDrawer  行点击「牌风小传」抽屉（盲盒模式下仍隐藏身份）
 * 全文件只用 framer-motion。
 */
import { useState } from 'react'
import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Minus, Swords, X } from 'lucide-react'
import { toast } from 'sonner'
import type { BoardEntry, GameTab } from '@/components/content/leaderboard-data'
import { pointsOf } from '@/components/content/leaderboard-data'
import { getEcho } from '@/data/echoes'
import type { EchoMemory } from '@/store/profile'
import TierSeal from '@/components/TierSeal'
import ZodiacSeal from '@/components/ZodiacSeal'
import MaskIcon from '@/components/MaskIcon'
import GoldButton from '@/components/GoldButton'
import { TiltCard } from '@/components/content/shared'
import { cn } from '@/lib/utils'

const EASE_SNAP: [number, number, number, number] = [0.83, 0, 0.17, 1]

/* ============================ IdentityChip ============================ */

export interface IdentityChipProps {
  entry: BoardEntry
  revealed: boolean
  /** 错峰序号（揭盅波浪） */
  order: number
}

export function IdentityChip({ entry, revealed, order }: IdentityChipProps) {
  const [hover, setHover] = useState(false)
  const echo = entry.echoId ? getEcho(entry.echoId) : undefined
  const suitColor = echo ? { spade: '#8B93F8', heart: '#EE6A72', club: '#4ECB9C', diamond: '#F2A93B' }[echo.suit] : '#E3C27C'

  return (
    <div
      className="relative w-6 h-[34px] shrink-0"
      style={{ perspective: 420 }}
      title={revealed ? (entry.identity === 'human' ? '旅人印记' : '影从印记') : '天机不可泄露'}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        animate={{ rotateY: revealed ? 180 : hover ? 22 : 0 }}
        transition={
          revealed
            ? { duration: 0.45, ease: EASE_SNAP, delay: order * 0.025 }
            : { duration: 0.35, ease: EASE_SNAP }
        }
      >
        {/* 牌背（盲盒） */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-[3px] overflow-hidden border border-gold-300/35">
          <img src="/card-back.png" alt="" draggable={false} className="w-full h-full object-cover" />
        </div>
        {/* 牌面（印记） */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] rounded-[3px] overflow-hidden border flex items-center justify-center"
          style={{
            transform: 'rotateY(180deg)',
            borderColor: `${suitColor}88`,
            background:
              entry.identity === 'human'
                ? 'linear-gradient(160deg, rgba(227,194,124,.35), rgba(138,106,51,.25))'
                : `${suitColor}26`,
          }}
        >
          {entry.identity === 'human' ? (
            <img src="/avatar-traveler.png" alt="旅人" draggable={false} className="w-full h-full object-cover" />
          ) : (
            <MaskIcon src="/icon-mask.svg" size={16} color={suitColor} alt="影从" />
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ============================ 连胜火焰 ============================ */

function StreakFlames({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span className="inline-flex items-center gap-0.5" title={`${n} 连胜`}>
      {Array.from({ length: n }).map((_, i) => (
        <MaskIcon key={i} src="/icon-flame.svg" size={14} color="#F0655A" alt="连胜" />
      ))}
    </span>
  )
}

/* ============================ Podium ============================ */

const RANK_STYLE = [
  { num: 'I', metal: 'linear-gradient(180deg,#F8E9C0 15%,#E3C27C 55%,#8A6A33 95%)', label: '魁首' },
  { num: 'II', metal: 'linear-gradient(180deg,#F2F4FA 15%,#C9CEDA 55%,#6E7488 95%)', label: '榜眼' },
  { num: 'III', metal: 'linear-gradient(180deg,#EFC79A 15%,#C98A4B 55%,#6E4423 95%)', label: '探花' },
]

export interface PodiumProps {
  top3: BoardEntry[]
  tab: GameTab
  revealed: boolean
}

export function Podium({ top3, tab, revealed }: PodiumProps) {
  if (top3.length < 3) return null
  const order: { entry: BoardEntry; rank: number }[] = [
    { entry: top3[1], rank: 1 },
    { entry: top3[0], rank: 0 },
    { entry: top3[2], rank: 2 },
  ]
  return (
    <div className="flex items-end justify-center gap-4 sm:gap-6">
      {order.map(({ entry, rank }) => {
        const st = RANK_STYLE[rank]
        const stat = entry.stats[tab]
        const winRate = stat.played > 0 ? Math.round((stat.won / stat.played) * 100) : 0
        const champion = rank === 0
        return (
          <motion.div
            key={entry.key}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 160, damping: 19, delay: champion ? 0.15 : 0.3 + rank * 0.08 }}
            className={cn('flex flex-col items-center', champion ? 'w-[210px] sm:w-[230px]' : 'w-[180px] sm:w-[200px]')}
          >
            {/* 月桂冠（冠军） */}
            {champion && (
              <svg width="72" height="26" viewBox="0 0 72 26" className="mb-1" fill="none">
                <path d="M6 20c8-10 16-13 22-12M66 20c-8-10-16-13-22-12" stroke="#E3C27C" strokeWidth="1.6" strokeLinecap="round" />
                {[10, 18, 26].map((x) => (
                  <ellipse key={x} cx={x} cy={20 - (x - 6) / 4} rx="4.5" ry="2.4" transform={`rotate(-30 ${x} ${20 - (x - 6) / 4})`} fill="#E3C27C" opacity=".85" />
                ))}
                {[62, 54, 46].map((x) => (
                  <ellipse key={x} cx={x} cy={20 - (66 - x) / 4} rx="4.5" ry="2.4" transform={`rotate(30 ${x} ${20 - (66 - x) / 4})`} fill="#E3C27C" opacity=".85" />
                ))}
              </svg>
            )}
            {/* 大卡（冠军卡缘流光） */}
            <div className={cn('relative rounded-[18px]', champion && 'p-[2px]')}>
              {champion && (
                <>
                  <style>{`@keyframes tdg-border-spin{to{transform:rotate(360deg)}}`}</style>
                  <span
                    className="absolute -inset-[60%] animate-[tdg-border-spin_4s_linear_infinite]"
                    style={{
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, rgba(248,233,192,.95) 40deg, rgba(227,194,124,.2) 90deg, transparent 140deg, rgba(227,194,124,.55) 220deg, transparent 300deg)',
                    }}
                  />
                </>
              )}
              <TiltCard
                max={6}
                className={cn(
                  'card-frame relative rounded-[16px] bg-panel w-full flex flex-col items-center px-4 pt-5 pb-6',
                  champion ? 'h-[400px]' : 'h-[340px]',
                )}
              >
                <span
                  className="font-cinzel font-bold leading-none select-none"
                  style={{
                    fontSize: champion ? 88 : 68,
                    background: st.metal,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,.6))',
                  }}
                >
                  {st.num}
                </span>
                <span className="text-[10px] tracking-[.4em] text-faint -mt-1">{st.label}</span>
                <span className="relative mt-4 rounded-full p-[2px] border border-gold-300/50">
                  <img
                    src={entry.portrait}
                    alt={entry.name}
                    draggable={false}
                    className="rounded-full object-cover object-top"
                    style={{ width: champion ? 96 : 80, height: champion ? 96 : 80 }}
                  />
                  {entry.isSelf && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 seal-stamp text-[11px] px-1.5 py-0.5">你</span>
                  )}
                </span>
                <span className="font-serifsc font-black text-[22px] text-bone mt-3 tracking-wider">{entry.name}</span>
                <span className="flex items-center gap-2 mt-2">
                  <TierSeal tier={entry.tier} size={26} glow={champion} />
                  <ZodiacSeal index={entry.zodiacIndex} lit size={24} />
                  <IdentityChip entry={entry} revealed={revealed} order={rank} />
                </span>
                <span className="font-mono text-[26px] text-gold-300 mt-3 leading-none">{pointsOf(stat)}</span>
                <span className="text-[11px] text-dim mt-1.5 font-mono">
                  胜率 {winRate}% · {stat.played} 场
                </span>
                <span className="mt-2">
                  <StreakFlames n={entry.streak} />
                </span>
              </TiltCard>
            </div>
            {/* 台基 */}
            <div
              className={cn('w-full rounded-b-xl border-x border-b border-gold-300/15 bg-elevated/60', champion ? 'h-6' : 'h-4')}
              style={{ boxShadow: '0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(248,233,192,.06)' }}
            />
          </motion.div>
        )
      })}
    </div>
  )
}

/* ============================ BoardRow ============================ */

export interface BoardRowProps {
  entry: BoardEntry
  rank: number
  tab: GameTab
  revealed: boolean
  order: number
  onClick: () => void
  selfRef?: Ref<HTMLDivElement>
}

export function BoardRow({ entry, rank, tab, revealed, order, onClick, selfRef }: BoardRowProps) {
  const stat = entry.stats[tab]
  const winRate = stat.played > 0 ? Math.round((stat.won / stat.played) * 100) : 0
  return (
    <motion.div
      ref={selfRef}
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: 0.35, delay: Math.min(order, 20) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className={cn(
        'relative grid grid-cols-[44px_30px_minmax(0,1fr)_auto] sm:grid-cols-[52px_34px_minmax(0,1.4fr)_auto] items-center gap-3 h-16 rounded-xl px-3 cursor-pointer',
        'border border-transparent transition-all duration-200 hover:translate-x-1 hover:border-gold-300/25 hover:shadow-gold-glow',
        rank % 2 === 0 ? 'bg-panel' : 'bg-panel/55',
        entry.isSelf && 'bg-gold-300/[.08] border-gold-300/30',
      )}
    >
      {entry.isSelf && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gold-300" />}
      {/* 名次 + 升降 */}
      <span className="flex items-baseline gap-1">
        <span className={cn('font-cinzel font-bold text-[19px]', rank <= 10 ? 'text-gold-300' : 'text-dim')}>
          {rank}
        </span>
        {entry.delta > 0 ? (
          <span className="inline-flex items-center text-gold-300 text-[10px] font-mono">
            <ArrowUp size={10} />{entry.delta}
          </span>
        ) : entry.delta < 0 ? (
          <span className="inline-flex items-center text-cinnabar-hi text-[10px] font-mono">
            <ArrowDown size={10} />{-entry.delta}
          </span>
        ) : (
          <Minus size={10} className="text-faint" />
        )}
      </span>
      {/* 身份牌 */}
      <IdentityChip entry={entry} revealed={revealed} order={order} />
      {/* 头像 + 名 + 风格 */}
      <span className="flex items-center gap-3 min-w-0">
        <img
          src={entry.portrait}
          alt={entry.name}
          draggable={false}
          className="w-10 h-10 rounded-full object-cover object-top border border-gold-300/40 shrink-0"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-serifsc font-semibold text-[15px] text-bone truncate">{entry.name}</span>
            {entry.isSelf && <span className="seal-stamp text-[10px] px-1 py-px shrink-0">你</span>}
          </span>
          <span className="inline-block mt-0.5 text-[10px] tracking-[.15em] text-dim border border-bone/10 rounded-full px-2 py-px">
            {entry.persona}
          </span>
        </span>
      </span>
      {/* 数据列 */}
      <span className="flex items-center gap-4 sm:gap-6">
        <span className="hidden md:flex items-center gap-2">
          <TierSeal tier={entry.tier} size={26} />
          <ZodiacSeal index={entry.zodiacIndex} lit size={22} />
        </span>
        <span className="hidden sm:flex gap-0.5 items-end h-5" title="近 5 场">
          {entry.recent.map((w, i) => (
            <span
              key={i}
              className="w-[4px] rounded-sm"
              style={{
                height: w ? 18 : 9,
                background: w ? '#E3C27C' : '#D8443C',
                opacity: 0.4 + i * 0.15,
              }}
            />
          ))}
          {entry.recent.length === 0 && <span className="text-faint text-[10px]">—</span>}
        </span>
        <span className="hidden lg:block text-right font-mono text-[12px] text-dim w-14">{stat.played} 场</span>
        <span className="text-right font-mono text-[12px] text-dim w-12">{winRate}%</span>
        <span className="text-right font-mono text-[15px] text-gold-300 w-14">{pointsOf(stat)}</span>
      </span>
    </motion.div>
  )
}

/* ============================ PlayerDrawer ============================ */

export interface PlayerDrawerProps {
  entry: BoardEntry | null
  revealed: boolean
  memories: Record<string, EchoMemory>
  onClose: () => void
}

export function PlayerDrawer({ entry, revealed, memories, onClose }: PlayerDrawerProps) {
  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            className="fixed inset-0 z-[65] bg-abyss/60 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-[66] w-[380px] max-w-[92vw] bg-ink border-l border-gold-300/20 shadow-card flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-[rgba(227,194,124,.10)]">
              <span className="text-[12px] tracking-[.35em] text-faint">牌风小传</span>
              <button type="button" onClick={onClose} className="text-dim hover:text-gold-300 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
              {/* 头 */}
              <div className="flex items-center gap-4">
                <img
                  src={entry.portrait}
                  alt={entry.name}
                  draggable={false}
                  className="w-[72px] h-[72px] rounded-full object-cover object-top border border-gold-300/50"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serifsc font-black text-[22px] text-bone">{entry.name}</h3>
                    {entry.isSelf && <span className="seal-stamp text-[10px] px-1 py-px">你</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <TierSeal tier={entry.tier} size={24} />
                    <ZodiacSeal index={entry.zodiacIndex} lit size={22} />
                    <IdentityChip entry={entry} revealed={revealed} order={0} />
                  </div>
                </div>
              </div>

              {/* 身份（盲盒下隐藏） */}
              <div className="rounded-xl border border-[rgba(227,194,124,.14)] bg-panel p-4 flex items-center gap-3">
                <MaskIcon src="/icon-mask.svg" size={20} color={revealed ? '#E3C27C' : '#6E6880'} alt="身份" />
                <p className="text-[13px] text-dim">
                  {revealed
                    ? entry.identity === 'human'
                      ? '旅人印记 · 真人之躯'
                      : `影从印记 · ${getEcho(entry.echoId ?? '')?.name ?? '智能体'}`
                    : '身份未揭 · 天机不可泄露'}
                </p>
              </div>

              {/* 分项战绩 */}
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { id: 'werewolf', label: '♠ 月影狼人杀', color: '#8B93F8' },
                    { id: 'guess', label: '♣ 猜平均数', color: '#4ECB9C' },
                  ] as const
                ).map((g) => {
                  const s = entry.stats[g.id]
                  const wr = s.played > 0 ? Math.round((s.won / s.played) * 100) : 0
                  return (
                    <div key={g.id} className="rounded-xl border border-[rgba(227,194,124,.12)] bg-panel p-3.5">
                      <p className="text-[11px] tracking-wider" style={{ color: g.color }}>
                        {g.label}
                      </p>
                      <p className="font-mono text-[18px] text-bone mt-1.5">{pointsOf(s)}</p>
                      <p className="font-mono text-[11px] text-dim mt-1">
                        {s.won} 胜 / {s.played} 场 · {wr}%
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 招牌操作 */}
              <div className="rounded-xl border border-[rgba(227,194,124,.12)] bg-panel p-4">
                <p className="text-[11px] tracking-[.25em] text-faint mb-2">招牌操作纪要</p>
                <p className="text-[13px] text-bone/85 leading-relaxed">{entry.signature}</p>
              </div>

              {/* 交战记录 */}
              {!entry.isSelf && (
                <div className="rounded-xl border border-[rgba(227,194,124,.12)] bg-panel p-4">
                  <p className="text-[11px] tracking-[.25em] text-faint mb-2">交战记录</p>
                  {(() => {
                    const mem = entry.echoId ? memories[entry.echoId] : undefined
                    const won = mem?.wonAgainst ?? 0
                    const lost = mem?.lostTo ?? 0
                    return (
                      <p className="text-[13px] text-bone/85">
                        你与 TA：<span className="font-mono text-gold-300">{won}</span> 胜{' '}
                        <span className="font-mono text-cinnabar-hi">{lost}</span> 负
                        {!mem?.met && <span className="text-faint text-[12px]"> · 尚未同桌</span>}
                      </p>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-[rgba(227,194,124,.10)] flex gap-3">
              <GoldButton
                variant="gold"
                size="sm"
                className="flex-1"
                onClick={() => toast('邀战已发出', { description: `${entry.name} 将在下一个牌局间隙回应。` })}
              >
                <Swords size={14} />
                邀战
              </GoldButton>
              {entry.echoId && (
                <Link to="/agent" className="flex-1">
                  <GoldButton variant="ghost" size="sm" className="w-full">
                    查看影从档案
                  </GoldButton>
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

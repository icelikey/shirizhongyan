/**
 * 在线影从名录（lobby.md §R2）+ 我的影从速览（§R3）。
 * 8 位影从：头像 / 名 / 花色·人设 / 状态点 / 胜率 / 「邀战」图标按钮。
 * 点名字 → /agent#echo-<id>；「邀战」→ Toast 两段演出 → 墨染进对局。
 */
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/store/profile'
import { ECHOES, SUIT_META, getEcho } from '@/data/echoes'
import EchoAvatar from '@/components/EchoAvatar'
import SuitIcon from '@/components/SuitIcon'
import { ECHO_STATUS, STATUS_COLOR, STATUS_LABEL } from '@/components/meta/data'
import { cn } from '@/lib/utils'

export interface EchoDirectoryProps {
  onInvite: (echoId: string) => void
}

export default function EchoDirectory({ onInvite }: EchoDirectoryProps) {
  const navigate = useNavigate()
  const companion = useProfile((s) => s.companion)
  const records = useProfile((s) => s.records)
  const companionEcho = companion ? getEcho(companion.echoId) : undefined

  const online = ECHOES.filter((e) => ECHO_STATUS[e.id] === 'online').length
  const inGame = ECHOES.filter((e) => ECHO_STATUS[e.id] === 'in-game').length

  return (
    <div className="flex flex-col gap-4">
      <div className="panel-bg rounded-[14px] p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="gold-text font-serifsc text-[16px] font-semibold tracking-[.15em]">影从名录</h3>
          <span className="flex items-center gap-2 text-[10px] tracking-wider text-faint">
            <i className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full" style={{ background: STATUS_COLOR.online }} />
            {online} 在线
            <i className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full" style={{ background: STATUS_COLOR['in-game'] }} />
            {inGame} 对局中
          </span>
        </div>

        <div className="mt-3 flex flex-col">
          {ECHOES.map((echo, i) => {
            const status = ECHO_STATUS[echo.id] ?? 'offline'
            const suit = SUIT_META[echo.suit]
            const invitable = status === 'online'
            return (
              <motion.div
                key={echo.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                className="group relative flex h-16 items-center gap-3 border-b border-[rgba(227,194,124,.07)] px-1 transition-all duration-200 last:border-0 hover:translate-x-1"
              >
                {/* 悬停金线左缘 */}
                <span className="absolute left-0 top-2 bottom-2 w-[2px] scale-y-0 bg-gold-300 transition-transform duration-200 group-hover:scale-y-100" />
                <button type="button" onClick={() => navigate(`/agent#echo-${echo.id}`)} className="shrink-0" title={`查看 ${echo.name} 档案`}>
                  <EchoAvatar echo={echo} size={48} status={status} showZodiac />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/agent#echo-${echo.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-serifsc text-[14px] text-bone transition-colors group-hover:text-gold-300">
                      {echo.name}
                    </span>
                    <span
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] tracking-wider"
                      style={{ color: suit.color, background: `${suit.color}14`, border: `1px solid ${suit.color}33` }}
                    >
                      <SuitIcon suit={echo.suit} size={10} />
                      {suit.realm} · {echo.persona}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-faint">
                    <span style={{ color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
                    <span className="font-mono text-dim">胜率 {(echo.winRate * 100).toFixed(0)}%</span>
                  </div>
                </button>
                <button
                  type="button"
                  disabled={!invitable}
                  onClick={() => onInvite(echo.id)}
                  title={invitable ? `邀战 ${echo.name}` : status === 'in-game' ? 'TA 正在牌局中' : 'TA 已离线'}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                    invitable
                      ? 'border-[rgba(227,194,124,.3)] text-gold-300 hover:rotate-6 hover:border-[rgba(246,227,180,.6)] hover:shadow-gold-glow'
                      : 'cursor-not-allowed border-[rgba(227,194,124,.1)] text-faint opacity-50',
                  )}
                >
                  <Swords size={14} />
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* R3 我的影从速览 */}
      {companion && companionEcho && (
        <button
          type="button"
          onClick={() => navigate('/agent')}
          className="panel-bg gold-sweep group flex items-center gap-4 rounded-[14px] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(246,227,180,.4)]"
        >
          <EchoAvatar echo={companionEcho} size={72} showZodiac status="online" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-serifsc text-[16px] text-bone group-hover:text-gold-300">{companion.customName}</span>
              <span className="rounded-full border border-ok/40 bg-ok/10 px-2 py-px text-[9px] tracking-wider text-ok">
                代打授权 ON
              </span>
            </div>
            <div className="mt-1 text-[11px] text-faint">
              契约影从 · {companionEcho.name} · 羁绊 Lv.{companion.bond}
            </div>
            <div className="mt-1 font-mono text-[11px] text-dim">
              并肩战绩 {records.werewolf.won + records.guess.won} 胜{' '}
              {records.werewolf.played - records.werewolf.won + (records.guess.played - records.guess.won)} 负
            </div>
          </div>
        </button>
      )}
    </div>
  )
}

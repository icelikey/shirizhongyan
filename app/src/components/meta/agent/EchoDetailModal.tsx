/**
 * 影从详情 Modal（agent.md §详情 Modal，720px 双栏）。
 * 左：立绘全卡 + 签名台词；右：人设描述 / 战绩档案 / 恩怨记忆（卷轴）/ 行为倾向条 ×5 / 邀战 + 观其牌风。
 * 开启时左卡 rotateY 90→0 翻入，右栏 stagger 淡入。
 */
import { motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '@/store/profile'
import type { Echo } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import MetaModal from '@/components/meta/Modal'
import TendencyBar from '@/components/meta/TendencyBar'
import {
  ECHO_NOTE_SEED,
  ECHO_RADAR,
  ECHO_RIVAL_SEED,
  ECHO_STATUS,
  STATUS_COLOR,
  STATUS_LABEL,
  gameForEcho,
} from '@/components/meta/data'

export interface EchoDetailModalProps {
  echo: Echo | null
  onClose: () => void
  onInvite: (echo: Echo) => void
}

/** 由四维假数据推导五轴行为倾向（1-5） */
const bars = (id: string): { label: string; value: number }[] => {
  const r = ECHO_RADAR[id]
  if (!r) return []
  const to5 = (v: number) => Math.max(1, Math.min(5, Math.round(v / 20)))
  return [
    { label: '计算', value: to5(r.calculation) },
    { label: '欺诈', value: to5(r.deception) },
    { label: '稳健', value: to5(100 - r.aggression) },
    { label: '表达', value: to5(r.psychology) },
    { label: '直觉', value: to5((r.psychology + r.aggression) / 2) },
  ]
}

export default function EchoDetailModal({ echo, onClose, onInvite }: EchoDetailModalProps) {
  const navigate = useNavigate()
  const memory = useProfile((s) => (echo ? s.echoMemories[echo.id] : undefined))

  if (!echo) return null
  const suit = SUIT_META[echo.suit]
  const status = ECHO_STATUS[echo.id] ?? 'offline'
  const game = gameForEcho(echo)
  const invitable = status === 'online' && game !== null
  const seed = ECHO_RIVAL_SEED[echo.id] ?? { won: 0, lost: 0 }
  const rival = memory?.met ? { won: memory.wonAgainst, lost: memory.lostTo } : seed
  const notes = memory?.note?.length ? [...memory.note].reverse() : (ECHO_NOTE_SEED[echo.id] ?? [])

  return (
    <MetaModal open={echo !== null} onClose={onClose} width={720} title={echo.name} sideMark="卷宗">
      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* 左：立绘全卡 + 台词 */}
        <motion.div
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.83, 0, 0.17, 1] }}
          style={{ transformPerspective: 800 }}
          className="flex flex-col gap-3"
        >
          <div
            className="card-frame relative h-[340px] overflow-hidden rounded-[14px]"
            style={{ boxShadow: `0 16px 48px rgba(0,0,0,.6), 0 0 28px ${suit.glow}` }}
          >
            <img src={echo.portrait} alt={echo.name} draggable={false} className="h-full w-full object-cover object-top" />
            <span
              className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] tracking-wider"
              style={{ color: suit.color, background: `${suit.color}1A`, border: `1px solid ${suit.color}44` }}
            >
              <SuitIcon suit={echo.suit} size={11} />
              {suit.realm} · {echo.persona}
            </span>
          </div>
          <blockquote className="rounded-[10px] border-l-2 border-gold-300/60 bg-ink/60 px-3 py-2.5 text-[12px] italic leading-relaxed text-gold-100">
            「{echo.quote}」
          </blockquote>
        </motion.div>

        {/* 右：档案卷宗 */}
        <div className="flex min-w-0 flex-col gap-4">
          {[
            <div key="bio" className="flex flex-col gap-1">
              <span className="text-[11px] tracking-[.2em] text-faint">人设</span>
              {echo.bio.map((line) => (
                <p key={line} className="text-[12px] leading-relaxed text-dim">
                  {line}
                </p>
              ))}
            </div>,

            <div key="stats" className="grid grid-cols-4 gap-2">
              {[
                { k: '总胜率', v: `${(echo.winRate * 100).toFixed(0)}%` },
                { k: '总局数', v: String(echo.games) },
                { k: 'MVP', v: String(Math.round(echo.games * echo.winRate * 0.3)) },
                { k: '天梯位次', v: `#${Math.max(3, 40 - Math.round(echo.winRate * 40))}` },
              ].map((it) => (
                <div key={it.k} className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-2.5 text-center">
                  <div className="font-mono text-[15px] text-bone">{it.v}</div>
                  <div className="mt-0.5 text-[9px] tracking-wider text-faint">{it.k}</div>
                </div>
              ))}
            </div>,

            <div key="notes" className="flex flex-col gap-1.5">
              <span className="text-[11px] tracking-[.2em] text-faint">
                恩怨记忆 · 你 {rival.won} 胜 {rival.lost} 负
              </span>
              <div className="flex max-h-[120px] flex-col gap-1.5 overflow-y-auto pr-1">
                {notes.slice(0, 5).map((n) => (
                  <p key={n} className="rounded-[8px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-3 py-2 text-[11px] leading-relaxed text-dim">
                    {n}
                  </p>
                ))}
              </div>
            </div>,

            <div key="bars" className="flex flex-col gap-1.5">
              <span className="text-[11px] tracking-[.2em] text-faint">行为倾向</span>
              {bars(echo.id).map((b) => (
                <TendencyBar key={b.label} label={b.label} value={b.value} color={suit.color} />
              ))}
            </div>,

            <div key="actions" className="mt-1 flex items-center gap-3">
              <GoldButton
                size="sm"
                disabled={!invitable}
                title={invitable ? `邀战 ${echo.name}` : !game ? '金壤大陆尚未开启' : `TA ${STATUS_LABEL[status]}，暂不可邀战`}
                onClick={() => {
                  onClose()
                  onInvite(echo)
                }}
              >
                <Swords size={14} /> 邀战
              </GoldButton>
              <GoldButton
                size="sm"
                variant="ghost"
                onClick={() => {
                  onClose()
                  navigate('/leaderboard')
                }}
              >
                观其牌风
              </GoldButton>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] tracking-wider" style={{ color: STATUS_COLOR[status] }}>
                <i className="inline-block h-1.5 w-1.5 animate-pulse-dot rounded-full" style={{ background: STATUS_COLOR[status] }} />
                {STATUS_LABEL[status]}
              </span>
            </div>,
          ].map((node, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.07 }}
            >
              {node}
            </motion.div>
          ))}
        </div>
      </div>
    </MetaModal>
  )
}

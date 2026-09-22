/**
 * 大厅「联机大厅」区：真实联机房列表（room.list，10s 轮询）+ 创建/加入联机房。
 * 创建与加入需 Kimi 云登录；seatToken 存 sessionStorage（tdg-seat-<code>）。
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Cloud, DoorOpen, Hammer, Plus, Satellite } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import type { RoomSummary } from '@contracts/room'
import GoldButton from '@/components/GoldButton'
import MaskIcon from '@/components/MaskIcon'
import SuitIcon from '@/components/SuitIcon'
import CreateGameWizard from '@/components/online/CreateGameWizard'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

/** seatToken 持久化 key（GuessOnline 同用） */
export const seatTokenKey = (code: string) => `tdg-seat-${code.toUpperCase()}`

/** 模板徽标（猜数 ♣ / 红眼病 ♥） */
const TEMPLATE_META: Record<RoomSummary['template'], { label: string; color: string }> = {
  numberGuess: { label: '猜数', color: '#4ECB9C' },
  pollDuel: { label: '票决', color: '#EE6A72' },
}

/** 按模板路由到对应游玩页 */
export const onlineRoomPath = (r: Pick<RoomSummary, 'template' | 'code'>) =>
  r.template === 'pollDuel' ? `/game/online-poll/${r.code}` : `/game/online/${r.code}`

const STATUS_META: Record<RoomSummary['status'], { label: string; color: string }> = {
  waiting: { label: '待开局', color: '#4ECB9C' },
  playing: { label: '对局中', color: '#E3C27C' },
  finished: { label: '已终局', color: '#6E6880' },
}

function formatCreatedAt(d: Date): string {
  const date = d instanceof Date ? d : new Date(d)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

export default function OnlineLobbySection() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [nameDraft, setNameDraft] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)

  const roomsQuery = trpc.room.list.useQuery(undefined, { refetchInterval: 10_000 })
  const rooms = roomsQuery.data ?? []

  const createMutation = trpc.room.create.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem(seatTokenKey(res.code), res.seatToken)
      toast('联机房已开', { description: `房码 ${res.code} · 席位虚位以待。` })
      navigate(`/game/online/${res.code}`)
    },
    onError: (err) => toast('开房失败', { description: err.message }),
  })

  const joinMutation = trpc.room.join.useMutation({
    onSuccess: (res, vars) => {
      sessionStorage.setItem(seatTokenKey(res.code), res.seatToken)
      const room = rooms.find((r) => r.code === res.code || r.code === vars.code.toUpperCase())
      navigate(onlineRoomPath({ template: room?.template ?? 'numberGuess', code: res.code }))
    },
    onError: (err) => toast('入座失败', { description: err.message }),
  })

  const requireCloud = (): boolean => {
    if (isAuthenticated) return true
    toast('需先云登录', { description: '联机入座以 Kimi 云端档案为凭，请从右上角玩家芯片前往云登录。' })
    return false
  }

  const handleCreate = () => {
    if (!requireCloud()) return
    createMutation.mutate({ roomName: nameDraft.trim() || undefined })
  }

  const handleJoin = (code: string) => {
    if (!requireCloud()) return
    joinMutation.mutate({ code })
  }

  return (
    <section className="panel-bg rounded-2xl p-5 flex flex-col gap-4">
      {/* 区头 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Satellite size={17} className="text-suit-club" />
          <h2 className="font-serifsc font-semibold text-[18px] text-bone tracking-[.08em]">联机大厅</h2>
          <span className="text-[11px] tracking-[.2em] text-faint hidden sm:inline">真实联机房 · 云端入座 · 10s 轮询</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={32}
            placeholder="房名（可空）"
            className="h-9 w-32 rounded-full border border-bone/12 bg-ink px-3.5 text-[12px] text-bone outline-none placeholder:text-faint focus:border-suit-club/60 transition-colors"
          />
          <GoldButton variant="suit" suit="club" size="sm" disabled={createMutation.isPending} onClick={handleCreate}>
            <Plus size={14} /> 创建联机房
          </GoldButton>
        </div>
      </div>

      {/* ⚒ 创造游戏卡：UGC 三步向导入口 */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onClick={() => {
          if (!requireCloud()) return
          setWizardOpen(true)
        }}
        className="group flex items-center gap-4 rounded-2xl border border-[rgba(227,194,124,.28)] bg-[linear-gradient(120deg,rgba(227,194,124,.08),rgba(176,53,46,.10)_60%,rgba(139,147,248,.08))] px-4 py-3 text-left transition-all hover:border-[rgba(246,227,180,.55)] hover:shadow-[0_0_24px_rgba(227,194,124,.2)]"
      >
        <span className="flex h-10 w-10 shrink-0 rotate-3 items-center justify-center rounded-[8px] bg-[#B0352E] text-white shadow-[0_0_16px_rgba(216,68,60,.35)] transition-transform group-hover:rotate-6">
          <Hammer size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-serifsc text-[15px] font-semibold text-gold-100 tracking-[.06em]">⚒ 创造游戏</span>
          <span className="block text-[11px] text-dim leading-relaxed">
            以 Game SDK 两式模板（猜数博弈 / 红眼病投票）铸你的规则：席位、轮数、倍率、门票、奖励皆由你定。
          </span>
        </span>
        <span className="shrink-0 text-[11px] tracking-[.25em] text-gold-300 group-hover:text-gold-100">开天辟地 →</span>
      </motion.button>

      {/* 房间列表 */}
      {roomsQuery.isLoading ? (
        <p className="text-[12px] text-faint py-3">星网接驳中…</p>
      ) : rooms.length === 0 ? (
        <p className="text-[12px] text-faint py-3 leading-relaxed">
          星网上暂无联机房。开一间算庭，等旅人与外来 Agent 同桌落子。
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rooms.map((r, i) => {
            const meta = STATUS_META[r.status]
            const tpl = TEMPLATE_META[r.template] ?? TEMPLATE_META.numberGuess
            const feeMeta = SUIT_META[r.entryFee.suit]
            const joinable = r.status === 'waiting' && r.seatsTaken < r.seatsTotal
            return (
              <motion.div
                key={r.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex items-center gap-3 rounded-xl border border-[rgba(227,194,124,.12)] bg-ink/40 px-4 py-3 hover:border-[rgba(78,203,156,.35)] transition-colors"
              >
                {/* UGC 「创」字角标 */}
                {!r.isOfficial && (
                  <span className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 -rotate-6 items-center justify-center rounded-[4px] bg-[#B0352E] font-mashan text-[13px] text-white shadow-md">
                    创
                  </span>
                )}
                <span className="font-mono text-[14px] text-gold-300 tracking-[.15em] w-[76px] shrink-0">{r.code}</span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[13px] text-bone truncate">{r.roomName}</span>
                  <span className="flex items-center gap-2 text-[10px] tracking-widest text-faint">
                    <span style={{ color: tpl.color }}>{tpl.label}</span>
                    <span className="truncate">{r.gameName}</span>
                    {r.entryFee.amount > 0 && (
                      <span className="inline-flex items-center gap-0.5" style={{ color: feeMeta.color }}>
                        <SuitIcon suit={r.entryFee.suit} size={10} /> {r.entryFee.amount}
                      </span>
                    )}
                  </span>
                </span>
                {r.hasAgentSeat && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] tracking-widest text-[#9B7FE8]">
                    <MaskIcon src="/icon-mask.svg" size={11} color="#9B7FE8" /> Agent 在席
                  </span>
                )}
                <span className="font-mono text-[12px] text-dim shrink-0">
                  {r.seatsTaken}/{r.seatsTotal} 席
                </span>
                <span
                  className={cn('rounded-full border px-2 py-0.5 text-[10px] tracking-widest shrink-0')}
                  style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }}
                >
                  {meta.label}
                </span>
                <span className="hidden md:inline text-[11px] text-faint shrink-0">{formatCreatedAt(r.createdAt)}</span>
                {joinable ? (
                  <GoldButton variant="ghost" size="sm" disabled={joinMutation.isPending} onClick={() => handleJoin(r.code)}>
                    <DoorOpen size={13} /> 加入
                  </GoldButton>
                ) : (
                  <GoldButton variant="ghost" size="sm" onClick={() => navigate(onlineRoomPath(r))}>
                    旁观
                  </GoldButton>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      {!isAuthenticated && (
        <p className="flex items-center gap-2 text-[11px] text-faint">
          <Cloud size={12} />
          未云登录：可旁观房间，创建/入座需先完成云登录（右上角玩家芯片 → 云登录）。
        </p>
      )}

      <CreateGameWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </section>
  )
}

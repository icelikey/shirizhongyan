/**
 * 创建房间 Modal（lobby.md §C）。
 * 选牌局 → 房间名 → 门票滑块 → 影从填充/风格偏好 → 观战/代打开关。
 * 创建：扣门票 → 朱砂印章「局」落定 → 墨染过渡直入对局（立即入座出发）。
 */
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { SUIT_META } from '@/data/echoes'
import FragmentChip from '@/components/FragmentChip'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import MetaModal from '@/components/meta/Modal'
import MetaSwitch from '@/components/meta/Switch'
import type { MetaGame } from '@/components/meta/data'
import { GAME_META } from '@/components/meta/data'
import { cn } from '@/lib/utils'

const FILL_STYLES = ['均衡', '激进', '老谋深算'] as const

export interface CreateRoomModalProps {
  open: boolean
  onClose: () => void
  /** 墨染过渡跳转 */
  go: (to: string) => void
}

export default function CreateRoomModal({ open, onClose, go }: CreateRoomModalProps) {
  const nickname = useProfile((s) => s.session?.nickname ?? '旅人')
  const fragments = useProfile((s) => s.fragments)
  const spendFragments = useProfile((s) => s.spendFragments)

  const [game, setGame] = useState<MetaGame>('werewolf')
  const [roomName, setRoomName] = useState('')
  const [ticket, setTicket] = useState(15)
  const [fillEcho, setFillEcho] = useState(true)
  const [fillStyle, setFillStyle] = useState<(typeof FILL_STYLES)[number]>('均衡')
  const [allowWatch, setAllowWatch] = useState(true)
  const [allowDelegate, setAllowDelegate] = useState(false)
  const [stamped, setStamped] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // 打开时重置默认房间名与门票
  useEffect(() => {
    if (open) {
      setRoomName(`${nickname}的牌局`)
      setStamped(false)
    }
  }, [open, nickname])

  const meta = GAME_META[game]
  const suit = SUIT_META[meta.suit]
  const balance = fragments[meta.suit]
  const clampTicket = (v: number) => Math.min(meta.ticketMax, Math.max(meta.ticketMin, v))
  const shownTicket = clampTicket(ticket)
  const affordable = balance >= shownTicket

  const switchGame = (g: MetaGame) => {
    setGame(g)
    setTicket(clampTicket(g === 'werewolf' ? 15 : 10))
  }

  const create = () => {
    if (!affordable || stamped) return
    if (!spendFragments(meta.suit, shownTicket)) {
      toast.error('碎片不足，先去对局赢取')
      return
    }
    setStamped(true)
    toast.success(`「${roomName.trim() || `${nickname}的牌局`}」已开桌`, {
      description: `消耗 ${shownTicket}${suit.symbol} · ${fillEcho ? `影从补满（${fillStyle}）` : '静候真人'}`,
    })
    timers.current.push(
      setTimeout(() => {
        onClose()
        go(`/game/${game}/${Date.now()}`)
      }, 1100),
    )
  }

  return (
    <MetaModal open={open} onClose={onClose} title="开一桌牌局" sideMark="设局" width={560}>
      <div className="relative flex flex-col gap-5">
        {/* 1. 选择牌局 */}
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(GAME_META) as MetaGame[]).map((g) => {
            const m = GAME_META[g]
            const s = SUIT_META[m.suit]
            const sel = game === g
            return (
              <button
                key={g}
                type="button"
                onClick={() => switchGame(g)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-[12px] border bg-ink/60 p-4 transition-all duration-200 ease-ink',
                  sel ? 'border-transparent' : 'border-[rgba(227,194,124,.14)] hover:border-[rgba(227,194,124,.35)]',
                )}
                style={sel ? { border: `1px solid ${s.color}`, boxShadow: `0 0 20px ${s.glow}`, background: `${s.color}0F` } : undefined}
              >
                <span style={{ color: s.color }}>
                  <SuitIcon suit={m.suit} size={28} glow={sel} />
                </span>
                <span className="font-serifsc text-[15px] text-bone">{m.name}</span>
                <span className="text-[10px] tracking-wider text-faint">
                  {g === 'werewolf' ? '♠ 玄渊主场 · 6 人昼夜局' : '♣ 青野主场 · 6 人出数局'}
                </span>
              </button>
            )
          })}
        </div>

        {/* 2. 房间名 */}
        <label className="flex flex-col gap-2">
          <span className="text-[12px] tracking-[.2em] text-dim">房间名</span>
          <input
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={16}
            placeholder={`${nickname}的牌局`}
            className="h-11 rounded-[10px] border border-[rgba(227,194,124,.2)] bg-ink px-3.5 text-[14px] text-bone outline-none transition-colors focus:border-[rgba(246,227,180,.55)]"
          />
        </label>

        {/* 3. 门票 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] tracking-[.2em] text-dim">门票</span>
            <span className="flex items-center gap-2 text-[11px] text-faint">
              你的余额 <FragmentChip suit={meta.suit} count={balance} size="sm" />
            </span>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={meta.ticketMin}
              max={meta.ticketMax}
              step={5}
              value={shownTicket}
              onChange={(e) => setTicket(Number(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[rgba(227,194,124,.15)] accent-gold-300"
            />
            <FragmentChip suit={meta.suit} count={shownTicket} size="md" />
          </div>
          <span className="text-[10px] tracking-wider text-faint">
            {meta.name}门票区间 {meta.ticketMin}–{meta.ticketMax}{suit.symbol} · 步进 5
          </span>
        </div>

        {/* 4. 影从填充 + 风格偏好 */}
        <div className="flex flex-col gap-3 rounded-[12px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-bone">空位由影从补满</span>
            <MetaSwitch checked={fillEcho} onChange={setFillEcho} label="空位由影从补满" />
          </div>
          {fillEcho && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-faint">风格偏好</span>
              <div className="flex gap-1.5">
                {FILL_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFillStyle(s)}
                    className={cn(
                      'h-7 rounded-full border px-3 text-[11px] tracking-wider transition-all duration-200',
                      fillStyle === s
                        ? 'border-gold-300/70 bg-gold-300/15 text-gold-300'
                        : 'border-[rgba(227,194,124,.15)] text-dim hover:text-bone',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. 观战 / 代打 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-[12px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-3.5">
            <span className="text-[13px] text-bone">允许观战</span>
            <MetaSwitch checked={allowWatch} onChange={setAllowWatch} label="允许观战" />
          </div>
          <div className="flex items-center justify-between rounded-[12px] border border-[rgba(227,194,124,.1)] bg-ink/50 p-3.5">
            <span className="text-[13px] text-bone">允许影从代打</span>
            <MetaSwitch checked={allowDelegate} onChange={setAllowDelegate} label="允许影从代打" />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="mt-1 flex items-center justify-between gap-3">
          {!affordable && <span className="text-[12px] text-cinnabar-hi">碎片不足，先去对局赢取</span>}
          <span className="flex-1" />
          <GoldButton variant="ghost" size="md" onClick={onClose}>
            取消
          </GoldButton>
          <GoldButton
            variant={affordable ? 'gold' : 'danger'}
            size="md"
            onClick={create}
            disabled={!affordable || stamped}
            className="min-w-[180px]"
          >
            消耗 {shownTicket}
            {suit.symbol} · 创建
          </GoldButton>
        </div>

        {/* 印章「局」落定演出 */}
        {stamped && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              initial={{ scale: 1.6, rotate: 18, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              className="seal-stamp flex h-24 w-24 items-center justify-center text-[52px]"
            >
              局
            </motion.span>
          </motion.div>
        )}
      </div>
    </MetaModal>
  )
}

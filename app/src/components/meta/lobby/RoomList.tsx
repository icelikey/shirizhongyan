/**
 * 房间区（lobby.md §中栏）：筛选 Tabs + 房间卡列表 + 空态。
 * 点「入座」→ 扣费确认弹层 → 墨染过渡进对局；「观战」直入；
 * 点卡体 → 房间详情 Drawer（席位名单 / 规则 / 聊天记录预留位）。
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, Lock, X } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import type { Suit } from '@/data/echoes'
import { SUIT_META, getEcho } from '@/data/echoes'
import FragmentChip from '@/components/FragmentChip'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import MetaModal from '@/components/meta/Modal'
import { GAME_META } from '@/components/meta/data'
import type { LobbyRoom, Seat } from '@/components/meta/lobby/rooms'
import { seatCount } from '@/components/meta/lobby/rooms'
import { cn } from '@/lib/utils'
import { MATCH_MODE_META } from '@contracts/matchMode'

type TabKey = 'all' | 'werewolf' | 'guess'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'werewolf', label: '♠ 狼人杀' },
  { key: 'guess', label: '♣ 猜平均数' },
]

/** 爬塔假房（game==='spire'，S2 扩展）展示元信息兜底 */
const roomGameMeta = (game: LobbyRoom['game']): { name: string; suit: Suit } =>
  game === 'spire' ? { name: '碎境爬塔', suit: 'diamond' } : GAME_META[game]

function SeatAvatar({ seat }: { seat: NonNullable<Seat> }) {
  if (seat === 'human') {
    return (
      <img
        src="/avatar-traveler.png"
        alt="旅人"
        width={28}
        height={28}
        className="h-7 w-7 rounded-full border border-gold-300/40 object-cover"
        title="旅人"
      />
    )
  }
  const echo = getEcho(seat.slice(5))
  if (!echo) return null
  return (
    <img
      src={echo.portrait}
      alt={echo.name}
      width={28}
      height={28}
      className="h-7 w-7 rounded-full border border-gold-300/40 object-cover object-top"
      title={`影从 · ${echo.name}`}
    />
  )
}

export interface RoomListProps {
  rooms: LobbyRoom[]
  /** 墨染过渡跳转 */
  go: (to: string) => void
  onCreate: () => void
}

export default function RoomList({ rooms, go, onCreate }: RoomListProps) {
  const spendFragments = useProfile((s) => s.spendFragments)
  const fragments = useProfile((s) => s.fragments)
  const [tab, setTab] = useState<TabKey>('all')
  const [joining, setJoining] = useState<LobbyRoom | null>(null)
  const [detail, setDetail] = useState<LobbyRoom | null>(null)

  const filtered = tab === 'all' ? rooms : rooms.filter((r) => r.game === tab)

  const confirmJoin = () => {
    if (!joining) return
    if (joining.game === 'spire') {
      // 防御：爬塔房不入座，直转门厅（正常路径走不到这里）
      setJoining(null)
      go('/game/spire')
      return
    }
    const suit = GAME_META[joining.game].suit
    if (!spendFragments(suit, joining.ticket)) {
      toast.error('碎片不足，先去对局赢取', { description: `门票 ${joining.ticket}${SUIT_META[suit].symbol}` })
      setJoining(null)
      return
    }
    toast(`已扣门票 -${joining.ticket}${SUIT_META[suit].symbol}`, { description: `入座「${joining.name}」` })
    const game = joining.game
    setJoining(null)
    go(`/game/${game}/${Date.now()}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'relative h-8 rounded-full px-4 text-[12px] tracking-[.15em] transition-all duration-200',
              tab === t.key
                ? 'bg-gold-300 font-semibold text-[#2A1E0C]'
                : 'border border-[rgba(227,194,124,.2)] text-dim hover:border-[rgba(246,227,180,.45)] hover:text-gold-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 房间卡列表 */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-bg flex flex-col items-center gap-5 rounded-[14px] px-6 py-12"
        >
          <img src="/empty-room.png" alt="空牌桌" className="w-[260px] rounded-lg opacity-80" draggable={false} />
          <p className="vertical-rl h-[150px] font-mashan text-[16px] text-faint">今夜尚无牌局，何不开一桌？</p>
          <GoldButton variant="ghost" onClick={onCreate}>
            ＋ 创建房间
          </GoldButton>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((room, i) => {
              const meta = roomGameMeta(room.game)
              const suit = SUIT_META[meta.suit]
              const taken = seatCount(room)
              const locked = room.status === 'locked'
              return (
                <motion.div
                  key={room.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.32, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => !locked && (room.game === 'spire' ? go('/game/spire') : setDetail(room))}
                  className={cn(
                    'gold-sweep group relative flex min-h-[96px] items-center gap-4 rounded-[12px] border border-[rgba(227,194,124,.18)] bg-panel p-4 transition-all duration-200 ease-ink',
                    locked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:-translate-y-1 hover:border-[rgba(246,227,180,.4)]',
                  )}
                  style={{ ['--room-glow' as string]: suit.glow }}
                  title={locked ? room.lockTip : undefined}
                >
                  {/* 左：游戏徽记块 */}
                  <span
                    className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[10px]"
                    style={{ background: `${suit.color}1F`, color: suit.color }}
                  >
                    <SuitIcon suit={meta.suit} size={26} glow />
                    <span className="text-[9px] tracking-[.15em]">
                      {room.game === 'werewolf' ? '狼人杀' : room.game === 'guess' ? '猜平均数' : '碎境爬塔'}
                    </span>
                  </span>

                  {/* 中：房间名 + 房主 + 标签 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate font-serifsc text-[15px] text-bone">{room.name}</h4>
                      {locked && <Lock size={13} className="shrink-0 text-faint" />}
                    </div>
                    <p className="mt-0.5 text-[12px] text-dim">
                      房主 · {room.host}
                      {room.hostIsEcho ? '（影从）' : '（旅人）'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] tracking-wider"
                        style={{ color: MATCH_MODE_META[room.matchMode].color, borderColor: `${MATCH_MODE_META[room.matchMode].color}55`, background: `${MATCH_MODE_META[room.matchMode].color}12` }}
                      >
                        {MATCH_MODE_META[room.matchMode].shortLabel}
                      </span>
                      {room.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-[rgba(227,194,124,.18)] px-2 py-0.5 text-[10px] tracking-wider text-dim"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 右：座位 + 门票 + 状态 + 按钮 */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      {room.seats.map((s, j) =>
                        s ? (
                          <SeatAvatar key={j} seat={s} />
                        ) : (
                          <span key={j} className="h-7 w-7 rounded-full border border-dashed border-[rgba(227,194,124,.3)]" title="空位" />
                        ),
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <FragmentChip suit={meta.suit} count={room.ticket} size="sm" />
                      {room.status === 'waiting' && (
                        <span className="rounded-full bg-gold-300/15 px-2 py-0.5 text-[10px] tracking-wider text-gold-300">
                          等待中 {taken}/6
                        </span>
                      )}
                      {room.status === 'playing' && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tracking-wider text-faint">游戏中 · 可观战</span>
                      )}
                      {locked && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] tracking-wider text-faint">未开启</span>
                      )}
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      {room.status === 'waiting' && (
                        <GoldButton size="sm" onClick={() => setJoining(room)}>
                          入座
                        </GoldButton>
                      )}
                      {room.status === 'playing' && (
                        <GoldButton
                          size="sm"
                          variant="ghost"
                          onClick={() => (room.game === 'spire' ? go('/game/spire') : go(`/game/${room.game}/${Date.now()}`))}
                        >
                          <Eye size={13} /> 观战
                        </GoldButton>
                      )}
                      {locked && (
                        <GoldButton size="sm" variant="ghost" disabled>
                          待启
                        </GoldButton>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 入座确认弹层 */}
      <MetaModal open={joining !== null} onClose={() => setJoining(null)} title="确认入座" width={420}>
        {joining && (
          <div className="flex flex-col gap-4">
            <p className="text-[14px] text-bone">
              「{joining.name}」 · {roomGameMeta(joining.game).name}
            </p>
            <div className="flex items-center justify-between rounded-[10px] border border-[rgba(227,194,124,.12)] bg-ink/60 p-3 text-[13px]">
              <span className="text-dim">门票</span>
              <FragmentChip suit={roomGameMeta(joining.game).suit} count={joining.ticket} size="md" />
            </div>
            <div className="flex items-center justify-between rounded-[10px] border border-[rgba(227,194,124,.12)] bg-ink/60 p-3 text-[13px]">
              <span className="text-dim">你的余额</span>
              <FragmentChip suit={roomGameMeta(joining.game).suit} count={fragments[roomGameMeta(joining.game).suit]} size="md" />
            </div>
            <div className="flex justify-end gap-3">
              <GoldButton variant="ghost" size="sm" onClick={() => setJoining(null)}>
                再想想
              </GoldButton>
              <GoldButton size="sm" onClick={confirmJoin}>
                支付并入座
              </GoldButton>
            </div>
          </div>
        )}
      </MetaModal>

      {/* 房间详情 Drawer（右滑入 380px） */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-0 z-[80] bg-abyss/70 backdrop-blur-[8px]"
              onClick={() => setDetail(null)}
            />
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 top-0 z-[81] flex w-[380px] max-w-[90vw] flex-col gap-5 overflow-y-auto border-l border-[rgba(227,194,124,.15)] bg-panel p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="gold-text font-serifsc text-[18px] tracking-[.1em]">房间详情</h3>
                <button type="button" onClick={() => setDetail(null)} className="text-faint transition-colors hover:text-gold-300">
                  <X size={18} />
                </button>
              </div>
              <div>
                <h4 className="font-serifsc text-[17px] text-bone">{detail.name}</h4>
                <p className="mt-1 text-[12px] text-dim">
                  {roomGameMeta(detail.game).name} · 房主 {detail.host}
                  {detail.hostIsEcho ? '（影从）' : '（旅人）'} · 门票 {detail.ticket}
                  {SUIT_META[roomGameMeta(detail.game).suit].symbol}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[12px] tracking-[.2em] text-dim">席位名单 {seatCount(detail)}/6</span>
                {detail.seats.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-3 py-2"
                  >
                    {s ? (
                      <>
                        <SeatAvatar seat={s} />
                        <span className="text-[13px] text-bone">
                          {s === 'human' ? '旅人' : `影从 · ${getEcho(s.slice(5))?.name ?? '未知'}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-7 w-7 rounded-full border border-dashed border-[rgba(227,194,124,.3)]" />
                        <span className="text-[13px] text-faint">虚位以待</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] tracking-[.2em] text-dim">房间规则</span>
                <p className="text-[12px] leading-relaxed text-faint">
                  {detail.game === 'werewolf'
                    ? '6 人局 · 2 狼 1 预言家 1 女巫 2 平民 · 夜晚 40s / 发言 60s / 投票 30s'
                    : '6 人局 · 5 轮秘密出数（0-100）· 目标 = 均值 × 0.8 · 每轮 30s'}
                </p>
                <p className="mt-2 text-[12px] text-suit-diamond">参与方式 · {MATCH_MODE_META[detail.matchMode].label}</p>
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-[12px] tracking-[.2em] text-dim">聊天记录</span>
                <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-[rgba(227,194,124,.15)] p-6 text-[11px] text-faint">
                  牌桌内的低语，入座后方可闻
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

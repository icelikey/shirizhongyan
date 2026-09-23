/**
 * 大厅 `/lobby`（design/lobby.md）—— 登录后默认落点。
 * 三栏：左 行动区（快速匹配 / 创建房间 / 我的数据）｜中 房间区（Tabs + 房间卡）｜右 情报区（十日播报 / 影从名录 / 我的影从）。
 * ≥1024 应用壳内各栏自滚动；<1024 单栏堆叠。
 */
import { useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { getEcho } from '@/data/echoes'
import GoldButton from '@/components/GoldButton'
import { useInkTransition } from '@/components/meta/InkTransition'
import { useInviteEcho } from '@/components/meta/useInviteEcho'
import QuickMatchCard from '@/components/meta/lobby/QuickMatchCard'
import MyStatsCard from '@/components/meta/lobby/MyStatsCard'
import CreateRoomModal from '@/components/meta/lobby/CreateRoomModal'
import RoomList from '@/components/meta/lobby/RoomList'
import BroadcastCard from '@/components/meta/lobby/BroadcastCard'
import EchoDirectory from '@/components/meta/lobby/EchoDirectory'
import SpireLobbyCard from '@/components/spire/SpireLobbyCard'
import OnlineLobbySection from '@/components/online/OnlineLobbySection'
import { LOBBY_ROOMS, SPIRE_WATCH_ROOMS } from '@/components/meta/lobby/rooms'
import type { LobbyRoom } from '@/components/meta/lobby/rooms'
import ParticipationModes from '@/components/online/ParticipationModes'
import type { MatchMode } from '@contracts/matchMode'

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

export default function Lobby() {
  const { inkNode, go } = useInkTransition()
  const records = useProfile((s) => s.records)

  const [rooms, setRooms] = useState<LobbyRoom[]>([...LOBBY_ROOMS, ...SPIRE_WATCH_ROOMS])
  const [mode, setMode] = useState<MatchMode | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [spin, setSpin] = useState(0)

  const invite = useInviteEcho({ go })
  const handleInvite = useCallback(
    (echoId: string) => {
      const echo = getEcho(echoId)
      if (echo) invite(echo)
    },
    [invite],
  )

  /** 刷新：旋转图标 + 重新拉取（原型：重排并微调等待座位） */
  const refresh = () => {
    setSpin((s) => s + 360)
    setRooms((prev) =>
      [...prev]
        .map((r) => ({ r, k: Math.random() }))
        .sort((a, b) => a.k - b.k)
        .map(({ r }) => r),
    )
    toast('房间列表已刷新', { description: '牌桌灯火，随时更替。' })
  }

  const todayGame = records.guess.played + records.werewolf.played + 1

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-6 lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <div className="flex h-full flex-col gap-6 lg:flex-row">
        {/* 左栏 · 行动区 300px */}
        <motion.aside {...enter(0.1)} className="flex w-full shrink-0 flex-col gap-4 lg:w-[300px] lg:overflow-y-auto lg:pr-1">
          <QuickMatchCard go={go} />
          {/* 碎境爬塔 · 第三张入口卡（S2 扩展） */}
          <SpireLobbyCard go={go} />
          <GoldButton size="lg" className="w-full" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> 创建房间
          </GoldButton>
          <MyStatsCard />
        </motion.aside>

        {/* 中栏 · 房间区（主滚动） */}
        <motion.section {...enter(0.22)} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="gold-text font-serifsc text-[34px] font-black leading-tight tracking-[.1em]">大厅</h1>
              <p className="mt-1 text-[12px] tracking-[.25em] text-faint">牌局之间 · 今日第 {todayGame} 局等你入座</p>
            </div>
            <button
              type="button"
              onClick={refresh}
              title="刷新房间"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(227,194,124,.25)] text-gold-300 transition-colors hover:border-[rgba(246,227,180,.55)]"
            >
              <motion.span animate={{ rotate: spin }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="flex">
                <RefreshCw size={16} />
              </motion.span>
            </button>
          </div>
          <ParticipationModes selected={mode} onSelect={setMode} compact />
          <RoomList rooms={mode ? rooms.filter((room) => room.matchMode === mode) : rooms} go={go} onCreate={() => setCreateOpen(true)} />
          {/* 联机大厅：真实联机房（云端入座 / Agent 同席） */}
          <OnlineLobbySection />
        </motion.section>

        {/* 右栏 · 情报区 320px */}
        <motion.aside {...enter(0.34)} className="flex w-full shrink-0 flex-col gap-4 lg:w-[320px] lg:overflow-y-auto lg:pr-1">
          <BroadcastCard />
          <EchoDirectory onInvite={handleInvite} />
        </motion.aside>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} go={go} />
      {inkNode}
    </div>
  )
}

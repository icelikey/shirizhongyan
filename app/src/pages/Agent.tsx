/**
 * 影从档案 `/agent`（design/agent.md）。
 * 左区 460px（sticky）：契约影从养成 —— 立绘主卡 / 心性烙印 / 胜率档案 / 记忆之匣 / 代打授权。
 * 右区：常驻影从图鉴 8 位（大卡网格 + 详情 Modal）。
 * URL #echo-<id> 自动打开对应影从详情（大厅「邀战 / 查看档案」跳入）。
 */
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ChevronRight, KeyRound } from 'lucide-react'
import { useProfile } from '@/store/profile'
import { ECHOES, getEcho } from '@/data/echoes'
import type { Echo } from '@/data/echoes'
import SectionHeader from '@/components/meta/SectionHeader'
import { useInkTransition } from '@/components/meta/InkTransition'
import { useInviteEcho } from '@/components/meta/useInviteEcho'
import CompanionPortraitCard from '@/components/meta/agent/CompanionPortraitCard'
import StyleGrid from '@/components/meta/agent/StyleGrid'
import RecordPanel from '@/components/meta/agent/RecordPanel'
import MemoryBox from '@/components/meta/agent/MemoryBox'
import DelegatePanel from '@/components/meta/agent/DelegatePanel'
import EchoGalleryCard from '@/components/meta/agent/EchoGalleryCard'
import EchoDetailModal from '@/components/meta/agent/EchoDetailModal'

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

export default function Agent() {
  const { inkNode, go } = useInkTransition()
  const invite = useInviteEcho({ go })
  const companion = useProfile((s) => s.companion)
  const [detail, setDetail] = useState<Echo | null>(null)
  const [delegateOn, setDelegateOn] = useState(false)

  /* #echo-<id> 自动打开详情 */
  useEffect(() => {
    const m = window.location.hash.match(/^#echo-([\w-]+)$/)
    if (m) {
      const echo = getEcho(m[1])
      if (echo) setDetail(echo)
    }
  }, [])

  const bond = companion?.bond ?? 0

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      <motion.div {...enter(0)} className="mb-8">
        <h1 className="gold-text font-serifsc text-[34px] font-black leading-tight tracking-[.1em]">影从档案</h1>
        <p className="mt-1 text-[12px] tracking-[.25em] text-faint">灯下拭卷 · 契约与恩怨皆有录</p>
      </motion.div>

      <div className="flex flex-col gap-10 lg:flex-row">
        {/* 左区 · 我的契约影从 460px */}
        <motion.aside {...enter(0.1)} className="w-full shrink-0 self-start lg:sticky lg:top-20 lg:w-[460px]">
          <div className="flex flex-col gap-8">
            <div>
              <CompanionPortraitCard delegateOn={delegateOn} />
              {/* 羁绊 */}
              <div className="mx-auto mt-4 w-[320px]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] tracking-[.2em] text-dim">羁绊</span>
                  <span className="font-mono text-[12px] text-gold-300">Lv.{bond}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(227,194,124,.12)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, bond)}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full bg-gold-300"
                    style={{ boxShadow: '0 0 8px rgba(227,194,124,.6)' }}
                  />
                </div>
                <p className="mt-1 text-[10px] tracking-wider text-faint">对局与互动滋养羁绊 · 满 100 升华</p>
              </div>
            </div>

            <StyleGrid />
            <RecordPanel />
            <MemoryBox />
            <DelegatePanel onChange={setDelegateOn} />

            {/* 我的 Agent Keys · Agent Gateway 门户入口 */}
            <Link
              to="/agent-portal"
              className="panel-bg rounded-2xl p-4 flex items-center gap-3 border border-transparent hover:border-suit-diamond/50 transition-colors group"
            >
              <span className="w-10 h-10 rounded-full border border-suit-diamond/40 bg-suit-diamond/10 flex items-center justify-center shrink-0">
                <KeyRound size={17} className="text-suit-diamond" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] text-bone font-serifsc">我的 Agent Keys</span>
                <span className="block text-[11px] text-faint mt-0.5">Agent Gateway 门户 · 带自己的 Agent 来打</span>
              </span>
              <ChevronRight size={16} className="text-faint group-hover:text-suit-diamond group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          </div>
        </motion.aside>

        {/* 右区 · 常驻影从图鉴 */}
        <motion.section {...enter(0.2)} className="min-w-0 flex-1">
          <SectionHeader
            title="常驻影从图鉴"
            subtitle="8 位影从 · 与旅人同桌轮回"
            sideMark="名录"
            right={
              <span className="text-[11px] tracking-wider text-faint">
                点卡查看卷宗 · 「邀战」即刻成局
              </span>
            }
          />
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {ECHOES.map((echo, i) => (
              <EchoGalleryCard key={echo.id} echo={echo} index={i} onOpen={setDetail} />
            ))}
          </div>
        </motion.section>
      </div>

      <EchoDetailModal echo={detail} onClose={() => setDetail(null)} onInvite={invite} />
      {inkNode}
    </div>
  )
}

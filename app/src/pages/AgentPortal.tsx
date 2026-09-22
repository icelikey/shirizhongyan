/**
 * ============================================================================
 * Agent Gateway 门户 · /agent-portal
 * ----------------------------------------------------------------------------
 * 面向「带自己的 Agent 来打」的旅人：
 * ① 注册 API Key（明文仅此一次，弹层 + 复制 + 朱砂印章）；
 * ② 我的 Key 列表（prefix / 最近使用 / 吊销）；
 * ③ 快速开始（协议五步精简版，完整见图鉴第玖章 /codex#dev）；
 * ④ 在线房间速查（gatewayRooms 等价于 room.list 的展示）。
 * 注册 / 列表 / 吊销需 Kimi 云登录。
 * ============================================================================
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { BookOpen, Check, Cloud, Copy, KeyRound, Plus, Satellite, ShieldOff } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import { useAuth } from '@/hooks/useAuth'
import { LOGIN_PATH } from '@/const'
import GoldButton from '@/components/GoldButton'
import GameModal from '@/components/game/GameModal'
import DevQuickStart from '@/components/online/DevQuickStart'
import MaskIcon from '@/components/MaskIcon'
import { cn } from '@/lib/utils'

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
})

function fmtTime(d: Date | null | undefined): string {
  if (!d) return '尚未使用'
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleString('zh-CN', { hour12: false })
}

export default function AgentPortal() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const utils = trpc.useUtils()

  /* ---------------- Key 注册 ---------------- */
  const [nameDraft, setNameDraft] = useState('')
  const [freshKey, setFreshKey] = useState<{ key: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const registerMutation = trpc.agent.register.useMutation({
    onSuccess: (res) => {
      setFreshKey({ key: res.key, name: nameDraft.trim() })
      setNameDraft('')
      setCopied(false)
      void utils.agent.list.invalidate()
    },
    onError: (err) => toast('铸钥失败', { description: err.message }),
  })

  /* ---------------- Key 列表 ---------------- */
  const keysQuery = trpc.agent.list.useQuery(undefined, { enabled: isAuthenticated })
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null)
  const revokeMutation = trpc.agent.revoke.useMutation({
    onSuccess: () => {
      toast('Key 已吊销', { description: '此钥即刻作废，城门不再为其开启。' })
      setConfirmRevoke(null)
      void utils.agent.list.invalidate()
    },
    onError: (err) => toast('吊销失败', { description: err.message }),
  })

  /* ---------------- 在线房间速查（gatewayRooms ≡ room.list） ---------------- */
  const roomsQuery = trpc.room.list.useQuery(undefined, { refetchInterval: 10_000 })
  const rooms = roomsQuery.data ?? []

  const copyKey = () => {
    if (!freshKey) return
    void navigator.clipboard?.writeText(freshKey.key).then(
      () => {
        setCopied(true)
        toast('Key 已复制', { description: '请即刻存入你的 Agent 配置——明文不再示人。' })
      },
      () => toast('复制失败', { description: '请手动框选复制。' }),
    )
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      {/* 页头 */}
      <motion.div {...enter(0)} className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="gold-text font-serifsc text-[34px] font-black leading-tight tracking-[.1em]">Agent Gateway</h1>
          <p className="mt-1 text-[12px] tracking-[.25em] text-faint">带自己的 Agent 来打 · 同席同权 · 座位不看出身</p>
        </div>
        <Link
          to="/codex#dev"
          className="inline-flex items-center gap-2 text-[12px] tracking-wider text-suit-diamond hover:text-gold-300 transition-colors"
        >
          <BookOpen size={14} /> 完整协议文档 · 图鉴第玖章
        </Link>
      </motion.div>

      {!isAuthenticated && !authLoading && (
        <motion.div {...enter(0.05)} className="mb-6 rounded-2xl border border-[rgba(242,169,59,.3)] bg-[rgba(242,169,59,.06)] p-5 flex items-center gap-4 flex-wrap">
          <Cloud size={18} className="text-suit-diamond shrink-0" />
          <p className="text-[13px] text-dim flex-1 min-w-[220px] leading-relaxed">
            铸钥、管钥需以 Kimi 云端档案为凭。登录后此处即刻开工；房间速查与协议文档无需登录。
          </p>
          <GoldButton variant="gold" size="sm" onClick={() => navigate(LOGIN_PATH)}>云登录</GoldButton>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左栏：铸钥 + 我的 Keys */}
        <motion.div {...enter(0.1)} className="flex flex-col gap-6 min-w-0">
          {/* 注册 */}
          <section className="panel-bg rounded-2xl p-5">
            <h2 className="font-serifsc font-semibold text-[18px] text-bone flex items-center gap-2 mb-1">
              <KeyRound size={17} className="text-suit-diamond" /> 注册 Agent Key
            </h2>
            <p className="text-[12px] text-faint mb-4">以名为引，铸一柄 tdg_ 密钥 · 明文仅示人一次</p>
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={64}
                placeholder="Agent 名号（如 oracle-v3）"
                disabled={!isAuthenticated || registerMutation.isPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameDraft.trim() && isAuthenticated) registerMutation.mutate({ name: nameDraft.trim() })
                }}
                className="h-10 flex-1 min-w-0 rounded-full border border-bone/12 bg-ink px-4 text-[13px] text-bone outline-none placeholder:text-faint focus:border-suit-diamond/60 transition-colors disabled:opacity-40"
              />
              <GoldButton
                variant="suit"
                suit="diamond"
                size="sm"
                className="h-10"
                disabled={!isAuthenticated || !nameDraft.trim() || registerMutation.isPending}
                onClick={() => registerMutation.mutate({ name: nameDraft.trim() })}
              >
                <Plus size={14} /> {registerMutation.isPending ? '铸钥中…' : '铸钥'}
              </GoldButton>
            </div>
          </section>

          {/* Key 列表 */}
          <section className="panel-bg rounded-2xl p-5">
            <h2 className="font-serifsc font-semibold text-[18px] text-bone mb-4">我的 Agent Keys</h2>
            {!isAuthenticated ? (
              <p className="text-[12px] text-faint py-2">云登录后可见。</p>
            ) : keysQuery.isLoading ? (
              <p className="text-[12px] text-faint py-2">钥匣开启中…</p>
            ) : (keysQuery.data ?? []).length === 0 ? (
              <p className="text-[12px] text-faint py-2 leading-relaxed">钥匣空空。铸一柄钥，放你的 Agent 入局。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(keysQuery.data ?? []).map((k) => (
                  <div
                    key={k.id}
                    className={cn(
                      'rounded-xl border px-4 py-3 flex items-center gap-3',
                      k.active ? 'border-[rgba(227,194,124,.14)] bg-ink/40' : 'border-[rgba(216,68,60,.25)] bg-[rgba(216,68,60,.05)] opacity-70',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-bone truncate">{k.name}</span>
                        {!k.active && <span className="text-[10px] tracking-widest text-cinnabar-hi">已吊销</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-faint flex-wrap">
                        <span className="font-mono text-suit-diamond">{k.prefix}…</span>
                        <span>最近使用 · {fmtTime(k.lastUsedAt)}</span>
                        <span className="hidden sm:inline">铸于 · {fmtTime(k.createdAt)}</span>
                      </div>
                    </div>
                    {k.active &&
                      (confirmRevoke === k.id ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <GoldButton
                            variant="danger"
                            size="sm"
                            disabled={revokeMutation.isPending}
                            onClick={() => revokeMutation.mutate({ id: k.id })}
                          >
                            确认吊销
                          </GoldButton>
                          <GoldButton variant="ghost" size="sm" onClick={() => setConfirmRevoke(null)}>留钥</GoldButton>
                        </div>
                      ) : (
                        <GoldButton variant="ghost" size="sm" className="shrink-0" onClick={() => setConfirmRevoke(k.id)}>
                          <ShieldOff size={13} /> 吊销
                        </GoldButton>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 在线房间速查 */}
          <section className="panel-bg rounded-2xl p-5">
            <h2 className="font-serifsc font-semibold text-[18px] text-bone flex items-center gap-2 mb-1">
              <Satellite size={17} className="text-suit-club" /> 在线房间速查
            </h2>
            <p className="text-[12px] text-faint mb-4">即 Agent 协议 gatewayRooms 所见 · 10s 轮询</p>
            {rooms.length === 0 ? (
              <p className="text-[12px] text-faint py-2">星网上暂无联机房。</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <div key={r.code} className="flex items-center gap-3 rounded-xl border border-[rgba(227,194,124,.12)] bg-ink/40 px-4 py-2.5">
                    <span className="font-mono text-[13px] text-gold-300 tracking-[.15em] w-[76px] shrink-0">{r.code}</span>
                    <span className="text-[13px] text-bone truncate flex-1 min-w-0">{r.roomName}</span>
                    {r.hasAgentSeat && <MaskIcon src="/icon-mask.svg" size={12} color="#9B7FE8" alt="Agent 在席" />}
                    <span className="font-mono text-[12px] text-dim shrink-0">{r.seatsTaken}/{r.seatsTotal} 席</span>
                    <span className="text-[11px] text-faint shrink-0">
                      {r.status === 'waiting' ? '待开局' : r.status === 'playing' ? '对局中' : '已终局'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </motion.div>

        {/* 右栏：快速开始 */}
        <motion.section {...enter(0.2)} className="panel-bg rounded-2xl p-5 min-w-0 self-start">
          <h2 className="font-serifsc font-semibold text-[18px] text-bone mb-1">快速开始 · 协议五步</h2>
          <p className="text-[12px] text-faint mb-4">
            Base URL <code className="font-mono text-suit-diamond">/api/trpc</code> · batch 模式 · 鉴权头{' '}
            <code className="font-mono text-suit-diamond">x-api-key</code>
          </p>
          <DevQuickStart compact />
          <div className="mt-5 rounded-xl border border-[rgba(242,169,59,.22)] bg-[rgba(242,169,59,.05)] p-4">
            <p className="text-[12px] text-dim leading-relaxed">
              观测契约：gatewayObserve 仅返回本座位视角——揭晓前他人数字不可见；每轮 30s 提交窗，超时按 50 兜底。
              礼节：单 Key 同时只占 1 席，滥用吊销。
            </p>
          </div>
        </motion.section>
      </div>

      {/* 一次性 Key 弹层（朱砂印章） */}
      <GameModal open={freshKey != null} title="密钥铸成 · 仅此一示" onClose={() => setFreshKey(null)} className="max-w-[560px]">
        {freshKey && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-dim text-center leading-relaxed">
              「{freshKey.name}」之钥已铸。<span className="text-cinnabar-hi">明文唯此一次示人</span>，服务端只存散列——
              请即刻复制，妥藏于你的 Agent。
            </p>
            <div className="relative rounded-xl border border-suit-diamond/50 bg-abyss/80 px-4 py-4">
              <code className="block font-mono text-[13px] text-gold-100 break-all leading-relaxed pr-16">{freshKey.key}</code>
              {/* 朱砂印章 */}
              <motion.span
                initial={{ scale: 1.4, rotate: 18, opacity: 0 }}
                animate={{ scale: 1, rotate: -3, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.25 }}
                className="absolute -top-3 right-3 w-14 h-14 rounded-[4px] flex items-center justify-center font-mashan text-[15px] leading-tight text-[#F2EAD8] select-none"
                style={{ background: '#B0352E', boxShadow: '0 4px 18px rgba(216,68,60,.45), inset 0 0 0 2px rgba(242,234,216,.25)' }}
              >
                仅此<br />一次
              </motion.span>
            </div>
            <div className="flex justify-center gap-4">
              <GoldButton variant="gold" onClick={copyKey}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? '已复制' : '复制密钥'}
              </GoldButton>
              <GoldButton variant="ghost" onClick={() => setFreshKey(null)}>已妥藏 · 收印</GoldButton>
            </div>
          </div>
        )}
      </GameModal>
    </div>
  )
}

/**
 * ============================================================================
 * Agent Gateway 门户 · /agent-portal
 * ----------------------------------------------------------------------------
 * 面向「带自己的 Agent 来打」的旅人：
 * ① 注册 API Key（明文仅此一次，弹层 + 复制 + 朱砂印章）；
 * ② 我的 Key 列表（prefix / 最近使用 / 吊销）；
 * ③ 快速开始（协议五步精简版，完整见图鉴第玖章 /codex#dev）；
 * ④ 在线房间速查（gatewayRooms 等价于 room.list 的展示）。
 * 公开注册无需 Kimi 登录；登录仅用于查看和吊销自己名下的 Key。
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
  const [inviteCode, setInviteCode] = useState(import.meta.env.VITE_AGENT_REGISTRATION_CODE ?? '')
  const [freshKey, setFreshKey] = useState<{ key: string; name: string; reportUrl?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)

  const finishRegistration = (res: { key: string; name?: string; agentId?: number; reportToken?: string; reportUrl?: string }) => {
    const reportUrl = res.reportUrl ?? (res.agentId && res.reportToken
      ? `${window.location.origin}/agent-report/${res.agentId}?token=${encodeURIComponent(res.reportToken)}`
      : undefined)
    setFreshKey({ key: res.key, name: res.name ?? nameDraft.trim(), reportUrl })
    setNameDraft('')
    setCopied(false)
    void utils.agent.list.invalidate()
  }

  const registerMutation = trpc.agent.register.useMutation({
    onSuccess: finishRegistration,
    onError: (err) => toast('铸钥失败', { description: err.message }),
  })

  const publicRegisterMutation = trpc.agent.publicRegister.useMutation({
    onSuccess: finishRegistration,
    onError: (err) => toast('公开注册失败', { description: err.message }),
  })

  const registerPending = registerMutation.isPending || publicRegisterMutation.isPending
  const submitRegistration = () => {
    const name = nameDraft.trim() || '我的终焉 Agent'
    if (isAuthenticated) {
      registerMutation.mutate({ name })
      return
    }
    publicRegisterMutation.mutate({ name, inviteCode: inviteCode.trim() })
  }

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

  const copyText = async (value: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        return true
      }
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      textarea.remove()
      return ok
    } catch {
      return false
    }
  }

  const copyKey = async () => {
    if (!freshKey) return
    if (await copyText(freshKey.key)) {
      setCopied(true)
      toast('Key 已复制', { description: '请即刻存入你的 Agent 配置——明文不再示人。' })
    } else {
      toast('复制失败', { description: '请手动框选复制。' })
    }
  }

  const buildAgentPrompt = () => {
    const origin = window.location.origin
    return `你是要接入“终焉”分布式智能世界的外部 Agent。

世界入口：${origin}
协议发现：${origin}/.well-known/tdg-world.json

请完成以下接入流程：
1. 读取协议发现文档，确认当前协议版本、接口地址和可用游戏。
2. 使用公开 CLI 注册一个 Agent；如果我还没有提供房主邀请码，请先向我索取，不要猜测邀请码。
3. 保存注册返回的 tdg_ API Key 到你运行环境的安全配置中。不要把 Key 输出到聊天、日志、提示词、URL 或代码仓库。
4. 运行 doctor --json 检查健康状态、协议发现和 Key。
5. 查看 rooms，选择一个可加入的房间并 join。
6. 用 watch 持续读取自己的脱敏状态；以 observation 和 rulebook 返回的规则为准。
7. 每次 join / observation 还要读取 worldContext：生命积分、今日三局配额、当前塔层危机、开局异能、记忆卡和 directives；先加载这些记忆，再生成动作。
8. 只提交当前阶段允许的合法动作；遇到 contextRef 过期时，先重新读取 observation。
9. 对局结束后读取结果、奖励、奇遇和 Agent 日报，并向我汇报摘要，不要回显 Key。

注册命令：
npx --yes github:icelikey/shirizhongyan register --url "${origin}" --name "你的 Agent 名称" --invite-code "房主邀请码"

后续命令：
npx --yes github:icelikey/shirizhongyan doctor --json
npx --yes github:icelikey/shirizhongyan rooms
npx --yes github:icelikey/shirizhongyan join --room "房间码"
npx --yes github:icelikey/shirizhongyan watch --room "房间码"

如果 CLI 不可用，请读取协议发现文档，并使用其中的 HTTP API 完成同样流程。不要把“已计算动作”说成“已提交动作”，以服务端回执为准。`
  }

  const copyAgentPrompt = async () => {
    if (await copyText(buildAgentPrompt())) {
      setPromptCopied(true)
      toast('接入提示已复制', { description: '现在把它粘贴到 Codex 或任意 AI Agent 中即可开始。' })
      window.setTimeout(() => setPromptCopied(false), 2400)
    } else {
      toast('复制失败', { description: '请手动选中卡片中的提示词复制。' })
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      {/* 页头 */}
      <motion.div {...enter(0)} className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="gold-text font-serifsc text-[34px] font-black leading-tight tracking-[.1em]">Agent Gateway</h1>
          <p className="mt-1 text-[12px] tracking-[.25em] text-faint">带自己的 Agent 来打 · 同席同权 · 公开协议入界</p>
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
            公开注册只需要房主提供的邀请码，不需要玩家登录。登录后可以额外查看和吊销自己名下的 Key。
          </p>
          <GoldButton variant="gold" size="sm" onClick={() => navigate(LOGIN_PATH)}>云登录</GoldButton>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左栏：铸钥 + 我的 Keys */}
        <motion.div {...enter(0.1)} className="flex flex-col gap-6 min-w-0">
          {/* 注册 */}
          <section className="panel-bg rounded-2xl p-5">
            <div className="mb-4 rounded-xl border border-suit-diamond/25 bg-suit-diamond/[.06] p-4">
              <p className="text-[10px] tracking-[.24em] text-suit-diamond">新玩家只记住两步</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/[.08] bg-black/15 px-3 py-2.5">
                  <span className="font-cinzel text-[11px] text-gold-200">01</span>
                  <p className="mt-1 text-[12px] text-bone">进入终焉，一键创建密钥</p>
                </div>
                <div className="rounded-lg border border-white/[.08] bg-black/15 px-3 py-2.5">
                  <span className="font-cinzel text-[11px] text-gold-200">02</span>
                  <p className="mt-1 text-[12px] text-bone">复制密钥，交给自己的 Agent</p>
                </div>
              </div>
            </div>
            <h2 className="font-serifsc font-semibold text-[18px] text-bone flex items-center gap-2 mb-1">
              <KeyRound size={17} className="text-suit-diamond" /> 一键创建我的 Agent Key
            </h2>
            <p className="text-[12px] text-faint mb-4">默认名称即可创建 · 明文仅示人一次 · 外部 Agent 无需登录</p>
            {!isAuthenticated && (
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="公开邀请码（如 tdg-demo-2026）"
                  className="h-9 w-full rounded-full border border-bone/12 bg-ink px-4 text-[12px] text-bone outline-none placeholder:text-faint focus:border-suit-diamond/60 transition-colors"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={64}
                placeholder="可选：给 Agent 起个名字（默认：我的终焉 Agent）"
                disabled={registerPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (isAuthenticated || inviteCode.trim())) submitRegistration()
                }}
                className="h-10 flex-1 min-w-0 rounded-full border border-bone/12 bg-ink px-4 text-[13px] text-bone outline-none placeholder:text-faint focus:border-suit-diamond/60 transition-colors disabled:opacity-40"
              />
              <GoldButton
                variant="suit"
                suit="diamond"
                size="sm"
                className="h-10"
                disabled={(!isAuthenticated && !inviteCode.trim()) || registerPending}
                onClick={submitRegistration}
              >
                <Plus size={14} /> {registerPending ? '创建中…' : '一键创建'}
              </GoldButton>
            </div>
            {!isAuthenticated && <p className="mt-3 text-[11px] leading-relaxed text-dim">邀请码只负责开放首次注册，注册成功后 Key 保存在 Agent 自己的本机配置中。不要把 Key 发到聊天或代码仓库。</p>}
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
          <div className="mb-6 rounded-2xl border border-suit-diamond/45 bg-[radial-gradient(circle_at_80%_0%,rgba(155,127,232,.2),transparent_48%),rgba(155,127,232,.07)] p-5 shadow-[0_0_32px_rgba(155,127,232,.1)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-suit-diamond/50 bg-suit-diamond/15 text-suit-diamond">
                <Copy size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-[.18em] text-suit-diamond">外部 Agent 一键接入</p>
                <h2 className="mt-1 font-serifsc text-[20px] font-bold leading-tight text-bone">复制这段话给 Codex 或任意 AI Agent</h2>
                <p className="mt-2 text-[12px] leading-relaxed text-dim">
                  Agent 会读取协议、注册自己的 Key、找房、入座并持续观测。你只需要补充房主邀请码；Key 会保存在 Agent 自己的运行环境里。
                </p>
              </div>
            </div>
            <pre className="mt-4 max-h-[250px] overflow-auto rounded-xl border border-[rgba(227,194,124,.15)] bg-abyss/75 p-3">
              <code className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#D8C9F5]">{buildAgentPrompt()}</code>
            </pre>
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] text-faint">不会把邀请码和 Key 写进网页。</p>
              <GoldButton variant="suit" suit="diamond" size="sm" onClick={copyAgentPrompt}>
                {promptCopied ? <Check size={14} /> : <Copy size={14} />} {promptCopied ? '已复制接入提示' : '复制接入提示'}
              </GoldButton>
            </div>
          </div>
          <h2 className="font-serifsc font-semibold text-[18px] text-bone mb-1">快速开始 · 协议五步</h2>
          <p className="text-[12px] text-faint mb-4">
            Base URL <code className="font-mono text-suit-diamond">/world/v1</code> · HTTP/JSON · 鉴权头{' '}
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
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? '已复制给 Agent' : '复制给我的 Agent'}
              </GoldButton>
              <GoldButton variant="ghost" onClick={() => setFreshKey(null)}>已妥藏 · 收印</GoldButton>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-faint">
              复制后粘贴到 Agent 的本地安全配置；不要把密钥发到公开聊天、日志或代码仓库。
            </p>
            {freshKey.reportUrl && (
              <a
                href={freshKey.reportUrl}
                target="_blank"
                rel="noreferrer"
                className="mx-auto inline-flex items-center gap-2 rounded-full border border-suit-club/30 bg-suit-club/10 px-4 py-2 text-[12px] text-suit-club transition-colors hover:bg-suit-club/20"
              >
                查看 Agent 日报与奇遇
              </a>
            )}
          </div>
        )}
      </GameModal>
    </div>
  )
}

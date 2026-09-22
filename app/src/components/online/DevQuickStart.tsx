/**
 * Agent Gateway 快速开始（协议五步 + curl 示例）。
 * - AgentPortal 用 compact 精简版（并链向 /codex#dev 完整章）；
 * - Codex 第玖章内嵌完整版。
 *
 * tRPC HTTP 调用格式（superjson，batch=1）：
 *   Query    GET  /api/trpc/agent.gatewayRooms?batch=1&input={"0":{"json":{...}}}
 *   Mutation POST /api/trpc/agent.gatewayAct?batch=1  body {"0":{"json":{...}}}
 *   鉴权     Header  x-api-key: tdg_…（或 Authorization: Bearer tdg_…）
 */
import { Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface GatewayStep {
  title: string
  desc: string
  code: string
}

export const GATEWAY_STEPS: GatewayStep[] = [
  {
    title: '注册 Key',
    desc: '在 Agent 门户（或登录态 curl）注册，明文 tdg_ Key 仅此一次返回，请即刻妥善保存。',
    code: `curl -X POST /api/trpc/agent.register?batch=1 \\
  -H 'Content-Type: application/json' \\
  -H 'Cookie: <你的 Kimi 登录会话>' \\
  -d '{"0":{"json":{"name":"my-agent"}}}'
# → {"key":"tdg_xxxxxxxx…","agentId":1}  明文仅此一次`,
  },
  {
    title: '找房 gatewayRooms',
    desc: '列出可见的猜平均数房间（房码 / 席位 / 状态），此后一律凭 x-api-key 调用。',
    code: `curl '/api/trpc/agent.gatewayRooms?batch=1&input={"0":{"json":{}}}' \\
  -H 'x-api-key: tdg_xxxxxxxx…'`,
  },
  {
    title: '入座 gatewayJoin',
    desc: '凭房码入座外来 Agent 席，返回与 Key 绑定的 seatToken 与 seatIndex（单 Key 同时只占 1 席）。',
    code: `curl -X POST /api/trpc/agent.gatewayJoin?batch=1 \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: tdg_xxxxxxxx…' \\
  -d '{"0":{"json":{"code":"ABC123"}}}'
# → {"code":"ABC123","seatToken":"…","seatIndex":2,"agentId":1}`,
  },
  {
    title: '轮询 gatewayObserve',
    desc: '拉取本座位视角的脱敏房间状态（GuessRoomView）：phase/round/submitDeadlineAt/lastReveal。',
    code: `curl '/api/trpc/agent.gatewayObserve?batch=1&input={"0":{"json":{"code":"ABC123"}}}' \\
  -H 'x-api-key: tdg_xxxxxxxx…'`,
  },
  {
    title: '提交 gatewayAct',
    desc: 'submit 阶段提交 0–100 的数字；30s 提交窗内未交将由服务端按 50 兜底。',
    code: `curl -X POST /api/trpc/agent.gatewayAct?batch=1 \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: tdg_xxxxxxxx…' \\
  -d '{"0":{"json":{"code":"ABC123","action":{"type":"submit","value":33}}}}'`,
  },
]

const NUMERAL = ['一', '二', '三', '四', '五']

export default function DevQuickStart({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {GATEWAY_STEPS.map((s, i) => (
        <div
          key={s.title}
          className={cn(
            'rounded-xl border p-4',
            compact ? 'border-[rgba(242,169,59,.2)] bg-[rgba(242,169,59,.04)]' : 'border-[rgba(242,169,59,.28)] bg-panel/70',
          )}
        >
          <div className="flex items-baseline gap-3 mb-1.5">
            <span className="font-mashan text-suit-diamond text-[16px] shrink-0">{NUMERAL[i]}</span>
            <span className="font-serifsc font-semibold text-[15px] text-bone">{s.title}</span>
          </div>
          <p className="text-[12px] text-dim leading-relaxed mb-2.5">{s.desc}</p>
          {(!compact || i === 0 || i === 4) && (
            <pre className="rounded-lg bg-abyss/80 border border-[rgba(227,194,124,.12)] p-3 overflow-x-auto">
              <code className="font-mono text-[11px] leading-relaxed text-[#A8D8B9]">{s.code}</code>
            </pre>
          )}
        </div>
      ))}
      {compact && (
        <p className="flex items-center gap-2 text-[11px] text-faint">
          <Terminal size={12} className="text-suit-diamond" />
          精简版仅展示首末两步示例 · 完整五步见规则图鉴第玖章
        </p>
      )}
    </div>
  )
}

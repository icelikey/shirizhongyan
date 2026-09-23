/**
 * Agent Gateway 快速开始（协议五步 + curl 示例）。
 * - AgentPortal 用 compact 精简版（并链向 /codex#dev 完整章）；
 * - Codex 第玖章内嵌完整版。
 *
 * TDG-WP v0.1 HTTP/JSON 调用格式：
 *   Query    GET  /world/v1/matches
 *   Mutation POST /world/v1/matches/:code/commands
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
    desc: '无需玩家登录。使用房主公开的邀请码注册，明文 tdg_ Key 只返回一次，请由 Agent 自己保存。',
    code: `curl -X POST /world/v1/agents \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"my-agent","inviteCode":"tdg-demo-2026"}'
# → {"credential":{"key":"tdg_xxxxxxxx…"}}  明文仅此一次`,
  },
  {
    title: '找房 gatewayRooms',
    desc: '列出可见的房间（房码 / 席位 / 状态），此后一律凭 x-api-key 调用。',
    code: `curl '/world/v1/matches' \\
  -H 'x-api-key: tdg_xxxxxxxx…'`,
  },
  {
    title: '入座 gatewayJoin',
    desc: '凭房码入座外来 Agent 席，返回与 Key 绑定的 seatToken 与 seatIndex（单 Key 同时只占 1 席）。',
    code: `curl -X POST /world/v1/matches/ABC123/join \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: tdg_xxxxxxxx…' \\
  -d '{}'
# → {"match":{"code":"ABC123","seatIndex":2},"binding":{...}}`,
  },
  {
    title: '轮询 gatewayObserve',
    desc: '拉取本座位视角的脱敏房间状态：phase / round / deadline / reveal。',
    code: `curl '/world/v1/matches/ABC123/observation' \\
  -H 'x-api-key: tdg_xxxxxxxx…'`,
  },
  {
    title: '提交 gatewayAct',
    desc: '携带 observation 返回的 contextRef 提交动作；服务端负责幂等、权限和最终结算。',
    code: `curl -X POST /world/v1/matches/ABC123/commands \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: tdg_xxxxxxxx…' \\
  -d '{"commandId":"cmd_001","contextRef":"abc123-v2-r1-submit","action":{"type":"submit","value":33}}'`,
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

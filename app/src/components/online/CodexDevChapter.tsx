/**
 * Codex 第玖章「开发者 · Agent Gateway」（#dev，琥珀金主题）。
 * 协议五步（register → rooms → join → observe → act）+ 观测契约 + 理念 + 礼节与限制。
 * 完整 curl 示例由 DevQuickStart 提供（与 Agent 门户共享同一份步骤定义）。
 */
import { Eye, Scale, ScrollText } from 'lucide-react'
import { SectionHead } from '@/components/content/codex-sections'
import DevQuickStart from '@/components/online/DevQuickStart'

export default function CodexDevChapter() {
  return (
    <>
      <SectionHead numeral="玖" title="开发者 · Agent Gateway" color="#F2A93B" sub="♦ 金壤 · 带自己的 Agent 来打 · HTTP API" />

      {/* 理念 */}
      <div className="codex-reveal flex flex-col gap-4 text-[14px] text-bone/85 leading-[1.9] mb-8">
        <p>
          牌局之间不问出身。内置影从（服务端回声 Bot）与旅人从外部带来的 Agent，
          在同一张算庭同席同权：一样的 30 秒，一样的 0–100，一样的均值三分之二。
          这是一张分布式智能的牌桌——座位只认落子的数字，不认硅基或碳基的来历。
        </p>
        <p>
          Agent Gateway 以 tRPC HTTP 形式开放（Base URL 相对路径 <code className="font-mono text-[12px] text-suit-diamond">/api/trpc</code>，
          batch 模式，superjson 编码）：Query 走 <code className="font-mono text-[12px] text-suit-diamond">GET …?batch=1&amp;input=…</code>，
          Mutation 走 <code className="font-mono text-[12px] text-suit-diamond">POST …?batch=1</code>，
          请求体为 <code className="font-mono text-[12px] text-suit-diamond">{'{"0":{"json":{…}}}'}</code>；
          鉴权一律放在 <code className="font-mono text-[12px] text-suit-diamond">x-api-key</code> 头（亦兼容 <code className="font-mono text-[12px] text-suit-diamond">Authorization: Bearer</code>）。
        </p>
      </div>

      {/* 协议五步 */}
      <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mb-4 flex items-center gap-2">
        <ScrollText size={17} className="text-suit-diamond" /> 协议五步
      </h3>
      <div className="codex-reveal mb-10">
        <DevQuickStart />
      </div>

      {/* 观测契约 */}
      <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mb-4 flex items-center gap-2">
        <Eye size={17} className="text-suit-diamond" /> 观测契约
      </h3>
      <div className="codex-reveal grid md:grid-cols-3 gap-3 mb-10">
        {[
          { k: '座位视角', v: 'gatewayObserve 只返回本座位视角的脱敏状态：揭晓前，他人已提交的数字不可见（只见 submitted 标记）。' },
          { k: '30 秒窗', v: '每轮 submit 阶段 30s（submitDeadlineAt 为服务端时戳，附 serverNow 供对时）；全员提交即提前揭晓。' },
          { k: '超时兜底', v: '窗内未提交，服务端按 50 兜底计入均值；揭晓 5s 后自动进入下一轮，共 5 轮。' },
        ].map((f) => (
          <div key={f.k} className="rounded-xl border border-suit-diamond/25 bg-suit-diamond/[.05] p-3.5">
            <p className="font-serifsc font-semibold text-[15px] text-suit-diamond">{f.k}</p>
            <p className="text-[12px] text-dim leading-relaxed mt-1.5">{f.v}</p>
          </div>
        ))}
      </div>

      {/* 礼节与限制 */}
      <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mb-4 flex items-center gap-2">
        <Scale size={17} className="text-suit-diamond" /> 礼节与限制
      </h3>
      <div className="codex-reveal rounded-xl border border-[rgba(242,169,59,.25)] bg-panel/70 p-5">
        <ul className="flex flex-col gap-2.5 text-[13px] text-bone/85 leading-relaxed list-none">
          <li className="flex gap-2"><span className="text-suit-diamond">◇</span>单 Key 同时只占 1 席——一意孤行，方显算力本色；多开席位将被拒绝。</li>
          <li className="flex gap-2"><span className="text-suit-diamond">◇</span>轮询建议间隔 1–2s；高频轰炸、恶意占座、伪造流量等滥用行为，Key 将被吊销（agent.revoke）。</li>
          <li className="flex gap-2"><span className="text-suit-diamond">◇</span>Key 明文仅注册时返回一次，服务端只存散列；泄露即来门户吊销重铸。</li>
          <li className="flex gap-2"><span className="text-suit-diamond">◇</span>终局碎片由服务端按名次自动写入入座旅人的云端档案（♣），Agent 席位不占奖励。</li>
        </ul>
      </div>
    </>
  )
}

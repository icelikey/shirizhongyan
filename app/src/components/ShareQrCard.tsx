import { Check, Copy, QrCode, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * 公网入口卡：二维码目标随部署域名变化，避免把本机地址写死到构建产物。
 * QR 图像由无状态公共渲染端生成，页面本身不上传用户资料。
 */
export default function ShareQrCard() {
  const [target, setTarget] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const url = new URL('/game/entry', window.location.origin)
    url.searchParams.set('from', 'qr')
    setTarget(url.toString())
  }, [])

  const qrUrl = target
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(target)}`
    : ''

  const copy = async () => {
    if (!target) return
    try {
      await navigator.clipboard.writeText(target)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="mx-auto mt-4 w-full max-w-[520px] rounded-2xl border border-[rgba(227,194,124,.18)] bg-[rgba(12,10,19,.72)] p-3 backdrop-blur-md sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-suit-diamond/35 bg-suit-diamond/10 text-suit-diamond">
          <QrCode size={16} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 text-[10px] tracking-[.22em] text-suit-diamond"><Share2 size={12} /> 扫码入界</div>
          <p className="mt-1 text-[11px] leading-relaxed text-dim">打开终焉的入界试炼，先玩一局，再决定是否让 Agent 入席。</p>
        </div>
        <button type="button" onClick={copy} disabled={!target} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-bone/15 px-2.5 py-1.5 text-[10px] text-dim transition-colors hover:border-gold-300/50 hover:text-gold-200 disabled:opacity-40">
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? '已复制' : '复制入口'}
        </button>
      </div>
      {qrUrl && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[.08] bg-white p-2 sm:gap-4">
          <img src={qrUrl} alt="扫码打开终焉入界试炼" className="h-24 w-24 rounded-lg sm:h-28 sm:w-28" loading="lazy" />
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-medium text-[#1D1726]">手机扫码即可进入</p>
            <p className="mt-1 break-all text-[10px] leading-relaxed text-[#6E6477]">{target}</p>
          </div>
        </div>
      )}
    </section>
  )
}

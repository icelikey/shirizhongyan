import { createElement, useEffect, useState } from "react"

const MODEL_VIEWER_SCRIPT = "https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"

interface TripoModelViewerProps {
  src?: string
  alt: string
  label: string
  className?: string
}

/** 有 GLB 时使用 model-viewer；没有资产时保留可辨识的 3D 生成占位。 */
export default function TripoModelViewer({ src, alt, label, className = "" }: TripoModelViewerProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!src || customElements.get("model-viewer")) {
      setReady(Boolean(src))
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MODEL_VIEWER_SCRIPT}"]`)
    if (existing) {
      existing.addEventListener("load", () => setReady(true), { once: true })
      return
    }
    const script = document.createElement("script")
    script.type = "module"
    script.src = MODEL_VIEWER_SCRIPT
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [src])

  if (src && ready) {
    return createElement("model-viewer", {
      src,
      alt,
      "camera-controls": true,
      "auto-rotate": true,
      "shadow-intensity": "1",
      class: `h-full w-full bg-transparent ${className}`,
    })
  }

  return (
    <div className={`relative flex h-full min-h-[240px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(227,194,124,.22),transparent_28%),linear-gradient(145deg,#171123,#08070d)] ${className}`}>
      <div className="absolute h-32 w-32 rotate-45 rounded-[28%] border border-gold-300/35 bg-gold-300/10 shadow-[0_0_55px_rgba(227,194,124,.22)] [transform:rotateX(58deg)_rotateZ(45deg)]" />
      <div className="relative z-10 text-center">
        <div className="font-cinzel text-[10px] tracking-[.28em] text-gold-300/70">TRIPO 3D ASSET</div>
        <div className="mt-2 font-serifsc text-lg tracking-[.16em] text-bone/85">{label}</div>
        <div className="mt-2 text-[11px] text-faint">{src ? "三维组件加载中" : "等待 GLB 资产接入"}</div>
      </div>
    </div>
  )
}

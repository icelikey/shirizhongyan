import { createElement, useEffect, useState } from "react"

const MODEL_VIEWER_SCRIPT = "https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"

interface TripoModelViewerProps {
  src?: string
  previewSrc?: string
  alt: string
  label: string
  className?: string
}

/** 有 GLB 时使用 model-viewer；缺失或加载失败时保留可辨识的预览状态。 */
export default function TripoModelViewer({ src, previewSrc, alt, label, className = "" }: TripoModelViewerProps) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setReady(false)
    setFailed(false)
    if (!src) {
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        if (!customElements.get("model-viewer")) {
          const existing = document.querySelector<HTMLScriptElement>(`script[src="${MODEL_VIEWER_SCRIPT}"]`)
          if (existing) {
            await Promise.race([
              customElements.whenDefined("model-viewer"),
              new Promise<void>((_, reject) => {
                const timer = window.setTimeout(() => reject(new Error("model-viewer script timed out")), 8000)
                existing.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("model-viewer script failed")) }, { once: true })
              }),
            ])
          } else {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement("script")
              script.type = "module"
              script.src = MODEL_VIEWER_SCRIPT
              script.onload = () => resolve()
              script.onerror = () => reject(new Error("model-viewer script failed"))
              document.head.appendChild(script)
            })
          }
          await customElements.whenDefined("model-viewer")
        }
        if (!cancelled) setReady(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [src])

  if (src && ready && !failed) {
    return createElement("model-viewer", {
      src,
      alt,
      "camera-controls": true,
      "auto-rotate": true,
      "shadow-intensity": "1",
      class: `h-full w-full bg-transparent ${className}`,
      onLoad: () => setFailed(false),
      onError: () => setFailed(true),
    })
  }

  return (
    <div className={`relative flex h-full min-h-[240px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(227,194,124,.22),transparent_28%),linear-gradient(145deg,#171123,#08070d)] ${className}`}>
      <div className="absolute h-32 w-32 rotate-45 rounded-[28%] border border-gold-300/35 bg-gold-300/10 shadow-[0_0_55px_rgba(227,194,124,.22)] [transform:rotateX(58deg)_rotateZ(45deg)]" />
      {previewSrc && <img src={previewSrc} alt="" className="absolute inset-0 h-full w-full object-contain opacity-35" />}
      <div className="relative z-10 max-w-[80%] text-center">
        <div className="font-cinzel text-[10px] tracking-[.28em] text-gold-300/70">TRIPO 3D ASSET</div>
        <div className="mt-2 font-serifsc text-lg tracking-[.16em] text-bone/85">{label}</div>
        <div className="mt-2 text-[11px] text-faint">
          {failed ? "模型加载失败，可检查 GLB 路径或继续使用预览图" : src ? "三维组件加载中" : "等待 GLB 资产接入"}
        </div>
      </div>
    </div>
  )
}

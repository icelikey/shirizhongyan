/**
 * S4 · 影从巡游（home.md S4，100vh，横向 strip）
 * 8 张影从卡（160×240）marquee 30s/循环，悬停暂停；
 * 悬停单卡：放大 1.08 + 立绘提亮 + signature 台词气泡；
 * 点击：弹「影从速览」Modal（立绘大图 + 三行档案 + 登录后可查看完整档案）。
 */
import { useRef, useState } from 'react'
import type { Echo } from '@/data/echoes'
import { ECHOES, SUIT_META } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import GoldButton from '@/components/GoldButton'
import EchoAvatar from '@/components/EchoAvatar'
import { gsap, useGSAP } from '@/lib/gsap'

function EchoCard({ echo, onClick }: { echo: Echo; onClick: () => void }) {
  const meta = SUIT_META[echo.suit]
  return (
    <button
      type="button"
      onClick={onClick}
      className="echo-card group relative w-[160px] h-[240px] shrink-0 rounded-[14px] card-frame overflow-hidden transition-transform duration-300 ease-ink hover:scale-[1.08] hover:z-10"
    >
      <img
        src={echo.portrait}
        alt={echo.name}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover object-top transition-[filter] duration-300 group-hover:brightness-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/30 to-transparent" />
      {/* 台词气泡 */}
      <div className="absolute left-2 right-2 top-2 rounded-lg border border-gold-300/40 bg-abyss/85 px-2.5 py-2 text-[11px] leading-relaxed text-gold-100 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 text-left">
        「{echo.quote}」
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-serifsc font-semibold text-[18px] text-bone">{echo.name}</span>
          <span style={{ color: meta.color }}>
            <SuitIcon suit={echo.suit} size={16} />
          </span>
        </div>
        <span
          className="self-start text-[10px] tracking-[.2em] px-2 py-0.5 rounded-full border"
          style={{ color: meta.color, borderColor: `${meta.color}55`, background: `${meta.color}14` }}
        >
          {echo.persona}
        </span>
      </div>
    </button>
  )
}

function EchoQuickView({ echo, onClose }: { echo: Echo; onClose: () => void }) {
  const meta = SUIT_META[echo.suit]
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-abyss/85 backdrop-blur-[12px] echo-fade" />
      <div
        className="relative panel-bg rounded-[18px] border border-[rgba(227,194,124,.28)] max-w-[720px] w-full overflow-hidden echo-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-[280px] h-[320px] sm:h-auto shrink-0 relative">
            <img src={echo.portrait} alt={echo.name} className="absolute inset-0 w-full h-full object-cover object-top" draggable={false} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-panel hidden sm:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent sm:hidden" />
          </div>
          <div className="p-7 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <EchoAvatar echo={echo} size={48} showZodiac />
              <div>
                <h3 className="font-serifsc font-black text-[26px] text-bone">{echo.name}</h3>
                <div className="flex items-center gap-2 text-[12px]" style={{ color: meta.color }}>
                  <SuitIcon suit={echo.suit} size={14} />
                  {SUIT_META[echo.suit].realm} · {echo.persona}
                </div>
              </div>
            </div>
            <p className="text-gold-300 text-[14px] font-serifsc">「{echo.quote}」</p>
            <ul className="flex flex-col gap-2">
              {echo.bio.map((b, i) => (
                <li key={i} className="text-[13px] text-dim leading-relaxed flex gap-2">
                  <span className="text-gold-500 mt-[2px]">◆</span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-5 text-[13px] text-dim font-mono">
              <span>胜率 {(echo.winRate * 100).toFixed(1)}%</span>
              <span>{echo.games} 局</span>
            </div>
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className="text-[11px] text-faint tracking-wider">登录后可查看完整档案</span>
              <GoldButton variant="ghost" size="sm" onClick={onClose}>收起</GoldButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EchoesSection() {
  const root = useRef<HTMLElement>(null)
  const [viewing, setViewing] = useState<Echo | null>(null)

  useGSAP(
    () => {
      gsap.fromTo(
        '.echo-card',
        { x: '60vw', opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.07,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
        },
      )
      gsap.fromTo(
        '.echoes-head',
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: { trigger: root.current, start: 'top 80%', once: true },
        },
      )
    },
    { scope: root },
  )

  return (
    <section ref={root} className="relative min-h-[100dvh] py-24 flex flex-col justify-center overflow-hidden" id="s4">
      <div className="echoes-head text-center mb-14 px-6">
        <h2 className="gold-text font-serifsc font-black text-[28px] tracking-[.1em]">分布式智能体 · 影从名录</h2>
        <p className="text-dim text-[14px] tracking-[.25em] mt-3">他们有人设、记忆与胜负欲。你会爱上他们，或恨他们。</p>
      </div>

      {/* marquee 30s/循环，悬停暂停 */}
      <div className="marquee-wrap relative w-full overflow-hidden py-4" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
        <div className="marquee-track flex gap-5 w-max">
          {[...ECHOES, ...ECHOES].map((e, i) => (
            <EchoCard key={`${e.id}-${i}`} echo={e} onClick={() => setViewing(e)} />
          ))}
        </div>
      </div>

      {viewing && <EchoQuickView echo={viewing} onClose={() => setViewing(null)} />}

      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marquee 30s linear infinite; }
        .marquee-wrap:hover .marquee-track { animation-play-state: paused; }
        @keyframes echoFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes echoPop { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
        .echo-fade { animation: echoFade .24s ease-out; }
        .echo-pop { animation: echoPop .24s cubic-bezier(.22,1,.36,1); }
      `}</style>
    </section>
  )
}

/**
 * S1 · 世界观叙事「十日终焉」（home.md S1，pinned 200vh）
 * 中央 720px 文本井，三行叙事随滚动逐句浮现（28/22/16px 递减）；
 * 每句对应一枚动态图示：① 十枚日轮依次熄灭 ② 卡牌碎裂成金碎片 ③ 人兽剪影缔结契约。
 */
import { useRef } from 'react'
import { gsap, useGSAP } from '@/lib/gsap'

const LINES = [
  { text: '这个世界，每十日终结一次。', size: 28 },
  { text: '十日之后，万物归墟，唯有牌局之间的胜者，能带着记忆碎片进入下一个十日。', size: 22 },
  { text: '你是误入此间的旅人。而你并不孤单——契约影从，将与你轮替上阵。', size: 16 },
]

/** ① 十枚日轮依次熄灭 */
function SunsIcon() {
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="sun-dot w-2.5 h-2.5 rounded-full bg-gold-300"
          style={{ boxShadow: '0 0 8px rgba(227,194,124,.7)' }}
          data-i={i}
        />
      ))}
    </div>
  )
}

/** ② 卡牌碎裂成金色碎片 */
function ShatterIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shatter-icon">
      <rect x="28" y="18" width="24" height="36" rx="3" className="shatter-core" fill="none" stroke="#E3C27C" strokeWidth="1.5" />
      {[
        'M40 8l4 6-5 3-3-5z',
        'M58 22l6 3-2 6-6-2z',
        'M62 46l5 5-6 4-3-6z',
        'M20 26l-6 4 2 7 7-3z',
        'M18 50l-5 6 7 3 2-7z',
        'M46 62l3 7-8 1-1-8z',
      ].map((d, i) => (
        <path key={i} d={d} className="shatter-frag" fill="#E3C27C" opacity="0.9" />
      ))}
    </svg>
  )
}

/** ③ 人与兽剪影缔结契约 */
function ContractIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="contract-icon" fill="none" stroke="#E3C27C" strokeWidth="1.5">
      <circle className="contract-ring" cx="40" cy="40" r="26" strokeDasharray="4 5" opacity="0.6" />
      <circle className="contract-man" cx="24" cy="34" r="7" />
      <path className="contract-man" d="M24 41v14M18 48h12" />
      <path className="contract-beast" d="M56 30c4 0 7 3 7 7s-3 7-7 7-7-3-7-7 3-7 7-7ZM52 28l-2-4M60 28l2-4" />
      <path className="contract-touch" d="M33 44l12-2" stroke="#F0655A" strokeWidth="2" />
    </svg>
  )
}

export default function LoreSection() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: true },
        defaults: { ease: 'power2.out' },
      })

      /* 三句叙事：0-33% / 33-66% / 66-100% 各驱动一句 */
      LINES.forEach((_, i) => {
        const at = i / 3
        tl.fromTo(
          `.lore-line-${i}`,
          { opacity: 0, y: 60, filter: 'blur(6px)' },
          { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.1 },
          at,
        )
        if (i > 0) {
          // 前一句缩至 .92 并降到 30% 透明度
          tl.to(`.lore-line-${i - 1}`, { opacity: 0.3, scale: 0.92, duration: 0.08 }, at)
        }
      })

      /* ① 日轮随进度逐枚熄灭 */
      tl.to('.sun-dot', { opacity: 0.15, boxShadow: 'none', stagger: 0.02, duration: 0.25 }, 0.02)

      /* ② 碎片飞散（33% 起） */
      tl.fromTo('.shatter-frag', { x: 0, y: 0, opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.34)
      tl.to('.shatter-frag', {
        x: () => gsap.utils.random(-26, 26),
        y: () => gsap.utils.random(-22, 22),
        rotate: () => gsap.utils.random(-40, 40),
        duration: 0.2,
        stagger: 0.015,
      }, 0.36)
      tl.to('.shatter-core', { opacity: 0.15, duration: 0.15 }, 0.4)

      /* ③ 契约（66% 起）：双方靠近 + 契环浮现 */
      tl.fromTo('.contract-ring', { opacity: 0, scale: 0.6, transformOrigin: 'center' }, { opacity: 0.7, scale: 1, duration: 0.15 }, 0.67)
      tl.fromTo('.contract-touch', { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.75)
    },
    { scope: root },
  )

  return (
    <section ref={root} className="relative h-[300dvh]" id="s1">
      <div className="sticky top-0 h-[100dvh] flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-[720px] px-6 flex flex-col gap-14">
          {LINES.map((line, i) => (
            <div key={i} className={`lore-line-${i} opacity-0 flex flex-col items-center gap-6 text-center`}>
              <p className="font-serifsc font-semibold text-bone leading-relaxed" style={{ fontSize: line.size }}>
                {line.text}
              </p>
              {i === 0 && <SunsIcon />}
              {i === 1 && <ShatterIcon />}
              {i === 2 && <ContractIcon />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

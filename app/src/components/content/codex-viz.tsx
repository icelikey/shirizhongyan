/**
 * 规则图鉴 · 核心可视化（codex.md）。本文件组件树只用 GSAP，不用 framer-motion。
 * - RoleGallery     狼人杀角色卡画廊（悬停 3D 翻转看技能）
 * - WerewolfCycle   昼夜流程环形图解（描线生长 + 光点巡游 + 节点注解）
 * - GuessSteps      猜平均数四步步骤条 + 公式图解
 * - LevelKStairs    level-k 思维层级下沉阶梯（50→33→22→15→10）
 * - ZodiacWheel     12 生肖轮回盘
 * - TierLadder      天地玄黄位阶阶梯（金光点亮至玩家当前位阶）
 */
import { useRef, useState } from 'react'
import { useProfile } from '@/store/profile'
import { ZODIAC } from '@/data/zodiac'
import { TIERS, TIER_ORDER } from '@/data/tiers'
import type { Tier } from '@/data/tiers'
import { gsap, useGSAP } from '@/lib/gsap'
import TierSeal from '@/components/TierSeal'
import ZodiacSeal from '@/components/ZodiacSeal'
import SuitIcon from '@/components/SuitIcon'

/* ============================ RoleGallery ============================ */

const ROLES = [
  { img: '/role-werewolf.png', name: '狼人', count: '×2', skill: '夜刃：每晚共刀一人。', faction: '狼人阵营', color: '#F0655A' },
  { img: '/role-seer.png', name: '预言家', count: '×1', skill: '天目：每晚验一人阵营。', faction: '好人阵营', color: '#8B93F8' },
  { img: '/role-witch.png', name: '女巫', count: '×1', skill: '双生药：一解一毒，各限一次。', faction: '好人阵营', color: '#4ECB9C' },
  { img: '/role-villager.png', name: '平民', count: '×2', skill: '无技能，唯有选票与良知。', faction: '好人阵营', color: '#E3C27C' },
]

export function RoleGallery() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(
        '.role-card',
        { rotate: (i) => -9 + i * 6, y: 26, opacity: 0 },
        {
          rotate: 0, y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 78%' },
        },
      )
    },
    { scope: root },
  )
  return (
    <div ref={root} className="flex flex-wrap justify-center gap-5">
      {ROLES.map((r) => (
        <div key={r.name} className="role-card group w-[140px] h-[210px] [perspective:900px]">
          <div
            className="relative w-full h-full transition-transform ease-snap [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]"
            style={{ transitionDuration: '420ms' }}
          >
            {/* 正面 */}
            <div className="absolute inset-0 [backface-visibility:hidden] rounded-[12px] overflow-hidden card-frame bg-panel">
              <img src={r.img} alt={r.name} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-abyss/95 to-transparent px-2.5 pt-8 pb-2.5">
                <p className="font-serifsc font-semibold text-[15px] text-bone leading-none">{r.name}</p>
                <p className="text-[10px] mt-1" style={{ color: r.color }}>
                  {r.faction} {r.count}
                </p>
              </div>
            </div>
            {/* 背面：技能 */}
            <div
              className="absolute inset-0 [backface-visibility:hidden] rounded-[12px] card-frame bg-elevated p-3.5 flex flex-col justify-center gap-2.5"
              style={{ transform: 'rotateY(180deg)' }}
            >
              <p className="font-serifsc font-semibold text-[16px]" style={{ color: r.color }}>
                {r.name}
              </p>
              <p className="text-[12px] text-bone/85 leading-relaxed">{r.skill}</p>
              <p className="text-[10px] text-faint tracking-[.2em]">{r.faction}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ============================ WerewolfCycle ============================ */

const PHASES = [
  { name: '夜·狼刀', desc: '狼人睁眼，共刀一人。', hint: '白泽从不首夜刀高玩，讹兽偏偏会。' },
  { name: '夜·验人', desc: '预言家查验一人阵营。', hint: '验人结果别急中报，先织好语境。' },
  { name: '夜·女巫', desc: '女巫双生药：一解一毒，各限一次。', hint: '青囊的解药，常留到第三夜之后。' },
  { name: '晨·死讯', desc: '公布昨夜死讯，死者留遗言。', hint: '死讯的位置学，是玄渊第一课。' },
  { name: '昼·发言', desc: '依次发言，票型与语气皆是线索。', hint: '阿九不听逻辑，只听心跳。' },
  { name: '放逐·投票', desc: '全员投票，得票最多者出局；平票无人出局。', hint: '夜航星式的反击，从计票开始。' },
  { name: '遗言', desc: '出局者留下最后一段话——真话，或最后的谎言。', hint: '好的遗言能让狼队再输一天。' },
]

export function WerewolfCycle() {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const C = 220
  const R = 150
  const CIRC = 2 * Math.PI * R

  useGSAP(
    () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
        defaults: { ease: 'power2.out' },
      })
      tl.fromTo('.cycle-ring', { strokeDashoffset: CIRC }, { strokeDashoffset: 0, duration: 1.2, ease: 'power1.inOut' })
      tl.fromTo('.cycle-node', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, stagger: 0.08 }, 0.5)
      tl.fromTo('.cycle-moon', { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.9)
      /* 光点永续巡游 */
      gsap.to('.cycle-runner', { rotate: 360, duration: 8, ease: 'none', repeat: -1, transformOrigin: `${C}px ${C}px` })
    },
    { scope: root },
  )

  return (
    <div ref={root} className="grid lg:grid-cols-[440px_minmax(0,1fr)] items-center gap-8">
      <svg viewBox="0 0 440 440" className="w-full max-w-[440px] mx-auto">
        <defs>
          <radialGradient id="moon-g" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="#B9C8FF" stopOpacity=".9" />
            <stop offset="55%" stopColor="#8B93F8" stopOpacity=".28" />
            <stop offset="100%" stopColor="#8B93F8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* 中央月相盘 */}
        <g className="cycle-moon">
          <circle cx={C} cy={C} r="62" fill="url(#moon-g)" />
          <circle cx={C} cy={C} r="34" fill="#0C0A13" stroke="#8B93F8" strokeOpacity=".5" />
          <path d={`M${C - 10} ${C - 22} a 26 26 0 1 0 0 44 a 20 20 0 1 1 0 -44 Z`} fill="#B9C8FF" opacity=".9" />
          <text x={C} y={C + 62} textAnchor="middle" fill="#8B93F8" fontSize="12" letterSpacing="4">昼夜轮替</text>
        </g>
        {/* 主环 */}
        <circle
          className="cycle-ring"
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="#8B93F8"
          strokeOpacity=".55"
          strokeWidth="1.5"
          strokeDasharray={CIRC}
          strokeLinecap="round"
        />
        {/* 巡游光点 */}
        <g className="cycle-runner">
          <circle cx={C} cy={C - R} r="5" fill="#E3C27C" style={{ filter: 'drop-shadow(0 0 6px rgba(227,194,124,.9))' }} />
        </g>
        {/* 相位节点 */}
        {PHASES.map((p, i) => {
          const a = -Math.PI / 2 + (i * 2 * Math.PI) / PHASES.length
          const x = C + R * Math.cos(a)
          const y = C + R * Math.sin(a)
          const on = active === i
          return (
            <g
              key={p.name}
              className="cycle-node cursor-pointer"
              onPointerEnter={() => setActive(i)}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <circle
                cx={x}
                cy={y}
                r="27"
                fill={on ? '#1D1626' : '#14101C'}
                stroke={on ? '#E3C27C' : '#8B93F8'}
                strokeOpacity={on ? 0.95 : 0.55}
                strokeWidth={on ? 2 : 1.2}
                style={on ? { filter: 'drop-shadow(0 0 10px rgba(227,194,124,.5))' } : undefined}
              />
              <text x={x} y={y - 1} textAnchor="middle" fill={on ? '#F8E9C0' : '#A89F8D'} fontSize="11" fontWeight={600}>
                {p.name.split('·')[0]}
              </text>
              <text x={x} y={y + 12} textAnchor="middle" fill={on ? '#E3C27C' : '#6E6880'} fontSize="10">
                {p.name.split('·')[1]}
              </text>
            </g>
          )
        })}
      </svg>
      {/* 注解卡 */}
      <div className="panel-bg rounded-2xl p-6 min-h-[180px]">
        <p className="text-[11px] tracking-[.3em] text-info mb-2">相位 {active + 1} / {PHASES.length}</p>
        <h4 className="font-serifsc font-semibold text-[20px] text-bone">{PHASES[active].name.replace('·', ' · ')}</h4>
        <p className="text-[14px] text-bone/85 leading-relaxed mt-3">{PHASES[active].desc}</p>
        <p className="text-[12px] text-dim leading-relaxed mt-2 border-l-2 border-info/40 pl-3">
          影从注脚：{PHASES[active].hint}
        </p>
      </div>
    </div>
  )
}

/* ============================ GuessSteps ============================ */

const STEPS = [
  { name: '秘密出数', desc: '每人暗出一个 0–100 的数' },
  { name: '取全员均值', desc: '所有出数求平均' },
  { name: '目标 ×2/3', desc: '目标数 = 均值 × 2/3' },
  { name: '最近者胜', desc: '最接近目标 +10 分，5 轮定冠军' },
]

export function GuessSteps() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top 78%' } })
      tl.fromTo('.gstep-bead', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, stagger: 0.16, ease: 'back.out(2)' })
      tl.fromTo('.gstep-line', { scaleX: 0 }, { scaleX: 1, duration: 0.4, stagger: 0.16, ease: 'power1.inOut' }, 0.16)
    },
    { scope: root },
  )
  return (
    <div ref={root}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 items-start">
        {STEPS.map((s, i) => (
          <div key={s.name} className="relative flex flex-col items-center text-center px-3">
            {i < STEPS.length - 1 && (
              <span className="gstep-line hidden lg:block absolute top-[26px] left-[calc(50%+34px)] w-[calc(100%-68px)] h-px origin-left bg-gradient-to-r from-suit-club/70 to-suit-club/20" />
            )}
            <span className="gstep-bead w-[52px] h-[52px] rounded-full border border-suit-club/60 bg-suit-club/10 flex items-center justify-center shadow-[0_0_16px_rgba(78,203,156,.25)]">
              <span className="font-cinzel font-bold text-suit-club text-[18px]">{i + 1}</span>
            </span>
            <p className="font-serifsc font-semibold text-[15px] text-bone mt-3">{s.name}</p>
            <p className="text-[12px] text-dim mt-1 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
      {/* 公式图解 */}
      <div className="mt-8 rounded-2xl border border-suit-club/25 bg-suit-club/[.06] px-6 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <span className="text-[12px] tracking-[.3em] text-suit-club">公式</span>
        <span className="font-mono text-[17px] text-bone">
          目标数 <span className="text-suit-club">=</span> ( x₁ + x₂ + … + xₙ ) <span className="text-suit-club">÷</span> n{' '}
          <span className="text-suit-club">×</span> 2/3
        </span>
        <span className="text-[12px] text-dim">平局按提交先后 · 超时按当前滑杆值提交</span>
      </div>
    </div>
  )
}

/* ============================ LevelKStairs ============================ */

const LEVELS = [
  { lv: 'L0', value: 50, name: '随缘出手', thought: '「世界在我眼里还是均匀的。」', foot: '守拙：我就站在第一层，等你们摔下来。', hit: 4 },
  { lv: 'L1', value: 33, name: '低人一档', thought: '「大家都会往大猜。」', foot: '阿九：心跳告诉我，就到这儿。', hit: 18 },
  { lv: 'L2', value: 22, name: '再低一档', thought: '「料定别人的料定。」', foot: '璇玑：第二层的算珠最忙。', hit: 31 },
  { lv: 'L3', value: 15, name: '三层思维', thought: '「他们知道你知道。」', foot: '白泽：第三层开始，对手只剩影子。', hit: 27 },
  { lv: 'L4', value: 10, name: '深渊回响', thought: '「层层相因，趋于深渊。」', foot: '百晓生：这层的风声，作价最高。', hit: 12 },
]

export function LevelKStairs() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(
        '.lk-stele',
        { y: 60, opacity: 0 },
        {
          y: 0, opacity: 1, stagger: 0.14, ease: 'power1.out',
          scrollTrigger: { trigger: root.current, start: 'top 80%', end: 'top 30%', scrub: true },
        },
      )
    },
    { scope: root },
  )
  return (
    <div ref={root}>
      <div className="flex items-end justify-center gap-3 sm:gap-4">
        {LEVELS.map((l, i) => (
          <div
            key={l.lv}
            className="lk-stele group relative flex-1 max-w-[190px] rounded-t-xl border border-suit-club/35 px-3 pt-4 pb-3 text-center transition-colors hover:border-suit-club/70"
            style={{
              height: 200 - i * 26,
              background: `linear-gradient(180deg, rgba(78,203,156,${0.16 - i * 0.022}), rgba(20,26,22,.9))`,
              boxShadow: i === 2 ? '0 0 24px rgba(78,203,156,.18)' : undefined,
            }}
            title={`本层历史命中率 ${l.hit}%`}
          >
            <p className="font-cinzel font-bold text-suit-club text-[20px] leading-none">{l.lv}</p>
            <p className="font-mono text-bone text-[26px] leading-none mt-1.5">{l.value}</p>
            <p className="font-serifsc text-[13px] text-bone/90 mt-2">{l.name}</p>
            <p className="hidden sm:block text-[11px] text-dim mt-1 leading-snug">{l.thought}</p>
            {/* 悬停浮出命中率 */}
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-ink border border-suit-club/50 px-2.5 py-0.5 text-[10px] font-mono text-suit-club opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              命中率 {l.hit}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-1.5">
        {LEVELS.map((l) => (
          <p key={l.lv} className="text-[12px] text-faint leading-relaxed">
            <span className="font-mono text-suit-club/80 mr-2">{l.lv}</span>
            {l.foot}
          </p>
        ))}
      </div>
    </div>
  )
}

/* ============================ ZodiacWheel ============================ */

export function ZodiacWheel() {
  const root = useRef<HTMLDivElement>(null)
  const zodiac = useProfile((s) => s.zodiac)
  const litCount = Math.max(0, ...Object.values(zodiac).map((arr) => arr.length))

  useGSAP(
    () => {
      gsap.fromTo(
        '.zw-seal',
        { scale: 1.6, opacity: 0, rotate: -14 },
        {
          scale: 1, opacity: 1, rotate: 0, duration: 0.45, stagger: 0.09, ease: 'back.out(2.2)',
          scrollTrigger: { trigger: root.current, start: 'top 75%' },
        },
      )
    },
    { scope: root },
  )

  const SIZE = 340
  const R = SIZE / 2 - 30
  return (
    <div ref={root} className="relative mx-auto" style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}>
      <div className="absolute inset-0 rounded-full border border-gold-300/15" />
      <div className="absolute inset-[30px] rounded-full border border-dashed border-gold-300/20" />
      {ZODIAC.map((z) => {
        const a = -Math.PI / 2 + (z.index * 2 * Math.PI) / 12
        const x = SIZE / 2 + R * Math.cos(a) - 21
        const y = SIZE / 2 + R * Math.sin(a) - 21
        return (
          <div key={z.index} className="zw-seal absolute" style={{ left: x, top: y }} title={`${z.name} · ${z.branch}`}>
            <ZodiacSeal index={z.index} lit={z.index < litCount} size={42} />
          </div>
        )
      })}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-16 pointer-events-none">
        <p className="font-serifsc text-[14px] text-bone/90 leading-relaxed">每胜 3 场，点亮一枚生肖</p>
        <p className="text-[12px] text-dim mt-1.5 leading-relaxed">十二生肖齐，开升阶试炼</p>
      </div>
    </div>
  )
}

/* ============================ TierLadder ============================ */

const TIER_CONDITIONS: Record<string, string> = {
  huang: '初入牌局之间，皆以黄阶立身。',
  xuan: '四花色大陆生肖各满 12 枚，晋升玄阶。',
  di: '玄阶之上，四大陆生肖再各满一轮。',
  tian: '地阶之上，四大陆生肖第三轮齐明。',
  honghuang: '??? —— 传说之位，虹彩雾中，无人见过晋升者。',
}

export function TierLadder() {
  const root = useRef<HTMLDivElement>(null)
  const tier = useProfile((s) => s.tier)
  const currentIdx = TIER_ORDER.indexOf(tier)

  useGSAP(
    () => {
      gsap.fromTo(
        '.tl-row',
        { opacity: 0.25, x: -12 },
        {
          opacity: 1, x: 0, duration: 0.5, stagger: 0.18, ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 78%' },
        },
      )
    },
    { scope: root },
  )

  return (
    <div ref={root} className="flex flex-col">
      {TIERS.map((t, i) => {
        const reached = t.id !== 'honghuang' && TIER_ORDER.indexOf(t.id as Tier) <= currentIdx
        const isHonghuang = t.id === 'honghuang'
        return (
          <div key={t.id} className="tl-row relative flex items-center gap-4 py-3" style={{ opacity: isHonghuang ? 0.55 : undefined }}>
            {i < TIERS.length - 1 && (
              <span
                className="absolute left-[27px] top-[56px] bottom-[-8px] w-px"
                style={{ background: reached ? 'rgba(227,194,124,.55)' : 'rgba(227,194,124,.14)' }}
              />
            )}
            <TierSeal tier={t.id} size={54} glow={reached} />
            <div className="flex-1">
              <p className="flex items-center gap-2.5">
                <span
                  className="font-serifsc font-semibold text-[17px]"
                  style={{ color: isHonghuang ? '#F8E9C0' : t.color }}
                >
                  {t.name}
                </span>
                {reached && <span className="text-[10px] tracking-[.2em] text-gold-300 border border-gold-300/40 rounded-full px-2 py-px">已至</span>}
                {t.id === tier && <span className="seal-stamp text-[10px] px-1.5 py-0.5">当前</span>}
              </p>
              <p className="text-[12px] text-dim mt-1">{TIER_CONDITIONS[t.id]}</p>
            </div>
            {t.id !== 'honghuang' && <SuitIcon suit={(['spade', 'heart', 'club', 'diamond'] as const)[i % 4]} size={16} className="opacity-40" />}
          </div>
        )
      })}
    </div>
  )
}

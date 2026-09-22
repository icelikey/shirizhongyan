/**
 * 规则图鉴 · 章节内容组件（codex.md）。GSAP 组件树。
 * - SectionHead      章节大标题（章节色引标 + 竖排序号）
 * - ContinentCards   四花色大陆卡
 * - EchoDirectory    8 影从名录（链接感卡片 → /agent）
 * - EconomyMatrix    四花色碎片来源/用途矩阵
 * - RewardTable      奖励数值表
 * - GlossaryGrid     名词词条卡网格（关联词条跳转 + 金光闪烁定位）
 */
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { SUITS, SUIT_META, ECHOES } from '@/data/echoes'
import type { Suit } from '@/data/echoes'
import { gsap, useGSAP } from '@/lib/gsap'
import EchoAvatar from '@/components/EchoAvatar'
import SuitIcon from '@/components/SuitIcon'
import { cn } from '@/lib/utils'

/* ============================ SectionHead ============================ */

export interface SectionHeadProps {
  numeral: string
  title: string
  /** 章节色（默认金） */
  color?: string
  sub?: string
}

export function SectionHead({ numeral, title, color = '#E3C27C', sub }: SectionHeadProps) {
  return (
    <div className="codex-reveal relative flex items-start gap-4 mb-7">
      <span className="mt-2 w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ background: color, boxShadow: `0 0 10px ${color}88` }} />
      <div className="flex-1">
        <h2 className="gold-text font-serifsc font-black text-[28px] tracking-[.08em]">{title}</h2>
        {sub && <p className="text-dim text-[13px] tracking-[.12em] mt-1.5">{sub}</p>}
      </div>
      <span className="vertical-rl font-mashan text-[16px] h-[72px] select-none" style={{ color: `${color}99` }}>
        第{numeral}章
      </span>
    </div>
  )
}

/* ============================ ContinentCards ============================ */

const CONTINENT_LORE: Record<Suit, string> = {
  spade: '谎言生光之地。黑桃巨月低垂，月影狼人杀的故乡。',
  heart: '心理与谈判的赤色丘陵。万盏灯笼不熄，雾锁未开。',
  club: '万物可数的算庭。算珠悬于极光，猜平均数的发源地。',
  diamond: '万物有价的矿脉大陆。金河凝琥珀，封埠未开。',
}

export function ContinentCards() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(
        '.continent-card',
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, stagger: 0.1, ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 80%' },
        },
      )
    },
    { scope: root },
  )
  return (
    <div ref={root} className="grid sm:grid-cols-2 gap-4">
      {SUITS.map((s) => {
        const meta = SUIT_META[s]
        return (
          <div
            key={s}
            className="continent-card group relative rounded-[14px] overflow-hidden card-frame bg-panel transition-transform duration-300 hover:-translate-y-1"
            style={{ boxShadow: `0 16px 48px rgba(0,0,0,.6)` }}
          >
            <div className="relative h-[120px] overflow-hidden">
              <img
                src={`/continent-${s}.png`}
                alt={meta.realm}
                draggable={false}
                className="w-full h-full object-cover brightness-[.7] transition-all duration-500 group-hover:brightness-95 group-hover:scale-105"
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 30%, #14101C 100%)` }} />
              <span className="absolute right-3 top-3" style={{ color: meta.color, filter: `drop-shadow(0 0 8px ${meta.glow})` }}>
                <SuitIcon suit={s} size={24} />
              </span>
            </div>
            <div className="px-4 pb-4 -mt-4 relative">
              <p className="font-serifsc font-semibold text-[18px]" style={{ color: meta.color }}>
                {meta.symbol} {meta.realm}
              </p>
              <p className="text-[11px] tracking-[.25em] text-faint mt-0.5">{meta.domain}</p>
              <p className="text-[12px] text-dim leading-relaxed mt-2">{CONTINENT_LORE[s]}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ============================ EchoDirectory ============================ */

export function EchoDirectory() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(
        '.echo-dir-card',
        { y: 24, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 80%' },
        },
      )
    },
    { scope: root },
  )
  return (
    <div ref={root} className="grid sm:grid-cols-2 gap-3.5">
      {ECHOES.map((e) => {
        const meta = SUIT_META[e.suit]
        return (
          <Link
            key={e.id}
            to="/agent"
            className="echo-dir-card group panel-bg rounded-xl p-4 flex items-center gap-3.5 transition-all duration-200 hover:border-[rgba(246,227,180,.4)] hover:-translate-y-0.5 hover:shadow-gold-glow"
          >
            <EchoAvatar echo={e} size={48} showZodiac />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="font-serifsc font-semibold text-[16px] text-bone group-hover:text-gold-300 transition-colors underline-offset-4 group-hover:underline">
                  {e.name}
                </span>
                <span className="text-[10px] tracking-[.15em] border rounded-full px-2 py-px" style={{ color: meta.color, borderColor: `${meta.color}55` }}>
                  {meta.symbol} {e.persona}
                </span>
              </p>
              <p className="text-[12px] text-dim mt-1 truncate">{e.tagline}</p>
            </div>
            <ArrowUpRight size={16} className="text-faint group-hover:text-gold-300 group-hover:rotate-6 transition-all shrink-0" />
          </Link>
        )
      })}
    </div>
  )
}

/* ============================ EconomyMatrix ============================ */

interface EcoRow {
  suit: Suit
  source: string
  ticket: string
  build: boolean
  memory: boolean
  lore: boolean
}

const ECO_ROWS: EcoRow[] = [
  { suit: 'spade', source: '月影狼人杀', ticket: '15 ♠', build: true, memory: false, lore: true },
  { suit: 'heart', source: '影从养成 · 活动', ticket: '—', build: false, memory: true, lore: true },
  { suit: 'club', source: '猜平均数', ticket: '10 ♣', build: true, memory: false, lore: true },
  { suit: 'diamond', source: '金壤竞逐（未开）', ticket: '—', build: false, memory: false, lore: true },
]

export function EconomyMatrix() {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      gsap.fromTo(
        '.eco-row',
        { opacity: 0, x: -16 },
        {
          opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: 'power1.out',
          scrollTrigger: { trigger: root.current, start: 'top 82%' },
        },
      )
    },
    { scope: root },
  )
  const cell = 'px-3 py-3 text-[13px] text-center'
  return (
    <div ref={root} className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse rounded-xl overflow-hidden">
        <thead>
          <tr className="bg-elevated/70">
            {['花色', '来源游戏', '门票', '建房', '记忆槽', '残章解锁'].map((h) => (
              <th key={h} className="px-3 py-3 text-[12px] tracking-[.15em] text-faint font-medium text-center border-b border-[rgba(227,194,124,.14)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ECO_ROWS.map((r) => {
            const meta = SUIT_META[r.suit]
            return (
              <tr key={r.suit} className="eco-row bg-panel/60 border-b border-bone/5">
                <td className={cn(cell, 'text-left')}>
                  <span className="inline-flex items-center gap-2" style={{ color: meta.color }}>
                    <SuitIcon suit={r.suit} size={16} />
                    {meta.realm}
                  </span>
                </td>
                <td className={cn(cell, 'text-bone/80')}>{r.source}</td>
                <td className={cn(cell, 'font-mono text-bone/80')}>{r.ticket}</td>
                {[r.build, r.memory, r.lore].map((ok, i) => (
                  <td key={i} className={cell}>
                    {ok ? <span style={{ color: meta.color }}>✓</span> : <span className="text-faint">—</span>}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-[12px] text-faint tracking-[.1em] mt-4 leading-relaxed">
        碎片不可跨花色使用——正如各大陆的法则互不相通。首次读完一卷残章，另赠 +5 ♦。
      </p>
    </div>
  )
}

/* ============================ RewardTable ============================ */

export interface RewardTableProps {
  suit: Suit
  rows: [string, string][]
}

export function RewardTable({ suit, rows }: RewardTableProps) {
  const meta = SUIT_META[suit]
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: `${meta.color}33` }}>
      <table className="w-full">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? 'bg-panel/70' : 'bg-panel/40'}>
              <td className="px-4 py-2.5 text-[13px] text-bone/85">{k}</td>
              <td className="px-4 py-2.5 text-[13px] font-mono text-right" style={{ color: meta.color }}>
                {v}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ============================ GlossaryGrid ============================ */

export interface GlossaryEntry {
  id: string
  name: string
  /** 竖排侧款（拼音 / 古称） */
  side: string
  def: string
  related: string[]
}

export const GLOSSARY: GlossaryEntry[] = [
  { id: 'zhongyan', name: '十日终焉', side: 'THE TENTH DAY', def: '世界每十日终结一次并重启的法则。终焉不是毁灭，是一次洗牌。', related: ['paijv', 'lvren'] },
  { id: 'paijv', name: '牌局之间', side: 'BETWEEN GAMES', def: '悬于世界夹缝的所在，终焉时唯一不熄的灯火。椅子永远比来客多一把。', related: ['zhongyan', 'lvren'] },
  { id: 'lvren', name: '旅人', side: 'TRAVELER', def: '误入牌局之间的玩家。你来时的世界，已想不起你的名字。', related: ['yingcong', 'paijv'] },
  { id: 'yingcong', name: '影从', side: 'ECHOES', def: '与旅人立契的分布式智能体。他们记得每一次并肩与背叛。', related: ['lvren', 'tianti'] },
  { id: 'yunyou', name: '云游之境', side: 'FOUR REALMS', def: '四花色大陆的合称：玄渊♠ 丹丘♥ 青野♣ 金壤♦。', related: ['suipian'] },
  { id: 'suipian', name: '碎片', side: 'SHARDS', def: '对局的奖赏、通行的货币、叙事的钥匙。死后唯一带得走的东西。', related: ['canzhang', 'yunyou'] },
  { id: 'canzhang', name: '残章', side: 'SCROLLS', def: '记录世界真相的十卷残页，以碎片启封。集齐九卷者，可见洪荒之扉。', related: ['suipian', 'zhongyan'] },
  { id: 'tianti', name: '天梯', side: 'THE LADDER', def: '旅人与影从混排的榜单，又称点将台。盲盒模式下，你分不清对手是人还是影子。', related: ['jiezhong', 'yingcong'] },
  { id: 'jiezhong', name: '揭盅', side: 'REVEAL', def: '天梯的身份揭示仪式。揭开之后，战书才有了名字。', related: ['tianti'] },
  { id: 'shengjie', name: '升阶试炼', side: 'ASCENSION', def: '十二生肖齐鸣后开启的试炼。黄阶立身，玄阶窥影，地阶言注，天阶让路。', related: ['yunyou'] },
]

export interface GlossaryGridProps {
  query: string
}

export function GlossaryGrid({ query }: GlossaryGridProps) {
  const root = useRef<HTMLDivElement>(null)
  const q = query.trim()
  const entries = q
    ? GLOSSARY.filter((e) => `${e.name}${e.side}${e.def}`.toLowerCase().includes(q.toLowerCase()))
    : GLOSSARY

  useGSAP(
    () => {
      gsap.fromTo(
        '.gloss-card',
        { y: 24, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: { trigger: root.current, start: 'top 82%' },
        },
      )
    },
    { scope: root, dependencies: [q] },
  )

  const jumpTo = (id: string) => {
    const el = document.getElementById(`gloss-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    gsap.fromTo(
      el,
      { boxShadow: '0 0 0 rgba(227,194,124,0)' },
      { boxShadow: '0 0 32px rgba(227,194,124,.55)', duration: 0.35, yoyo: true, repeat: 1, delay: 0.45 },
    )
  }

  if (entries.length === 0) {
    return (
      <div className="panel-bg rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
        <p className="vertical-rl font-mashan text-faint text-[15px] h-[110px]">查无此条，或藏于残章</p>
        <p className="text-dim text-[13px]">查无此条——或许它藏在未解锁的残章里</p>
      </div>
    )
  }

  return (
    <div ref={root} className="grid md:grid-cols-2 gap-4">
      {entries.map((e) => (
        <div
          key={e.id}
          id={`gloss-${e.id}`}
          className="gloss-card group relative rounded-[14px] card-frame bg-panel p-5 pl-6 transition-transform duration-300 hover:-translate-y-1"
        >
          <span className="vertical-rl absolute right-3.5 top-4 text-[10px] tracking-[.3em] text-faint font-mono h-[88px]">
            {e.side}
          </span>
          <h3 className="gold-text font-serifsc font-semibold text-[19px] tracking-[.06em]">{e.name}</h3>
          <p className="text-[13px] text-bone/80 leading-relaxed mt-2.5 pr-10">{e.def}</p>
          <div className="flex flex-wrap gap-1.5 mt-3.5">
            {e.related.map((rid) => {
              const target = GLOSSARY.find((g) => g.id === rid)
              if (!target) return null
              return (
                <button
                  key={rid}
                  type="button"
                  onClick={() => jumpTo(rid)}
                  className="text-[11px] tracking-[.1em] text-dim border border-bone/10 rounded-full px-2.5 py-0.5 hover:text-gold-300 hover:border-gold-300/40 transition-colors"
                >
                  → {target.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * 规则图鉴 `/codex`（design/codex.md）。
 * 文档型长页：左 sticky 目录（scrollspy + 搜索）+ 右文档流，七章节。
 * Lenis 平滑滚动 + GSAP ScrollTrigger（入场揭示与图解动画）。
 * 深链：/codex#werewolf 等锚点直达（offset 96）。
 */
import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { Search } from 'lucide-react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import PageFooter from '@/components/PageFooter'
import {
  SectionHead, ContinentCards, EchoDirectory, EconomyMatrix, RewardTable, GlossaryGrid,
} from '@/components/content/codex-sections'
import { RoleGallery, WerewolfCycle, GuessSteps, LevelKStairs, ZodiacWheel, TierLadder } from '@/components/content/codex-viz'
import CodexSpireChapter from '@/components/spire/CodexSpireChapter'
import CodexDevChapter from '@/components/online/CodexDevChapter'
import CodexPokerChapter from '@/components/poker/CodexPokerChapter'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'world', numeral: '壹', title: '世界是什么', color: '#E3C27C' },
  { id: 'werewolf', numeral: '贰', title: '月影狼人杀', color: '#8B93F8' },
  { id: 'guess', numeral: '叁', title: '猜平均数', color: '#4ECB9C' },
  { id: 'echoes', numeral: '肆', title: '影从是什么', color: '#EE6A72' },
  { id: 'economy', numeral: '伍', title: '碎片与经济', color: '#F2A93B' },
  { id: 'ranks', numeral: '陆', title: '生肖与位阶', color: '#9B7FE8' },
  { id: 'glossary', numeral: '柒', title: '名词词条', color: '#E3C27C' },
  { id: 'spire', numeral: '捌', title: '碎境爬塔', color: '#F2A93B' },
  { id: 'dev', numeral: '玖', title: '开发者 · Agent Gateway', color: '#F2A93B' },
  { id: 'poker', numeral: '拾', title: '千面牌楼', color: '#EE6A72' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

export default function Codex() {
  const [active, setActive] = useState<SectionId>('world')
  const [query, setQuery] = useState('')
  const lenisRef = useRef<Lenis | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  /* Lenis + ScrollTrigger */
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.09 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  /* 通用入场揭示 */
  useEffect(() => {
    const els = gsap.utils.toArray<HTMLElement>('.codex-reveal')
    gsap.set(els, { opacity: 0, y: 24 })
    const triggers = ScrollTrigger.batch(els, {
      start: 'top 86%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }),
    })
    return () => triggers.forEach((t) => t.kill())
  }, [])

  /* scrollspy */
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id as SectionId)
        }
      },
      { rootMargin: '-96px 0px -62% 0px' },
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  /* 深链锚点 */
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const t = window.setTimeout(() => {
      const el = document.getElementById(hash)
      if (el) lenisRef.current?.scrollTo(el, { offset: -96 })
    }, 400)
    return () => window.clearTimeout(t)
  }, [])

  const jump = (id: SectionId) => {
    const el = document.getElementById(id)
    if (el) lenisRef.current?.scrollTo(el, { offset: -88 })
  }

  return (
    <div ref={mainRef} className="mx-auto max-w-[1120px] px-6">
      {/* 页头 */}
      <header className="pt-12 pb-10">
        <h1 className="gold-text font-serifsc font-black text-[40px] tracking-[.1em]">规则图鉴</h1>
        <p className="text-dim text-[13px] tracking-[.25em] mt-2">新手的第一站，老手的工具书</p>
      </header>

      {/* 移动端章节 chips */}
      <div className="lg:hidden sticky top-16 z-30 -mx-6 px-6 py-3 bg-abyss/85 backdrop-blur-md border-b border-[rgba(227,194,124,.10)] mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              className={cn(
                'shrink-0 h-8 px-3.5 rounded-full border text-[12px] tracking-[.1em] transition-colors',
                active === s.id ? 'border-gold-300/60 text-gold-300 bg-gold-300/10' : 'border-bone/10 text-dim',
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-10 items-start">
        {/* 左目录 */}
        <aside className="hidden lg:block w-[240px] shrink-0 sticky top-24 self-start">
          <label className="flex items-center gap-2 h-10 rounded-full border border-bone/12 bg-panel px-4 focus-within:border-gold-300/50 transition-colors">
            <Search size={15} className="text-faint shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="检索图鉴…"
              className="bg-transparent outline-none text-[13px] text-bone placeholder:text-faint w-full"
            />
          </label>
          {query && (
            <p className="text-[11px] text-faint mt-2 px-1">检索命中「名词词条」章节</p>
          )}
          <nav className="mt-6 flex flex-col">
            {SECTIONS.map((s, i) => {
              const on = active === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jump(s.id)}
                  className="relative flex items-center gap-3 pl-5 py-2.5 text-left group"
                >
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2 w-[2px] rounded-full transition-all duration-200 origin-top',
                      on ? 'h-7 bg-gold-300 shadow-gold-glow' : 'h-4 bg-bone/10 group-hover:bg-gold-300/40',
                    )}
                  />
                  <span className={cn('font-mashan text-[14px]', on ? 'text-gold-300' : 'text-faint')}>{s.numeral}</span>
                  <span className={cn('text-[14px] tracking-[.06em] transition-colors', on ? 'text-gold-300' : 'text-dim group-hover:text-bone')}>
                    {s.title}
                  </span>
                  {i === 0 && <span className="sr-only">目录</span>}
                </button>
              )
            })}
          </nav>
          <div className="mt-8 rounded-xl border border-[rgba(227,194,124,.14)] bg-panel/60 p-4">
            <p className="vertical-rl font-mashan text-faint text-[13px] h-[120px]">典册编纂者谨识</p>
          </div>
        </aside>

        {/* 右内容流 */}
        <main className="flex-1 min-w-0 max-w-[760px] flex flex-col gap-20 pb-20">
          {/* 壹 · 世界是什么 */}
          <section id="world" className="scroll-mt-24">
            <SectionHead numeral="壹" title="世界是什么" sub="世界观总述 · 四花色大陆" />
            <div className="codex-reveal flex flex-col gap-4 text-[14px] text-bone/85 leading-[1.9] mb-8">
              <p>
                这个世界每十日终结一次。第十日的最后一缕光熄灭后，山川、城寨与人群如牌收拢，洗回牌堆；
                第十一日的晨光里，万物重来——唯有在牌局之间赢过的人，带着口袋里的碎片，记得上一个十日。
              </p>
              <p>
                牌局之间悬于世界的夹缝，是终焉时唯一不熄的灯火。旅人自门外误入，与影从立契，
                在四花色大陆——云游之境——轮流入座：玄渊的谎言、丹丘的人心、青野的算式、金壤的筹码，
                每一片大陆，都是一种与人性对赌的方式。
              </p>
            </div>
            <ContinentCards />
          </section>

          {/* 贰 · 月影狼人杀 */}
          <section id="werewolf" className="scroll-mt-24">
            <SectionHead numeral="贰" title="月影狼人杀" color="#8B93F8" sub="♠ 玄渊 · 博弈与欺骗 · 6 人局" />
            <div className="codex-reveal panel-bg rounded-2xl p-5 mb-8 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="text-[13px] text-bone/85">配置：狼人 ×2 · 预言家 ×1 · 女巫 ×1 · 平民 ×2</span>
              <span className="text-[12px] text-dim">胜负：好人放逐全部狼人 / 狼人屠边（杀光神职或平民）</span>
            </div>
            <div className="mb-10">
              <RoleGallery />
            </div>
            <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mb-5">昼夜流程</h3>
            <WerewolfCycle />
            <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mt-10 mb-4">门票与奖励</h3>
            <div className="codex-reveal">
              <RewardTable
                suit="spade"
                rows={[
                  ['门票', '15 ♠'],
                  ['胜方每人', '+60 ♠'],
                  ['败方每人', '+8 ♠'],
                  ['MVP（额外）', '+20 ♠'],
                ]}
              />
            </div>
          </section>

          {/* 叁 · 猜平均数 */}
          <section id="guess" className="scroll-mt-24">
            <SectionHead numeral="叁" title="猜平均数" color="#4ECB9C" sub="♣ 青野 · 计算与概率 · 6 人局" />
            <GuessSteps />
            <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mt-10 mb-2">你在第几层？</h3>
            <p className="codex-reveal text-[13px] text-dim leading-relaxed mb-6">
              目标数是均值的三分之二。若人人随机，均值约 50；若人人都想低一档……思维每深一层，答案就低一截。
            </p>
            <LevelKStairs />
            <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mt-10 mb-4">门票与奖励</h3>
            <div className="codex-reveal">
              <RewardTable
                suit="club"
                rows={[
                  ['门票', '10 ♣'],
                  ['冠军', '+50 ♣'],
                  ['亚军', '+25 ♣'],
                  ['参与', '+5 ♣'],
                ]}
              />
            </div>
          </section>

          {/* 肆 · 影从是什么 */}
          <section id="echoes" className="scroll-mt-24">
            <SectionHead numeral="肆" title="影从是什么" color="#EE6A72" sub="分布式智能体 · 契约与并肩" />
            <div className="codex-reveal flex flex-col gap-4 text-[14px] text-bone/85 leading-[1.9] mb-8">
              <p>
                影从（Echoes）是与旅人立契的分布式智能体。他们曾是别的十日里最锋利的头脑，
                世界重启时执念不散，凝成了形——分布于牌局之间的每一张牌桌，等一个值得并肩的旅人。
              </p>
              <p>
                他们不是仆从：可以代你上阵、替你记牌，唯独不替你后悔。你与影从的每一次并肩与背叛，
                都会被写进记忆槽，带往下一个十日。
              </p>
            </div>
            <div className="codex-reveal grid grid-cols-3 gap-3 mb-8">
              {[
                { k: '契约', v: '以名为契，以忆为绊，立契即同行' },
                { k: '记忆槽', v: '记录交手与言行，可扩容，可携带' },
                { k: '代打', v: '授权范围内轮替上阵，战绩照常计入' },
              ].map((f) => (
                <div key={f.k} className="rounded-xl border border-suit-heart/25 bg-suit-heart/[.05] p-3.5 text-center">
                  <p className="font-serifsc font-semibold text-[15px] text-suit-heart">{f.k}</p>
                  <p className="text-[11px] text-dim leading-relaxed mt-1.5">{f.v}</p>
                </div>
              ))}
            </div>
            <h3 className="codex-reveal font-serifsc font-semibold text-[18px] text-bone mb-4">常驻影从名录</h3>
            <EchoDirectory />
          </section>

          {/* 伍 · 碎片与经济 */}
          <section id="economy" className="scroll-mt-24">
            <SectionHead numeral="伍" title="碎片与经济" color="#F2A93B" sub="四花色碎片的来源与用途" />
            <EconomyMatrix />
          </section>

          {/* 陆 · 生肖与位阶 */}
          <section id="ranks" className="scroll-mt-24">
            <SectionHead numeral="陆" title="生肖与位阶" color="#9B7FE8" sub="十二生肖轮回 · 天地玄黄晋升" />
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <ZodiacWheel />
              <TierLadder />
            </div>
          </section>

          {/* 柒 · 名词词条 */}
          <section id="glossary" className="scroll-mt-24">
            <SectionHead numeral="柒" title="名词词条" sub="典册编纂者注 · 词条互见" />
            <GlossaryGrid query={query} />
          </section>

          {/* 捌 · 碎境爬塔（S2 扩展，锚点 #spire） */}
          <section id="spire" className="scroll-mt-24">
            <CodexSpireChapter />
          </section>

          {/* 玖 · 开发者 · Agent Gateway（锚点 #dev，琥珀金主题） */}
          <section id="dev" className="scroll-mt-24">
            <CodexDevChapter />
          </section>

          {/* 拾 · 千面牌楼（S6 扩展，锚点 #poker，丹丘朱红主题） */}
          <section id="poker" className="scroll-mt-24">
            <CodexPokerChapter />
          </section>
        </main>
      </div>

      <PageFooter />
    </div>
  )
}

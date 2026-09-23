import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import CharacterCard from '@/components/CharacterCard'
import { ECHOES, SUIT_META, type Echo } from '@/data/echoes'
import { getShanHaiAnchor } from '@/data/shanhaijing'

const SHOWCASE_IDS = ['baize', 'eshou', 'xuanji', 'zhuyin']

const ABILITIES: Record<string, { label: string; detail: string; tendency: number }> = {
  baize: { label: '见证', detail: '记录公开信息的矛盾点，优先追踪前后不一致的陈述。', tendency: 82 },
  eshou: { label: '倒影', detail: '把一次可疑行动包装成另一种解释，逼迫对手先暴露判断。', tendency: 67 },
  xuanji: { label: '演算', detail: '把发言、下注与剩余牌面压成概率变化，寻找最小风险线。', tendency: 91 },
  zhuyin: { label: '借时', detail: '保存一次资源或行动窗口，在关键回合换取额外选择。', tendency: 74 },
}

type ViewMode = 'cards' | 'anchors'

export default function CharacterShowcase() {
  const showcase = useMemo(
    () => SHOWCASE_IDS.map((id) => ECHOES.find((echo) => echo.id === id)).filter((echo): echo is Echo => Boolean(echo)),
    [],
  )
  const [view, setView] = useState<ViewMode>('cards')
  const [selectedId, setSelectedId] = useState(SHOWCASE_IDS[0])
  const selected = ECHOES.find((echo) => echo.id === selectedId) ?? ECHOES[0]
  const suit = SUIT_META[selected.suit]
  const ability = ABILITIES[selected.id]
  const anchor = getShanHaiAnchor(selected.id)

  return (
    <main className="h-[100dvh] overflow-hidden px-5 py-4 sm:px-8 lg:px-12">
      <div className="mx-auto flex h-full max-w-[1280px] flex-col">
        <header className="flex min-h-[56px] shrink-0 items-center justify-between gap-4 border-b border-[rgba(227,194,124,.12)]">
          <Link to="/" className="group inline-flex items-center gap-2 text-[12px] tracking-[.18em] text-faint transition-colors hover:text-gold-300">
            <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" />
            返回世界序章
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-[rgba(227,194,124,.18)] bg-[#14101C99] p-1 sm:flex" aria-label="角色卡菜单">
            <button
              type="button"
              onClick={() => setView('cards')}
              className={`rounded-full px-4 py-2 text-[11px] tracking-[.18em] transition-colors ${view === 'cards' ? 'bg-gold-300/15 text-gold-100' : 'text-faint hover:text-gold-300'}`}
            >
              角色卡
            </button>
            <button
              type="button"
              onClick={() => setView('anchors')}
              className={`rounded-full px-4 py-2 text-[11px] tracking-[.18em] transition-colors ${view === 'anchors' ? 'bg-gold-300/15 text-gold-100' : 'text-faint hover:text-gold-300'}`}
            >
              山海锚点
            </button>
            <Link to="/lobby" className="rounded-full px-4 py-2 text-[11px] tracking-[.18em] text-faint transition-colors hover:text-gold-300">
              进入大厅
            </Link>
          </nav>

          <span className="rounded-full border border-[rgba(227,194,124,.25)] bg-[#14101C99] px-3 py-1.5 font-mono text-[10px] tracking-widest text-gold-100/70">
            LOCAL SHOWCASE · V0.1
          </span>
        </header>

        <section className="flex shrink-0 items-end justify-between gap-5 py-7 sm:py-8">
          <div className="max-w-[760px]">
            <div className="mb-3 flex items-center gap-3 text-[11px] tracking-[.3em] text-gold-300">
              <Sparkles size={15} />
              影从视觉试作 · 角色卡牌
            </div>
            <h1 className="gold-text font-serifsc text-[35px] font-black leading-[1.1] tracking-[.08em] sm:text-[48px]">四张牌，四种判断</h1>
            <p className="mt-3 max-w-[680px] text-[13px] leading-6 text-bone/60 sm:text-[14px]">
              选定一张卡，查看它的山海意象与 Agent 决策倾向。卡面制造进入牌局的仪式感，公开规则和裁判链决定真实结果。
            </p>
          </div>
          <div className="hidden text-right text-[10px] leading-5 tracking-[.15em] text-faint lg:block">
            <div>四境 · 四种判断</div>
            <div>菜单切换 · 面板查看</div>
          </div>
        </section>

        <div className="flex min-h-0 flex-1 flex-col pb-3">
          <div className="mb-4 flex items-center gap-2 sm:hidden">
            <button type="button" onClick={() => setView('cards')} className={`rounded-full border px-3 py-1.5 text-[11px] ${view === 'cards' ? 'border-gold-300/60 text-gold-100' : 'border-white/10 text-faint'}`}>角色卡</button>
            <button type="button" onClick={() => setView('anchors')} className={`rounded-full border px-3 py-1.5 text-[11px] ${view === 'anchors' ? 'border-gold-300/60 text-gold-100' : 'border-white/10 text-faint'}`}>山海锚点</button>
            <Link to="/lobby" className="ml-auto rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-faint">进入大厅</Link>
          </div>

          {view === 'cards' ? (
            <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
              <section aria-label="角色卡牌展示" className="grid min-h-0 grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {showcase.map((echo) => (
                  <CharacterCard key={echo.id} echo={echo} selected={echo.id === selectedId} onSelect={() => setSelectedId(echo.id)} className="h-full min-h-0 aspect-auto" />
                ))}
              </section>

              <motion.section
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="panel-bg min-h-0 overflow-y-auto rounded-[18px]"
              >
                <div className="flex min-h-full flex-col p-5 sm:p-6">
                  <div className="relative mb-5 h-36 overflow-hidden rounded-[12px] sm:h-44">
                    <img src={selected.cardArt ?? selected.portrait} alt="" className="h-full w-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-abyss via-abyss/20 to-transparent" />
                    <span className="absolute bottom-3 left-3 font-serifsc text-[20px] tracking-[.18em] text-bone">{selected.name}</span>
                    <span className="absolute bottom-3 right-3 font-cinzel text-xl" style={{ color: suit.color }}>{suit.symbol}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[.2em]" style={{ color: suit.color }}>
                    <span>{suit.realm}</span>
                    <span className="text-faint">/</span>
                    <span>{suit.domain}</span>
                  </div>
                  <h2 className="mt-2 font-serifsc text-[26px] font-black tracking-[.12em] text-bone">{selected.name}</h2>
                  <p className="mt-1 text-[12px] leading-5 text-faint">{selected.tagline}</p>

                  <div className="mt-5 rounded-[12px] border border-[rgba(227,194,124,.12)] bg-black/10 p-4">
                    <span className="rounded-full border px-3 py-1 text-[11px]" style={{ color: suit.color, borderColor: `${suit.color}55`, background: `${suit.color}12` }}>
                      异能：{ability.label}
                    </span>
                    <p className="mt-3 text-[12px] leading-6 text-bone/60">{ability.detail}</p>
                  </div>

                  {anchor && (
                    <div className="mt-4 border-l border-[rgba(227,194,124,.28)] pl-3">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[.15em] text-gold-300">
                        <span>山海锚点 · {anchor.name}</span>
                        <span className="text-faint">{anchor.sourceLabel}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-bone/55">{anchor.motif}</p>
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-[10px] tracking-widest text-faint">
                      <span>AI 决策倾向</span>
                      <span style={{ color: suit.color }}>{ability.tendency}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${ability.tendency}%` }} transition={{ duration: 0.7 }} className="h-full rounded-full" style={{ background: suit.color }} />
                    </div>
                  </div>

                  <Link to="/lobby" className="group mt-auto inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(227,194,124,.4)] px-5 py-3 text-[12px] tracking-[.15em] text-gold-100 transition-all hover:border-gold-300 hover:bg-gold-300/10">
                    带它进入大厅
                    <ChevronRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.section>
            </div>
          ) : (
            <section aria-label="山海锚点" className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                {showcase.map((echo) => {
                  const echoAnchor = getShanHaiAnchor(echo.id)
                  const echoSuit = SUIT_META[echo.suit]
                  if (!echoAnchor) return null
                  return (
                    <button
                      type="button"
                      key={echo.id}
                      onClick={() => { setSelectedId(echo.id); setView('cards') }}
                      className="panel-bg group flex min-h-[145px] items-stretch overflow-hidden rounded-[16px] text-left transition-transform hover:-translate-y-1"
                    >
                      <div className="relative w-28 shrink-0 overflow-hidden">
                        <img src={echo.cardArt ?? echo.portrait} alt={`${echo.name}角色卡立绘`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#14101C]" />
                      </div>
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-serifsc text-[19px] tracking-[.12em] text-bone">{echoAnchor.name}</span>
                          <span className="font-cinzel text-lg" style={{ color: echoSuit.color }}>{echoSuit.symbol}</span>
                        </div>
                        <div className="mt-1 text-[10px] tracking-[.15em]" style={{ color: echoSuit.color }}>{echoAnchor.sourceLabel}</div>
                        <p className="mt-3 text-[12px] leading-5 text-bone/60">{echoAnchor.motif}</p>
                        <div className="mt-2 text-[10px] text-faint">玩法落点：{echoAnchor.gameplay}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[rgba(227,194,124,.12)] py-3 text-[10px] leading-5 text-faint">
          <span>原创视觉草案 · 古典意象只作世界锚点</span>
          <span className="hidden font-mono tracking-wider sm:block">IMAGE ASSET / 4 · MENU / 2 · CARD SYSTEM / 1</span>
        </footer>
      </div>
    </main>
  )
}

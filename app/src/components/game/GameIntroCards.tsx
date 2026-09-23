import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import type { Suit } from '@/data/echoes'
import SuitIcon from '@/components/SuitIcon'
import GoldButton from '@/components/GoldButton'
import { cn } from '@/lib/utils'

export interface GameIntroCard {
  eyebrow: string
  title: string
  body: string
  note: string
  /** 本局第一次入场时留下的剧情线索，避免玩法说明只有规则没有世界。 */
  clue?: string
}

export interface GameIntroSpec {
  key: string
  title: string
  subtitle: string
  /** 16:9 横屏播片卡主视觉，文字始终由网页叠加，避免图像文字漂移。 */
  visual?: string
  cards: GameIntroCard[]
}

const DEFAULT_INTROS: Record<Suit, GameIntroSpec> = {
  club: {
    key: 'guess',
    title: '青野算庭',
    subtitle: '数字是明牌，意图才是暗牌。',
    visual: '/bg-abacus-court.png',
    cards: [
      { eyebrow: '入局 · ♣ 青野', title: '所有人都在猜别人', body: '每人秘密落下一枚数字，目标值由全场选择共同生成。你要计算，也要猜测别人正在计算什么。', note: '选择一个数字 → 等待所有席位落子 → 揭晓目标与名次' },
      { eyebrow: '世界规则', title: '规则先于叙事', body: '青野只负责把每一次选择留下来。胜负由规则书裁定，Agent 可以读到同一份规则并自行规划。', note: '人、影从、外部 Agent 使用同一张牌桌' },
      { eyebrow: '接入方式', title: '让你的智能入席', body: '浏览器玩家可直接落子；外部 Agent 通过 CLI 获取房间、入座并提交动作，观众会看到同一轮对抗。', note: 'CLI 入座后，房间会标出 Agent 在席' },
    ],
  },
  heart: {
    key: 'poll',
    title: '红眼病 · 少数派票决',
    subtitle: '你不是在选正确答案，而是在躲开人群。',
    visual: '/bg-village-night.png',
    cards: [
      { eyebrow: '入局 · ♥ 丹丘', title: '少数派才有回声', body: '所有席位同时选择一个选项。票数最少且唯一的选项获胜，聪明不够，还要判断别人会不会自作聪明。', note: '同时选项 → 公开票型 → 少数派得分' },
      { eyebrow: '涌现', title: '策略会互相改变', body: '同一套选项在不同 Agent 组合里会产生不同的聚散。你看到的每一次拥挤，都会成为下一轮的情报。', note: '历史公开，选择保持私密' },
      { eyebrow: '接入方式', title: '人机同桌', body: '真人可以用选项卡直接行动，Agent 则从网关读取规则、席位与历史，自主选择并回到同一张桌上。', note: '观众能同时看到人类决策与 Agent 响应' },
    ],
  },
  diamond: {
    key: 'pirate',
    title: '金壤分潮',
    subtitle: '一份金币，换来一桌承诺。',
    visual: '/bg-danqiu-palace.png',
    cards: [
      { eyebrow: '入局 · ♦ 金壤', title: '先提案，再表决', body: '当前提案人分配全部金币，存活者看到方案后逐一表决。方案通过，承诺兑现；方案失败，提案人出局。', note: '分配 → 公开方案 → 表决 → 结算或换人' },
      { eyebrow: '分布式裁判', title: '每个选择都留下证据', body: '规则内核只裁定可验证事实，争议条款可以召集三、五或七名 Agent 组成裁判团。', note: '算法裁判守住底线，Agent 裁判处理边缘' },
      { eyebrow: '接入方式', title: '你的 Agent 会谈判', body: 'CLI Agent 可以入座、提出方案、响应表决；浏览器玩家能实时看到提案变化与人机之间的信任裂缝。', note: '房间状态、行动与结果均可通过公开协议读取' },
    ],
  },
  spade: {
    key: 'spade',
    title: '玄渊',
    subtitle: '这里不询问你是谁，只记录你如何选择。',
    visual: '/bg-nebula-abyss.png',
    cards: [
      { eyebrow: '入界 · ♠ 玄渊', title: '世界由行动组成', body: '《终焉》不是一张静态地图。每一局游戏都会留下事件、判例和记忆，成为下一次进入世界时可被读取的线索。', note: '元规则统一世界，游戏规则定义局内命运' },
      { eyebrow: '裁判机制', title: '规则可以被共同执行', body: '确定性结果交给算法；语义争议交给 AI 或其他玩家的 Agent。裁判席必须是三、五或七人，结果可审计。', note: '参与者不能裁判自己的本局' },
      { eyebrow: '接入方式', title: '让外部智能进入终焉', body: '注册 CLI Agent 后，它可以发现房间、读取规则、入座、行动、接收揭示，并持续参与后续游戏。', note: '同一账号可绑定不同 Agent，身份与行为分开记录' },
    ],
  },
}

function specFor(suit: Suit, override?: GameIntroSpec): GameIntroSpec {
  return override ?? DEFAULT_INTROS[suit]
}

export default function GameIntroCards({ suit, spec: override }: { suit: Suit; spec?: GameIntroSpec }) {
  const spec = useMemo(() => specFor(suit, override), [suit, override])
  const storageKey = `tdg-intro-seen-${spec.key}`
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (sessionStorage.getItem(storageKey) !== '1') setOpen(true)
  }, [storageKey])

  const close = () => {
    sessionStorage.setItem(storageKey, '1')
    setOpen(false)
    setIndex(0)
  }

  const card = spec.cards[index]
  const accent = spec.key === 'fly' ? '#9B7FE8' : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(227,194,124,.18)] px-2.5 text-[10px] tracking-[.12em] text-dim transition-colors hover:border-[rgba(246,227,180,.48)] hover:text-bone"
        title="重新查看玩法与世界观"
      >
        <BookOpen size={13} /> 玩法卡
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(5,4,10,.78)] p-4 backdrop-blur-[14px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${spec.title}玩法介绍`}
              initial={{ opacity: 0, y: 26, scale: .96, rotate: -1.2 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, y: 20, scale: .96 }}
              transition={{ duration: .38, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-[680px] overflow-hidden rounded-[26px] border border-[rgba(227,194,124,.30)] bg-[linear-gradient(145deg,#171022,#0D0A15_70%)] p-5 shadow-[0_24px_100px_rgba(0,0,0,.6)] sm:p-8"
            >
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[rgba(155,127,232,.14)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-14 h-44 w-44 rounded-full bg-[rgba(227,194,124,.12)] blur-3xl" />
              <button type="button" onClick={close} className="absolute right-4 top-4 rounded-full p-2 text-faint transition-colors hover:bg-white/5 hover:text-bone" aria-label="关闭玩法卡">
                <X size={17} />
              </button>

              <div className="relative mb-6 flex items-start gap-3 pr-8">
                <span className="mt-1 flex h-10 w-10 shrink-0 rotate-3 items-center justify-center rounded-xl border border-[rgba(227,194,124,.30)] bg-[rgba(227,194,124,.08)] text-gold-200">
                  <SuitIcon suit={suit} size={21} glow />
                </span>
                <div>
                  <div className="text-[10px] tracking-[.3em] text-faint">终焉 · 世界接入卡</div>
                  <h2 className="mt-1 font-serifsc text-[27px] font-semibold tracking-[.08em] text-bone">{spec.title}</h2>
                  <p className="mt-1 text-[12px] tracking-[.12em] text-gold-100/70">{spec.subtitle}</p>
                </div>
              </div>

              {spec.visual && (
                <div className="relative mb-5 aspect-video overflow-hidden rounded-[20px] border border-[rgba(227,194,124,.26)] bg-[#09070E] shadow-[inset_0_0_36px_rgba(0,0,0,.52)]">
                  <img src={spec.visual} alt="" className="h-full w-full object-cover opacity-75" />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,11,.08),rgba(7,6,11,.16)_42%,rgba(7,6,11,.9))]" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                    <div>
                      <div className="text-[9px] tracking-[.3em] text-gold-200/70">16:9 · 玩法前瞻</div>
                      <div className="mt-1 font-serifsc text-[20px] tracking-[.08em] text-bone">{spec.title}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-[9px] tracking-[.16em] text-bone/55"><Sparkles size={12} /> 世界事件入口</div>
                  </div>
                </div>
              )}

              <div className="relative min-h-[255px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${spec.key}-${index}`}
                    initial={{ opacity: 0, x: index === 0 ? 22 : 34, rotate: 1.5 }}
                    animate={{ opacity: 1, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, x: -25, rotate: -1.5 }}
                    transition={{ duration: .28 }}
                    className="relative overflow-hidden rounded-[20px] border border-[rgba(227,194,124,.26)] bg-[linear-gradient(135deg,rgba(227,194,124,.10),rgba(46,28,67,.28)_46%,rgba(10,8,17,.78))] p-6 sm:p-8"
                  >
                    <div className="absolute right-5 top-4 font-cinzel text-[54px] font-bold text-white/[.05]">0{index + 1}</div>
                    <div className="relative">
                      <div className="mb-4 flex items-center gap-2 text-[10px] tracking-[.28em] text-gold-200/75">
                        <Sparkles size={13} style={accent ? { color: accent } : undefined} /> {card.eyebrow}
                      </div>
                      <h3 className="font-serifsc text-[25px] font-semibold tracking-[.08em] text-bone">{card.title}</h3>
                      <p className="mt-5 max-w-[560px] text-[15px] leading-8 text-bone/85">{card.body}</p>
                      <div className="mt-6 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/[.08] bg-black/20 px-4 py-3 text-[11px] leading-relaxed tracking-[.06em] text-dim">
                          <span className="mb-1 block text-[9px] tracking-[.22em] text-gold-200/60">玩法提示</span>
                          {card.note}
                        </div>
                        {card.clue && (
                          <div className="rounded-xl border border-suit-diamond/20 bg-suit-diamond/[.06] px-4 py-3 text-[11px] leading-relaxed tracking-[.06em] text-dim">
                            <span className="mb-1 block text-[9px] tracking-[.22em] text-suit-diamond/75">线索碎片</span>
                            {card.clue}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="relative mt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {spec.cards.map((_, cardIndex) => (
                    <button key={cardIndex} type="button" aria-label={`第 ${cardIndex + 1} 张玩法卡`} onClick={() => setIndex(cardIndex)} className={cn('h-1.5 rounded-full transition-all', cardIndex === index ? 'w-8 bg-gold-200' : 'w-1.5 bg-white/20 hover:bg-white/40')} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <GoldButton variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ChevronLeft size={14} /> 上张</GoldButton>
                  {index < spec.cards.length - 1 ? (
                    <GoldButton variant="gold" size="sm" onClick={() => setIndex((value) => value + 1)}>继续 <ChevronRight size={14} /></GoldButton>
                  ) : (
                    <GoldButton variant="suit" suit={suit} size="sm" onClick={close}>进入牌局 <Sparkles size={14} /></GoldButton>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

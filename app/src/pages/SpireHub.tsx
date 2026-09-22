/**
 * ============================================================================
 * 碎境爬塔 · 门厅 `/game/spire`（spire-map.md §2，S2）
 * ============================================================================
 * 100dvh 仪式感页：spire-gate.png 底 + 十日倒计时 mini。
 * 三选一构筑风格卡（刃/壁垒/诡道）→ 印章落定 → 门票 12♦ → startRun → /game/spire/map。
 * 含「继续牌局」卡、战绩条、规则速览抽屉。
 * ============================================================================
 */
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, ChevronRight, Play, ScrollText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useProfile } from '@/store/profile'
import { useSpire } from '@/store/spire'
import type { DeckStyle } from '@/data/spire/types'
import { getEcho } from '@/data/echoes'
import CountdownRing from '@/components/CountdownRing'
import FragmentChip from '@/components/FragmentChip'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import { NodeGlyph, RelicIcon } from '@/components/spire/icons'
import { useInkTransition } from '@/components/meta/InkTransition'
import { STARTER_DECKS, STARTER_RELICS, cardView, relicView, useSpireDataReady } from '@/game/spire-data'
import { cn } from '@/lib/utils'

const TICKET = 12

interface StyleMeta {
  id: DeckStyle
  name: string
  sub: string
  color: string
  echoId: string
  desc: string
}

const STYLES: StyleMeta[] = [
  { id: 'blade', name: '刃', sub: '以伤换伤 · 速战速决', color: '#F0655A', echoId: 'zhuyin', desc: '牌组偏攻击，开局遗物「朱砂印」。把每一回合都当成最后一回合打。' },
  { id: 'bulwark', name: '壁垒', sub: '不动如山 · 后发制人', color: '#C98A4B', echoId: 'shouzhuo', desc: '牌组偏格挡，开局遗物「龟甲」。先让自己死不了，再慢慢赢。' },
  { id: 'trick', name: '诡道', sub: '以巧破力 · 杀人无形', color: '#9B7FE8', echoId: 'baixiao', desc: '牌组偏过牌与毒，开局遗物「日晷残片」。赢的方式，对手看不懂。' },
]

/** 牌组预览：合并相邻同 id → 「墨刃 ×4」 */
function deckPreview(ids: string[]): string {
  const out: string[] = []
  let i = 0
  while (i < ids.length) {
    let j = i
    while (j < ids.length && ids[j] === ids[i]) j++
    const n = j - i
    out.push(`${cardView(ids[i]).name}${n > 1 ? ` ×${n}` : ''}`)
    i = j
  }
  return out.join(' · ')
}

const NODE_TYPE_LABEL: Record<string, string> = {
  battle: '战斗', elite: '精英', event: '事件', rest: '篝火', shop: '商店', treasure: '宝箱', boss: '层主',
}

export default function SpireHub() {
  useSpireDataReady()
  const { inkNode, go } = useInkTransition()
  const fragments = useProfile((s) => s.fragments)
  const spendFragments = useProfile((s) => s.spendFragments)

  const phase = useSpire((s) => s.phase)
  const floor = useSpire((s) => s.floor)
  const hp = useSpire((s) => s.hp)
  const maxHp = useSpire((s) => s.maxHp)
  const deckCount = useSpire((s) => s.deck.length)
  const currentNodeId = useSpire((s) => s.currentNodeId)
  const map = useSpire((s) => s.map)
  const stats = useSpire((s) => s.stats)
  const startRun = useSpire((s) => s.startRun)
  const abandonRun = useSpire((s) => s.abandonRun)

  const [stamping, setStamping] = useState<DeckStyle | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  const hasRun = phase === 'map' || phase === 'combat'
  const currentNode = currentNodeId ? map.find((n) => n.id === currentNodeId) : null
  const canAfford = fragments.diamond >= TICKET

  const begin = (style: DeckStyle) => {
    if (stamping) return
    if (fragments.diamond < TICKET) {
      toast.error('♦ 碎片不足，无法登塔', { description: `门票 ${TICKET}♦ · 去大厅对局赢取金壤碎片` })
      return
    }
    setStamping(style)
    // 印章落定（仪式感 900ms）后扣票开局
    window.setTimeout(() => {
      if (!spendFragments('diamond', TICKET)) {
        toast.error('♦ 碎片不足，无法登塔', { description: `门票 ${TICKET}♦` })
        setStamping(null)
        return
      }
      startRun(style, STARTER_DECKS[style], STARTER_RELICS[style])
      toast('门票已付', { description: `-${TICKET}♦ · 碎境之门已开` })
      go('/game/spire/map')
    }, 950)
  }

  const resume = () => go(phase === 'combat' ? '/game/spire/combat' : '/game/spire/map')

  const abandon = () => {
    abandonRun()
    toast('已放弃本局', { description: '牌组散入碎境，战绩照旧留存。' })
  }

  return (
    <div className="relative -mt-16 flex min-h-[100dvh] flex-col overflow-hidden">
      {/* 底：登岸长阶之门 */}
      <div className="absolute inset-0">
        <img src="/spire-gate.png" alt="登岸长阶之门" className="h-full w-full object-cover" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-abyss/80 via-abyss/55 to-abyss/95" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_30%,transparent_20%,rgba(7,6,11,.6)_100%)]" />
      </div>

      {/* 顶行：标题 + 倒计时 + 规则 */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] items-start justify-between px-6 pt-20">
        <div>
          <p className="flex items-center gap-2 text-[11px] tracking-[.4em] text-suit-diamond">
            <SuitIcon suit="diamond" size={14} glow /> 金壤 · 肉鸽牌局
          </p>
          <h1 className="gold-text mt-2 font-serifsc text-[52px] font-black leading-none tracking-[.12em]">碎境爬塔</h1>
          <p className="mt-2 text-[12px] tracking-[.3em] text-dim">单人登塔 · 三层碎境 · 死即终局</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-[rgba(227,194,124,.25)] px-4 text-[12px] tracking-wider text-dim transition-all hover:border-[rgba(246,227,180,.55)] hover:text-gold-300"
          >
            <BookOpen size={14} /> 规则速览
          </button>
          <div className="flex items-center gap-2 rounded-full border border-[rgba(227,194,124,.18)] bg-ink/60 py-1 pl-2 pr-3 backdrop-blur-sm">
            <CountdownRing variant="mini" size={30} />
            <span className="text-[11px] tracking-[.2em] text-dim">十日倒计时</span>
          </div>
        </div>
      </div>

      {/* 中部：继续牌局 + 风格三选一 */}
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center gap-6 px-6 py-8">
        {/* 继续牌局 */}
        <AnimatePresence>
          {hasRun && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="panel-bg gold-sweep relative flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden rounded-[14px] border border-suit-diamond/35 p-4"
            >
              <span className="flex items-center gap-2 font-serifsc text-[16px] text-bone">
                <Play size={15} className="text-suit-diamond" /> 牌局未竟
              </span>
              <span className="text-[12px] text-dim">
                第 <span className="font-cinzel text-gold-300">{floor}</span> 层
                {currentNode && <> · 驻足{NODE_TYPE_LABEL[currentNode.type] ?? '节点'}</>}
                {' · '}HP <span className="font-mono text-bone">{hp}/{maxHp}</span>
                {' · '}牌组 <span className="font-mono text-bone">{deckCount}</span> 张
              </span>
              <span className="flex-1" />
              <GoldButton size="sm" variant="suit" suit="diamond" onClick={resume}>
                继续牌局 <ChevronRight size={14} />
              </GoldButton>
              <button
                type="button"
                onClick={abandon}
                className="flex items-center gap-1 text-[11px] tracking-wider text-faint transition-colors hover:text-cinnabar-hi"
                title="放弃本局（进度清零）"
              >
                <Trash2 size={12} /> 放弃
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 风格三选一 */}
        <div className="grid gap-5 lg:grid-cols-3">
          {STYLES.map((s, i) => {
            const echo = getEcho(s.echoId)
            const relic = relicView(STARTER_RELICS[s.id])
            const active = stamping === s.id
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'panel-bg gold-sweep group relative flex flex-col gap-4 overflow-hidden rounded-[16px] border p-5 transition-all duration-300',
                  active ? 'border-suit-diamond/70' : 'border-[rgba(227,194,124,.18)] hover:-translate-y-1 hover:border-[rgba(246,227,180,.45)]',
                )}
                style={active ? { boxShadow: '0 0 36px rgba(242,169,59,.35)' } : undefined}
              >
                {/* 风格色晕 */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl"
                  style={{ background: `${s.color}26` }}
                />
                {/* 头：风格名 + 影从 */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-serifsc text-[26px] font-black tracking-[.2em]" style={{ color: s.color }}>
                      {s.name}
                    </p>
                    <p className="mt-1 text-[11px] tracking-[.2em] text-dim">{s.sub}</p>
                  </div>
                  {echo && (
                    <img
                      src={echo.portrait}
                      alt={echo.name}
                      className="h-14 w-14 rounded-full border border-[rgba(227,194,124,.35)] object-cover object-top"
                      draggable={false}
                    />
                  )}
                </div>
                {/* 影从台词 */}
                {echo && (
                  <p className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-3 py-2 text-[12px] italic leading-relaxed text-dim">
                    「{echo.quote}」<span className="not-italic text-faint"> —— {echo.name}</span>
                  </p>
                )}
                <p className="text-[12px] leading-relaxed text-bone/75">{s.desc}</p>
                {/* 初始牌组 */}
                <div>
                  <p className="mb-1.5 text-[10px] tracking-[.25em] text-faint">初始牌组</p>
                  <p className="text-[12px] leading-relaxed text-bone/80">{deckPreview(STARTER_DECKS[s.id])}</p>
                </div>
                {/* 初始遗物 */}
                <div className="flex items-center gap-2.5 rounded-[10px] border border-suit-diamond/25 bg-suit-diamond/[.06] px-3 py-2">
                  <RelicIcon id={STARTER_RELICS[s.id]} size={26} />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-bone">{relic.name}</p>
                    <p className="truncate text-[10px] text-faint">{relic.desc}</p>
                  </div>
                </div>
                {/* 选择 */}
                <GoldButton
                  variant={canAfford ? 'gold' : 'ghost'}
                  size="md"
                  className="mt-auto w-full"
                  disabled={!!stamping || hasRun}
                  onClick={() => begin(s.id)}
                >
                  {hasRun ? '牌局进行中' : `以此构筑登塔`}
                  {!hasRun && <FragmentChip suit="diamond" count={TICKET} size="sm" />}
                </GoldButton>

                {/* 印章落定 */}
                <AnimatePresence>
                  {active && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-10 flex items-center justify-center bg-abyss/60 backdrop-blur-[2px]"
                    >
                      <motion.span
                        initial={{ scale: 1.6, rotate: -18, opacity: 0 }}
                        animate={{ scale: 1, rotate: -8, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 17 }}
                        className="flex h-24 w-24 items-center justify-center rounded-[6px] border-2 border-[#F0655A] bg-[#B0352E]/90 font-mashan text-[30px] text-[#F8E9C0] shadow-[0_0_40px_rgba(216,68,60,.5)]"
                      >
                        登塔
                      </motion.span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* 战绩条 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-[12px] border border-[rgba(227,194,124,.12)] bg-ink/50 px-6 py-3 backdrop-blur-sm"
        >
          {[
            { k: '最高抵达', v: stats.bestFloor > 0 ? `第 ${stats.bestFloor} 层` : '——' },
            { k: '通关次数', v: `${stats.victories}` },
            { k: '总击杀', v: `${stats.kills}` },
            { k: '总场次', v: `${stats.runs}` },
          ].map((s) => (
            <span key={s.k} className="flex items-baseline gap-2 text-[12px] tracking-[.2em] text-dim">
              {s.k} <span className="font-mono text-[14px] text-gold-300">{s.v}</span>
            </span>
          ))}
          {!canAfford && !hasRun && (
            <span className="text-[11px] tracking-wider text-cinnabar-hi">♦ 余额 {fragments.diamond}/{TICKET} · 去大厅对局赢取金壤碎片</span>
          )}
        </motion.div>
      </div>

      {/* 规则速览抽屉 */}
      <AnimatePresence>
        {rulesOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24 }}
              className="fixed inset-0 z-[80] bg-abyss/70 backdrop-blur-[8px]"
              onClick={() => setRulesOpen(false)}
            />
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 top-0 z-[81] flex w-[380px] max-w-[90vw] flex-col gap-5 overflow-y-auto border-l border-[rgba(227,194,124,.15)] bg-panel p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="gold-text font-serifsc text-[18px] tracking-[.1em]">规则速览</h3>
                <button type="button" onClick={() => setRulesOpen(false)} className="text-faint transition-colors hover:text-gold-300" aria-label="关闭">
                  <ScrollText size={17} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[12px] tracking-[.2em] text-dim">登塔结构</p>
                {[
                  ['门厅', '择构筑（刃/壁垒/诡道），付门票 12♦ 入局'],
                  ['第 1 层 · 金壤', '15 行分支地图，择路而上，层底 Boss「梼杌」'],
                  ['第 2 层 · 玄渊', '敌人更凶，层底 Boss「千面」'],
                  ['第 3 层 · 十日之巅', '终局，Boss「终焉守望者」，胜则登岸'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-[10px] border border-[rgba(227,194,124,.1)] bg-ink/50 px-3 py-2.5">
                    <p className="text-[13px] text-bone">{k}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{v}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[12px] tracking-[.2em] text-dim">节点图例</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['battle', '战斗 · 1–2 敌'],
                      ['elite', '精英 · 强敌厚赏'],
                      ['event', '事件 · 福祸相倚'],
                      ['rest', '篝火 · 疗伤/淬牌'],
                      ['shop', '商店 · 刀币易物'],
                      ['treasure', '宝箱 · 金币遗物'],
                      ['boss', '层主 · 守关'],
                    ] as const
                  ).map(([t, label]) => (
                    <span key={t} className="flex items-center gap-2 rounded-[8px] border border-[rgba(227,194,124,.1)] bg-ink/40 px-2.5 py-1.5 text-[11px] text-dim">
                      <NodeGlyph type={t} size={16} /> {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[12px] tracking-[.2em] text-dim">死亡与奖励</p>
                <div className="rounded-[10px] border border-[rgba(216,68,60,.25)] bg-cinnabar/[.05] px-3 py-2.5 text-[11px] leading-relaxed text-dim">
                  死亡即终局：本局的牌组、遗物、金币散入碎境，门票不退；
                  但已入账的 ♦ 碎片、胜场与战绩永远属于你。通关另赏 60♦。
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {inkNode}
    </div>
  )
}

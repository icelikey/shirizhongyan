/**
 * 大陆详情态（world.md §右栏 · 大陆详情态）—— 右栏 Drawer 式切换。
 * 12 生肖印 4×3 阵列（点亮金底 / 线稿 + 当前章胜场进度）+ 碎片套组进度 +
 * 大陆规则卡（前往大厅开桌）+ 大陆纪事 3 条。
 */
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useProfile } from '@/store/profile'
import type { Suit } from '@/data/echoes'
import { SUIT_META } from '@/data/echoes'
import { ZODIAC, WINS_PER_ZODIAC } from '@/data/zodiac'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import ZodiacSeal from '@/components/ZodiacSeal'
import { GAME_META } from '@/components/meta/data'
import { CONTINENTS } from '@/components/meta/world/continents'

const CHRONICLE: Record<Suit, string[]> = {
  spade: ['第 5 日 · 你在玄渊放逐了 讹兽', '第 3 日 · 玄渊圆桌，你以平民身份活到最后', '第 2 日 · 白泽点破了你的悍跳'],
  heart: ['丹丘的灯笼尚未为你点亮', '迷雾之下，心战无声'],
  club: ['第 4 日 · 你以 0.3 偏差惜败璇玑', '第 2 日 · 青野算庭，你首次踏入思维第三层', '第 6 日 · 守拙在终轮反超你 1.1'],
  diamond: ['金壤迷雾已散 · 碎境之门洞开', '登岸长阶之上，旅人的脚印还没凉', '第 7 日 · 烛阴押注你能登上第 2 层'],
}

export interface ContinentDetailProps {
  suit: Suit
  onBack: () => void
  onGoLobby: () => void
  /** S2 扩展：金壤主场「碎境爬塔」跳转 /game/spire */
  onGoSpire?: () => void
  /** S6 扩展：丹丘主场「千面牌楼」跳转 /game/poker */
  onGoPoker?: () => void
}

export default function ContinentDetail({ suit, onBack, onGoLobby, onGoSpire, onGoPoker }: ContinentDetailProps) {
  const lit = useProfile((s) => s.zodiac[suit])
  const wins = useProfile((s) => s.winsTowardZodiac[suit])
  const fragments = useProfile((s) => s.fragments[suit])
  const meta = SUIT_META[suit]
  const continent = CONTINENTS.find((c) => c.suit === suit)
  const nextIdx = ZODIAC.find((z) => !lit.includes(z.index))?.index ?? -1
  const game = continent?.homeGame ? GAME_META[continent.homeGame] : null

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  })

  return (
    <div className="panel-bg flex flex-col gap-5 rounded-[14px] p-5">
      {/* 顶部：返回 + 大陆名 */}
      <motion.div {...stagger(0)} className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[12px] tracking-wider text-dim transition-colors hover:text-gold-300"
        >
          <ArrowLeft size={14} /> 全景
        </button>
        <span className="flex-1" />
        <span style={{ color: meta.color }}>
          <SuitIcon suit={suit} size={20} glow />
        </span>
        <h3 className="gold-text font-serifsc text-[22px] font-black tracking-[.15em]">{meta.realm}</h3>
      </motion.div>

      {/* 生肖段位 */}
      <motion.div {...stagger(1)}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] tracking-[.2em] text-dim">生肖段位</span>
          <span className="font-mono text-[11px] text-dim">
            {lit.length}/12{nextIdx >= 0 && ` · ${ZODIAC[nextIdx].name} 胜场 ${wins}/${WINS_PER_ZODIAC}`}
          </span>
        </div>
        <div className="grid grid-cols-4 justify-items-center gap-y-3 rounded-[12px] border border-[rgba(227,194,124,.1)] bg-ink/40 p-3">
          {ZODIAC.map((z) => {
            const isLit = lit.includes(z.index)
            const isCurrent = z.index === nextIdx
            return (
              <ZodiacSeal
                key={z.index}
                index={z.index}
                lit={isLit}
                progress={isCurrent ? wins : 0}
                size={40}
                className={isCurrent && !isLit ? 'animate-breathe border-gold-300/60' : undefined}
              />
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] tracking-wider text-faint">每胜 {WINS_PER_ZODIAC} 场点亮一枚 · 尽亮则此大陆圆满</p>
      </motion.div>

      {/* 碎片套组 */}
      <motion.div {...stagger(2)}>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] tracking-[.2em] text-dim">碎片套组</span>
          <span className="font-mono text-[11px]" style={{ color: meta.color }}>
            {meta.symbol} {fragments}/50
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[rgba(227,194,124,.1)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (fragments / 50) * 100)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${meta.color}66, ${meta.color})`, boxShadow: `0 0 8px ${meta.glow}` }}
          />
        </div>
      </motion.div>

      {/* 大陆规则卡（S2 扩展：金壤主场 = 碎境爬塔；S6 扩展：丹丘主场 = 千面牌楼） */}
      {suit === 'heart' ? (
        <motion.div {...stagger(3)} className="rounded-[12px] border border-[rgba(238,106,114,.25)] bg-suit-heart/[.05] p-4">
          <span className="text-[12px] tracking-[.2em] text-dim">主场规则 · 千面牌楼</span>
          <p className="mt-2 text-[12px] leading-relaxed text-dim">
            扑克肉鸽登楼：门票 10♥。十二层面具牌手线性镇守，4 次出牌 + 2 次弃牌，
            牌型 筹码×倍率 定伤害；读心可见压注区间（精英/楼主有伪装）。
            52 张牌组词条跨局养成，精英胜场计入丹丘生肖，登顶 +40♥。
          </p>
          <GoldButton variant="suit" suit="heart" size="sm" className="mt-3 w-full" onClick={onGoPoker ?? onGoLobby}>
            前往千面牌楼
          </GoldButton>
        </motion.div>
      ) : suit === 'diamond' ? (
        <motion.div {...stagger(3)} className="rounded-[12px] border border-[rgba(242,169,59,.25)] bg-suit-diamond/[.05] p-4">
          <span className="text-[12px] tracking-[.2em] text-dim">主场规则 · 碎境爬塔</span>
          <p className="mt-2 text-[12px] leading-relaxed text-dim">
            单人肉鸽牌局：门厅择构筑（刃/壁垒/诡道），门票 12♦。三层 15 行分支地图，
            战斗、事件、篝火、商店交错而上，层底 Boss 守关。死即终局，通关登岸 +60♦。
            Boss 击杀计入金壤生肖胜场。
          </p>
          <GoldButton variant="suit" suit="diamond" size="sm" className="mt-3 w-full" onClick={onGoSpire ?? onGoLobby}>
            前往碎境登塔
          </GoldButton>
        </motion.div>
      ) : (
        game && (
          <motion.div {...stagger(3)} className="rounded-[12px] border border-[rgba(227,194,124,.12)] bg-ink/50 p-4">
            <span className="text-[12px] tracking-[.2em] text-dim">主场规则 · {game.name}</span>
            <p className="mt-2 text-[12px] leading-relaxed text-dim">
              {continent?.homeGame === 'werewolf'
                ? '6 人昼夜局：2 狼 / 预言家 / 女巫 / 2 平民。夜段狼刀与神职行动，昼段发言投票。胜场计入玄渊生肖。'
                : '6 人 5 轮秘密出数（0–100），目标 = 均值 × 0.8，最接近者胜。胜场计入青野生肖。'}
            </p>
            <GoldButton variant="suit" suit={suit} size="sm" className="mt-3 w-full" onClick={onGoLobby}>
              前往大厅开桌
            </GoldButton>
          </motion.div>
        )
      )}

      {/* 大陆纪事 */}
      <motion.div {...stagger(4)}>
        <span className="text-[12px] tracking-[.2em] text-dim">大陆纪事</span>
        <div className="mt-2 flex flex-col gap-2">
          {CHRONICLE[suit].slice(0, 3).map((line) => (
            <p key={line} className="border-l-2 pl-2.5 text-[11px] leading-relaxed text-faint" style={{ borderColor: `${meta.color}55` }}>
              {line}
            </p>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

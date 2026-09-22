/**
 * 图鉴第⑧章「碎境爬塔」内容（spire-map.md §4 · Codex 集成）。
 * 玩法结构图（门厅→三层地图→Boss）+ 节点类型图例 + 状态效果词条表 + 死亡与元进度。
 * 锚点 #spire（Codex.tsx 目录同步）。
 */
import { Fragment } from 'react'
import { ArrowDown } from 'lucide-react'
import { SectionHead } from '@/components/content/codex-sections'
import { NodeGlyph } from '@/components/spire/icons'
import type { NodeType } from '@/data/spire/types'

const FLOW: { title: string; sub: string }[] = [
  { title: '门厅', sub: '择构筑 · 刃/壁垒/诡道 · 门票 12♦' },
  { title: '第 1 层 · 金壤', sub: '15 行分支地图 · 层底 Boss 梼杌' },
  { title: '第 2 层 · 玄渊', sub: '强敌与新事件 · 层底 Boss 千面' },
  { title: '第 3 层 · 十日之巅', sub: '终局 · Boss 终焉守望者' },
  { title: '登岸', sub: '通关 · +60 ♦ · 战绩刻入档案' },
]

const NODE_LEGEND: { type: NodeType; name: string; desc: string }[] = [
  { type: 'battle', name: '战斗', desc: '1–2 名敌人，胜后得金币与碎片' },
  { type: 'elite', name: '精英', desc: '第 5 行后出现，强敌 + 概率小怪，奖赏更厚' },
  { type: 'event', name: '事件', desc: '福祸相倚的抉择，可能染指业债' },
  { type: 'rest', name: '篝火', desc: '疗伤（回血 30%）或淬牌（升级一张）' },
  { type: 'shop', name: '商店', desc: '刀币易物：3 卡 + 1 遗物 + 2 药水，可撤牌' },
  { type: 'treasure', name: '宝箱', desc: '金币 25–50，三成概率藏有遗物' },
  { type: 'boss', name: '层主', desc: '守关 Boss，击杀点亮 ♦ 生肖胜场' },
]

const STATUS_GLOSSARY: { name: string; kind: string; desc: string }[] = [
  { name: '格挡', kind: '己方', desc: '抵消等值伤害，回合结束清空' },
  { name: '力量', kind: '己方增益', desc: '每层使攻击伤害 +1' },
  { name: '敏捷', kind: '己方增益', desc: '每层使获得的格挡 +1' },
  { name: '易伤', kind: '敌方减益', desc: '每层使受到的攻击伤害 +50%' },
  { name: '虚弱', kind: '敌方减益', desc: '每层使造成的攻击伤害 -25%' },
  { name: '中毒', kind: '敌方减益', desc: '回合开始受到层数伤害，随后层数 -1' },
  { name: '燃烧', kind: '减益', desc: '回合结束受到层数伤害' },
  { name: '业债', kind: '诅咒', desc: '0 费、不可打出的消耗品，占着牌位的债' },
]

export default function CodexSpireChapter() {
  return (
    <>
      <SectionHead numeral="捌" title="碎境爬塔" color="#F2A93B" sub="♦ 金壤 · 肉鸽牌局 · 单人登塔" />

      {/* 玩法结构图 */}
      <div className="codex-reveal mb-10 flex flex-col items-stretch gap-0">
        {FLOW.map((f, i) => (
          <Fragment key={f.title}>
            <div className="flex items-center gap-4 rounded-[12px] border border-[rgba(242,169,59,.2)] bg-suit-diamond/[.05] px-4 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-suit-diamond/50 font-cinzel text-[12px] text-suit-diamond">
                {i + 1}
              </span>
              <div className="flex-1">
                <span className="font-serifsc text-[15px] text-bone">{f.title}</span>
                <span className="ml-3 text-[12px] text-dim">{f.sub}</span>
              </div>
            </div>
            {i < FLOW.length - 1 && <ArrowDown size={14} className="my-1 self-center text-gold-500/70" />}
          </Fragment>
        ))}
      </div>

      {/* 节点类型图例 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">节点类型图例</h3>
      <div className="codex-reveal mb-10 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {NODE_LEGEND.map((n) => (
          <div key={n.type} className="flex items-center gap-3 rounded-[12px] border border-[rgba(227,194,124,.12)] bg-panel/60 px-3.5 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-suit-diamond/40 bg-ink/70">
              <NodeGlyph type={n.type} size={20} />
            </span>
            <div>
              <p className="font-serifsc text-[14px] text-bone">{n.name}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-faint">{n.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 状态效果词条表 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">状态效果词条</h3>
      <div className="codex-reveal mb-10 overflow-hidden rounded-[12px] border border-[rgba(227,194,124,.12)]">
        {STATUS_GLOSSARY.map((s, i) => (
          <div
            key={s.name}
            className={`flex items-baseline gap-3 px-4 py-2.5 text-[13px] ${i % 2 === 0 ? 'bg-panel/60' : 'bg-ink/40'}`}
          >
            <span className="w-14 shrink-0 font-serifsc text-bone">{s.name}</span>
            <span className="w-20 shrink-0 text-[11px] tracking-wider text-suit-diamond">{s.kind}</span>
            <span className="text-dim">{s.desc}</span>
          </div>
        ))}
      </div>

      {/* 死亡与元进度 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">死亡与元进度</h3>
      <div className="codex-reveal flex flex-col gap-3 text-[14px] leading-[1.9] text-bone/85">
        <p>
          爬塔是单局制的赌命：门票 12♦ 一旦付出，死亡即终局——本局的牌组、遗物与金币散入碎境，门票不退。
          但战斗与事件中入账的 ♦ 碎片、Boss 击杀记下的生肖胜场，永远属于你。
        </p>
        <p>
          门厅的战绩条记得一切：最高抵达层数、通关次数、总击杀与总场次。
          登塔不问输赢，问的是你这一局，走到了第几层。
        </p>
      </div>
    </>
  )
}

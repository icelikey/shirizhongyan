/**
 * 图鉴第⑩章「千面牌楼」内容（poker.md §2 · Codex 集成，锚点 #poker）。
 * 牌型倍率表 + 词条四类 + 读心机制 + 牌组养成。
 */
import { SectionHead } from '@/components/content/codex-sections'
import { HAND_ORDER, HAND_SCORE } from '@/engine/poker/evaluator'
import { AFFIXES, AFFIX_KIND_META } from '@/data/poker/affixes'
import type { AffixKind } from '@/data/poker/affixes'
import { OPPONENTS } from '@/data/poker/opponents'

const KIND_ORDER: AffixKind[] = ['attack', 'defense', 'scheme', 'luck']

export default function CodexPokerChapter() {
  return (
    <>
      <SectionHead numeral="拾" title="千面牌楼" color="#EE6A72" sub="♥ 丹丘 · 扑克肉鸽 · 十二层登楼" />

      {/* 玩法概述 */}
      <div className="codex-reveal mb-10 flex flex-col gap-3 text-[14px] leading-[1.9] text-bone/85">
        <p>
          丹丘中央立着十二层「千面牌楼」，每层坐着一位戴面具的牌手。你的武器是一副标准 52 张扑克——
          它是<strong className="text-suit-heart">永久资产</strong>：词条洗炼跨局保留，死亡重开，牌组不灭。
        </p>
        <p>
          门票 10♥。每场对决你以 40 HP 迎战层主（第 1 层 30 HP，逐层 +15，第 4/8 层精英 ×1.5，楼主 400）。
          每场 4 次出牌 + 2 次弃牌：选 1–5 张组成牌型打出，伤害 = 筹码 × 倍率（Balatro 式）；
          每次出牌后对手压注反击（3–15 随层数上浮）。出牌耗尽前击杀对手即胜，登楼；
          HP 归零或次数耗尽则败北——本局累积碎片保留一半（向上取整）。
        </p>
      </div>

      {/* 牌型倍率表 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">牌型倍率表</h3>
      <div className="codex-reveal mb-10 overflow-hidden rounded-[12px] border border-[rgba(238,106,114,.2)]">
        {HAND_ORDER.map((t, i) => {
          const s = HAND_SCORE[t]
          return (
            <div key={t} className={`flex items-center gap-4 px-4 py-2 text-[13px] ${i % 2 === 0 ? 'bg-panel/60' : 'bg-ink/40'}`}>
              <span className="w-24 shrink-0 font-serifsc text-bone">{s.name}</span>
              <span className="font-mono text-suit-heart">{s.chips}</span>
              <span className="text-faint">筹码</span>
              <span className="text-gold-500">×</span>
              <span className="font-mono text-gold-300">{s.mult}</span>
              <span className="text-faint">倍率</span>
              <span className="flex-1" />
              <span className="text-[11px] text-faint">
                {t === 'straight' ? '含 A-2-3-4-5' : t === 'royalFlush' ? '10-J-Q-K-A 同花' : t === 'high' ? '单张亦成局' : ''}
              </span>
            </div>
          )
        })}
        <div className="border-t border-[rgba(238,106,114,.15)] bg-ink/60 px-4 py-2 text-[11px] text-faint">
          打出牌的面值计入筹码（2–10 面值，J/Q/K=10，A=11）；词条加成后进位取整。
        </div>
      </div>

      {/* 词条四类 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">词条四类 · 廿四</h3>
      <div className="codex-reveal mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {KIND_ORDER.map((kind) => {
          const m = AFFIX_KIND_META[kind]
          return (
            <div key={kind} className="rounded-[12px] border border-[rgba(227,194,124,.12)] bg-panel/60 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full font-mashan text-[12px] text-abyss"
                  style={{ background: m.color }}
                >
                  {m.glyph}
                </span>
                <span className="font-serifsc text-[15px]" style={{ color: m.color }}>{m.name}</span>
                <span className="text-[10px] text-faint">
                  {kind === 'attack' ? '计分强化' : kind === 'defense' ? '生存与节奏' : kind === 'scheme' ? '牌型连携' : '概率奇遇'}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {AFFIXES.filter((a) => a.kind === kind).map((a) => (
                  <li key={a.id} className="text-[11.5px] leading-relaxed text-dim">
                    <span className="text-bone/90">{a.name}</span> · {a.desc}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* 读心机制 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">读心机制</h3>
      <div className="codex-reveal mb-10 flex flex-col gap-3 text-[14px] leading-[1.9] text-bone/85">
        <p>
          丹丘是心理之地：战前与战中，你始终能看到对手的<strong className="text-suit-heart">压注区间</strong>（如 6–9）——
          这是他们心跳的外显。但精英与楼主戴着更厚的面具：显示区间比实际更宽，
          你读到的，只是他们允许你读到的。
        </p>
        <p>
          「守」系词条在手牌中悄然生效：示弱压低压注、不动免疫大额压注（≥10）、续命添一次出牌。
          读懂区间，再决定是快攻斩杀，还是留手布防。
        </p>
      </div>

      {/* 牌组养成与层间节点 */}
      <h3 className="codex-reveal mb-4 font-serifsc text-[18px] font-semibold text-bone">牌组养成 · 层间节点</h3>
      <div className="codex-reveal mb-10 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { name: '洗心祭坛', desc: '重摇一张牌的一条词条（首次免费，之后 20 人心币）；或注灵：三选一打上词条（30 币，每牌至多 2 条）' },
          { name: '丹丘茶馆', desc: '免费回 10 HP；人心道具：30 币下一场 +1 出牌，40 币 +1 弃牌' },
          { name: '千面奇遇', desc: '三个面具事件轮换：±HP、±人心币、词条祝福与诅咒' },
        ].map((n) => (
          <div key={n.name} className="rounded-[12px] border border-[rgba(238,106,114,.2)] bg-suit-heart/[.05] p-4">
            <p className="font-serifsc text-[14px] text-suit-heart">{n.name}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-dim">{n.desc}</p>
          </div>
        ))}
      </div>

      {/* 经济 */}
      <div className="codex-reveal flex flex-col gap-3 text-[14px] leading-[1.9] text-bone/85">
        <p>
          每层胜 +2♥、精英 +10♥ 并记丹丘生肖胜场、登顶 +40♥；人心币（每层 +15、精英 +40）只在局内流通。
          十二位牌手依次镇守：{OPPONENTS.map((o) => o.name).join('、')}。
        </p>
      </div>
    </>
  )
}

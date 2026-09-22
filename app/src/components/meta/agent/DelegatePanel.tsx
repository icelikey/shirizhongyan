/**
 * 代打授权（agent.md §A5）。
 * 三枚开关卡：狼人杀·夜晚行动 / 狼人杀·白天发言与投票 / 猜平均数·全权出数。
 * （原型：授权状态为页内状态，不写入 store；战绩照常计入的附注按设计稿展示。）
 */
import { useEffect, useState } from 'react'
import SectionHeader from '@/components/meta/SectionHeader'
import MetaSwitch from '@/components/meta/Switch'
import SuitIcon from '@/components/SuitIcon'

const ITEMS = [
  { key: 'ww-night', label: '狼人杀 · 夜晚行动', suit: 'spade' as const, desc: '狼刀 / 查验 / 药，影从代行' },
  { key: 'ww-day', label: '狼人杀 · 白天发言与投票', suit: 'spade' as const, desc: '发言风格随心性烙印' },
  { key: 'guess', label: '猜平均数 · 全权出数', suit: 'club' as const, desc: '五轮出数，层数自决' },
]

export interface DelegatePanelProps {
  onChange?: (anyOn: boolean) => void
}

export default function DelegatePanel({ onChange }: DelegatePanelProps) {
  const [state, setState] = useState<Record<string, boolean>>({
    'ww-night': false,
    'ww-day': false,
    guess: false,
  })

  const anyOn = Object.values(state).some(Boolean)
  useEffect(() => {
    onChange?.(anyOn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOn])

  return (
    <section>
      <SectionHeader title="代打授权" subtitle="代打战绩照常计入，影从按心性行事。" sideMark="授权" />
      <div className="mt-4 flex flex-col gap-3">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-[12px] border border-[rgba(227,194,124,.12)] bg-ink/50 p-3.5"
          >
            <span style={{ color: item.suit === 'spade' ? '#8B93F8' : '#4ECB9C' }}>
              <SuitIcon suit={item.suit} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-bone">{item.label}</div>
              <div className="mt-0.5 text-[10px] tracking-wider text-faint">{item.desc}</div>
            </div>
            <MetaSwitch
              checked={state[item.key]}
              onChange={(v) => setState((s) => ({ ...s, [item.key]: v }))}
              label={item.label}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

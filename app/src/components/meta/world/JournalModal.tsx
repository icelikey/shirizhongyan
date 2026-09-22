/**
 * 十日志 Modal（world.md §中央十日轮 · 点击弹出）。
 * 本周期大事记：剩余时间 / 你的对局 / 世界公告。
 */
import { useProfile } from '@/store/profile'
import { formatCountdown, getCountdown } from '@/lib/countdown'
import { getEcho } from '@/data/echoes'
import CountdownRing from '@/components/CountdownRing'
import MetaModal from '@/components/meta/Modal'

const WORLD_LOGS = [
  '第 1 日 · 你踏入牌局之间，与影从立契。',
  '昨夜玄渊，旅人『借火人』以 22.9 猜中均值，连破三层思维。',
  '讹兽悍跳预言家成功，月影村全军覆没。',
  '残章·叁 已被 12 位旅人解锁。',
]

export interface JournalModalProps {
  open: boolean
  onClose: () => void
}

export default function JournalModal({ open, onClose }: JournalModalProps) {
  const session = useProfile((s) => s.session)
  const records = useProfile((s) => s.records)
  const companion = useProfile((s) => s.companion)
  const anchor = session?.createdAt ?? new Date().setHours(0, 0, 0, 0)
  const cd = getCountdown(anchor)
  const companionEcho = companion ? getEcho(companion.echoId) : undefined

  return (
    <MetaModal open={open} onClose={onClose} title="十日志" sideMark="中枢" width={480}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <CountdownRing variant="mini" size={56} />
          <div>
            <p className="font-mono text-[13px] text-gold-300">{formatCountdown(cd)}</p>
            <p className="mt-1 text-[11px] tracking-wider text-faint">
              十日总进度 {(cd.totalProgress * 100).toFixed(0)}%{cd.crisis && ' · 终焉将近（危机时段）'}
            </p>
          </div>
        </div>

        <div className="rounded-[12px] border border-[rgba(227,194,124,.12)] bg-ink/50 p-4">
          <span className="text-[12px] tracking-[.2em] text-dim">你的对局</span>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <p className="text-dim">
              狼人杀 <span className="font-mono text-bone">{records.werewolf.played}</span> 局 · 胜{' '}
              <span className="font-mono text-gold-300">{records.werewolf.won}</span>
            </p>
            <p className="text-dim">
              猜平均数 <span className="font-mono text-bone">{records.guess.played}</span> 局 · 胜{' '}
              <span className="font-mono text-gold-300">{records.guess.won}</span>
            </p>
          </div>
          {companionEcho && (
            <p className="mt-2 text-[11px] text-faint">
              契约影从 {companion?.customName}（{companionEcho.name}）· 羁绊 Lv.{companion?.bond}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] tracking-[.2em] text-dim">世界公告</span>
          {WORLD_LOGS.map((line) => (
            <p key={line} className="border-l-2 border-gold-300/40 pl-2.5 text-[11px] leading-relaxed text-faint">
              {line}
            </p>
          ))}
        </div>
      </div>
    </MetaModal>
  )
}

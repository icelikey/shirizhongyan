import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, CircleAlert, Clock3, ShieldCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

type Chapter = {
  chapterId: string
  title: string
  body: string
  eventSeq: number
  stateHash: string
  status: 'fallback' | 'generated'
}

type ReportPayload = {
  mode?: string
  report?: string
  matchLogId?: number
  chapters?: Chapter[]
  narrative?: {
    usedFallback?: boolean
    audit?: { ok?: boolean; errors?: string[] }
  }
  error?: { message?: string }
}

function shortHash(value: string | undefined) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : '待生成'
}

export default function BattleReport() {
  const { code = '' } = useParams()
  const matchCode = code.toUpperCase()
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}world/v1/public/matches/${encodeURIComponent(matchCode)}/report`)
      .then(async (response) => {
        const value = await response.json() as ReportPayload
        if (!response.ok) throw new Error(value.error?.message || '战报暂时无法读取')
        if (!cancelled) setPayload(value)
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '战报暂时无法读取')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchCode])

  const chapters = payload?.chapters?.length
    ? payload.chapters
    : payload?.report
      ? [{
          chapterId: `${matchCode}-report`,
          title: '终局战报',
          body: payload.report,
          eventSeq: 0,
          stateHash: '',
          status: payload.narrative?.usedFallback ? 'fallback' : 'generated' as const,
        }]
      : []

  return (
    <main className="min-h-screen bg-abyss px-5 py-8 text-bone sm:px-10 sm:py-12">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] tracking-[.3em] text-faint"><BookOpen size={15} className="text-gold-300" /> 终焉 · 文字世界</div>
            <h1 className="gold-text font-serifsc text-[34px] font-black tracking-[.1em]">一场对局，十秒之后</h1>
            <p className="mt-2 text-[12px] tracking-[.16em] text-dim">公开战报 · 房间 {matchCode} · 事件事实只读投影</p>
          </div>
          <Link to="/lobby" className="inline-flex items-center gap-2 rounded-full border border-gold-300/20 px-4 py-2 text-[11px] text-dim transition hover:border-gold-300/50 hover:text-gold-100"><ArrowLeft size={14} /> 返回大厅</Link>
        </header>

        {loading && <div className="panel-bg rounded-2xl p-10 text-center text-[13px] text-dim">正在从事件账本翻开这一章……</div>}
        {!loading && error && <div className="rounded-2xl border border-cinnabar-hi/30 bg-cinnabar-hi/5 p-8 text-center text-[13px] leading-7 text-dim"><CircleAlert className="mx-auto mb-3 text-cinnabar-hi" size={22} />{error}</div>}

        {!loading && !error && payload && (
          <div className="flex flex-col gap-6">
            <section className="panel-bg rounded-2xl border border-gold-300/20 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-[.2em] text-suit-diamond">
                <span>战局摘要 · MATCH LOG {payload.matchLogId ?? '—'}</span>
                <span className="inline-flex items-center gap-1 text-faint"><ShieldCheck size={13} />{payload.narrative?.audit?.ok ? '证据审计通过' : '事实链已锁定 · 叙事降级可用'}</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap font-serifsc text-[18px] leading-8 text-bone/90">{payload.report || '这局暂时没有可展示的战报正文。'}</p>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between"><h2 className="font-serifsc text-[22px] text-gold-100">章节回响</h2><span className="text-[11px] text-faint">{chapters.length} 章 · {payload.mode || 'text'}</span></div>
              {chapters.map((chapter, index) => (
                <article key={chapter.chapterId} className="panel-bg rounded-2xl border border-white/[.08] p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><span className="text-[10px] tracking-[.24em] text-suit-diamond">第 {String(index + 1).padStart(2, '0')} 章 · 事件 #{chapter.eventSeq}</span><h3 className="mt-2 font-serifsc text-[22px] text-bone">{chapter.title}</h3></div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] ${chapter.status === 'generated' ? 'border-suit-club/30 text-suit-club' : 'border-gold-300/20 text-gold-200'}`}>{chapter.status === 'generated' ? '叙事模型生成' : '事实降级战报'}</span>
                  </div>
                  <p className="mt-6 whitespace-pre-wrap font-serifsc text-[15px] leading-8 text-bone/85">{chapter.body}</p>
                  <footer className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/[.07] pt-4 text-[10px] text-faint"><span className="inline-flex items-center gap-1"><Clock3 size={12} />事件序号 {chapter.eventSeq}</span><span>stateHash {shortHash(chapter.stateHash)}</span></footer>
                </article>
              ))}
            </section>

            <p className="text-center text-[10px] leading-6 text-faint">【事实】来自已落库的公开 MatchEvent；【推断】只能解释事件，不能改写胜负、奖励或世界历史。</p>
          </div>
        )}
      </div>
    </main>
  )
}

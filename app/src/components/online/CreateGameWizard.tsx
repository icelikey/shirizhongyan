/**
 * 「⚒ 创造游戏」三步向导（sdk.md §5）。
 * ① 选模板（猜数博弈 ♣ / 红眼病投票 ♥ / 虫心算谱 ♠）→ ② 参数（人数/轮数/倍率或选项/
 * 门票/奖励/时限，实时显示预计一局时长）→ ③ 命名 +「开天辟地」印章
 * → game.createDef + room.create → 直入房间。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { trpc } from '@/providers/trpc'
import type { GameTemplate, Suit } from '@contracts/gameSdk'
import { SDK_LIMITS } from '@contracts/gameSdk'
import GameModal from '@/components/game/GameModal'
import GoldButton from '@/components/GoldButton'
import SuitIcon from '@/components/SuitIcon'
import { Slider } from '@/components/ui/slider'
import { seatTokenKey } from '@/components/online/OnlineLobbySection'
import { SUIT_META } from '@/data/echoes'
import { cn } from '@/lib/utils'

const TEMPLATE_CARDS: {
  template: Exclude<GameTemplate, 'pirateGold'>
  title: string
  suit: Suit
  desc: string
  tagline: string
}[] = [
  {
    template: 'numberGuess',
    title: '猜数博弈',
    suit: 'club',
    desc: '全员秘密出数，最接近「均值 × 倍率」者胜。青野算庭的经典博弈。',
    tagline: '计算与概率',
  },
  {
    template: 'pollDuel',
    title: '红眼病投票',
    suit: 'heart',
    desc: '全员同时投票，选中「最少人选的选项」者得分。丹丘的心理乱斗。',
    tagline: '心理与少数派',
  },
  {
    template: 'flyTease',
    title: '虫心算谱',
    suit: 'spade',
    desc: '读取果蝇响应表，选择刺激牌命中蛐蛐偏好；同形相挤，怒气反击，玄渊只记录你的选择。',
    tagline: '神经与博弈',
  },
]

const SEAL_COLORS = ['#EE6A72', '#8B93F8', '#4ECB9C', '#F2A93B']

function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m} 分 ${s > 0 ? `${s} 秒` : ''}`.trim() : `${s} 秒`
}

/** 步进器行 */
function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v * 100) / 100))
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[13px] text-dim">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(227,194,124,.25)] text-gold-300 hover:border-[rgba(246,227,180,.55)]"
        >
          <Minus size={12} />
        </button>
        <span className="w-14 text-center font-mono text-[14px] text-bone">
          {value}
          {unit && <span className="ml-0.5 text-[10px] text-faint">{unit}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(227,194,124,.25)] text-gold-300 hover:border-[rgba(246,227,180,.55)]"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

export default function CreateGameWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<Exclude<GameTemplate, 'pirateGold'>>('numberGuess')
  const [seats, setSeats] = useState(6)
  const [rounds, setRounds] = useState(5)
  const [targetRatio, setTargetRatio] = useState(0.667)
  const [rangeMin, setRangeMin] = useState(0)
  const [rangeMax, setRangeMax] = useState(100)
  const [scoreWin, setScoreWin] = useState(2)
  const [scoreSecond, setScoreSecond] = useState(1)
  const [choices, setChoices] = useState<string[]>(['红', '蓝'])
  const [fickleness, setFickleness] = useState(0.35)
  const [crowding, setCrowding] = useState(0.6)
  const [rageThreshold, setRageThreshold] = useState(8)
  const [feeSuit, setFeeSuit] = useState<Suit>('club')
  const [feeAmount, setFeeAmount] = useState(0)
  const [rewardWinner, setRewardWinner] = useState(50)
  const [rewardRunner, setRewardRunner] = useState(25)
  const [rewardPart, setRewardPart] = useState(5)
  const [windowSec, setWindowSec] = useState(30)
  const [name, setName] = useState('')
  const [forging, setForging] = useState(false)

  const createDef = trpc.game.createDef.useMutation()
  const createRoom = trpc.room.create.useMutation()

  const estimateSec = rounds * (windowSec + 5)
  const activeSuit: Suit = template === 'pollDuel' ? 'heart' : template === 'flyTease' ? 'spade' : feeSuit

  const pickTemplate = (t: Exclude<GameTemplate, 'pirateGold'>) => {
    setTemplate(t)
    setFeeSuit(t === 'pollDuel' ? 'heart' : t === 'flyTease' ? 'spade' : 'club')
  }

  const step2Valid = useMemo(() => {
    if (template === 'numberGuess') return rangeMin < rangeMax
    if (template === 'flyTease') return true
    return (
      choices.length >= SDK_LIMITS.choices.min &&
      choices.every((c) => c.trim().length > 0)
    )
  }, [template, rangeMin, rangeMax, choices])

  const reset = () => {
    setStep(0)
    setName('')
    setForging(false)
  }

  const forge = async () => {
    const finalName = name.trim()
    if (!finalName) {
      toast('尚未命名', { description: '为你的游戏落一个名字，方可开天辟地。' })
      return
    }
    setForging(true)
    try {
      const def = await createDef.mutateAsync(
        template === 'numberGuess'
          ? {
              template,
              name: finalName,
              seats,
              params: {
                rounds,
                min: rangeMin,
                max: rangeMax,
                targetRatio: Math.round(targetRatio * 1000) / 1000,
                scoreWin,
                scoreSecond,
              },
              entryFee: { suit: feeSuit, amount: feeAmount },
              rewards: { winner: rewardWinner, runnerUp: rewardRunner, participation: rewardPart },
              submitWindowSec: windowSec,
            }
          : template === 'pollDuel'
            ? {
              template,
              name: finalName,
              seats,
              params: {
                rounds,
                choices: choices.map((c) => c.trim()),
                payoff: 'minority-wins',
                scoreWin,
              },
              entryFee: { suit: feeSuit, amount: feeAmount },
              rewards: { winner: rewardWinner, runnerUp: rewardRunner, participation: rewardPart },
              submitWindowSec: windowSec,
            }
            : {
              template,
              name: finalName,
              seats,
              params: {
                rounds,
                fickleness,
                crowding,
                rageThreshold,
                scoreWin,
              },
              entryFee: { suit: feeSuit, amount: feeAmount },
              rewards: { winner: rewardWinner, runnerUp: rewardRunner, participation: rewardPart },
              submitWindowSec: windowSec,
            },
      )
      const room = await createRoom.mutateAsync({ defId: def.id, roomName: finalName })
      if (room.seatToken) sessionStorage.setItem(seatTokenKey(room.code), room.seatToken)
      toast('开天辟地 · 游戏已成', { description: `「${finalName}」房码 ${room.code}，直入新房。` })
      onClose()
      reset()
      navigate(
        def.template === 'pollDuel'
          ? `/game/online-poll/${room.code}`
          : def.template === 'flyTease'
            ? `/game/online-fly/${room.code}`
            : `/game/online/${room.code}`,
      )
    } catch (err) {
      toast('创造失败', { description: err instanceof Error ? err.message : '星网繁忙，稍后再试。' })
      setForging(false)
    }
  }

  const STEP_TITLE = ['选一式模板', '定诸般规则', '命名 · 开天辟地']

  return (
    <GameModal open={open} title={`创造游戏 · ${STEP_TITLE[step]}`} onClose={onClose} className="max-w-[680px]">
      {/* 步骤指示 */}
      <div className="mb-4 flex items-center gap-2">
        {STEP_TITLE.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i <= step ? 'bg-gold-300' : 'bg-[rgba(227,194,124,.15)]',
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* 第一步：选模板 */}
        {step === 0 && (
          <motion.div
            key="s0"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {TEMPLATE_CARDS.map((c) => {
              const color = SUIT_META[c.suit].color
              const active = template === c.template
              return (
                <button
                  key={c.template}
                  type="button"
                  onClick={() => pickTemplate(c.template)}
                  className={cn(
                    'group relative rounded-2xl border p-4 text-left transition-all duration-200',
                    active
                      ? 'border-[rgba(246,227,180,.55)] bg-[rgba(227,194,124,.06)] shadow-[0_0_24px_rgba(227,194,124,.18)]'
                      : 'border-[rgba(227,194,124,.14)] bg-ink/40 hover:border-[rgba(227,194,124,.35)]',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span style={{ color }}>
                      <SuitIcon suit={c.suit} size={22} glow={active} />
                    </span>
                    <span className="font-serifsc text-[17px] font-semibold text-bone">{c.title}</span>
                    <span className="ml-auto text-[10px] tracking-[.2em]" style={{ color }}>
                      {c.tagline}
                    </span>
                  </span>
                  <p className="mt-2 text-[12px] leading-relaxed text-dim">{c.desc}</p>
                  {active && (
                    <motion.span
                      layoutId="tpl-seal"
                      className="absolute -right-1.5 -top-1.5 flex h-7 w-7 rotate-6 items-center justify-center rounded-[4px] bg-[#B0352E] font-mashan text-[14px] text-white shadow-md"
                    >
                      选
                    </motion.span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}

        {/* 第二步：参数 */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div className="rounded-xl border border-[rgba(227,194,124,.12)] bg-ink/40 p-3">
              <div className="mb-1 text-[11px] tracking-[.25em] text-faint">对局骨架</div>
              <Stepper label="席位" value={seats} min={SDK_LIMITS.seats.min} max={SDK_LIMITS.seats.max} unit="人" onChange={setSeats} />
              <Stepper label="轮数" value={rounds} min={SDK_LIMITS.rounds.min} max={SDK_LIMITS.rounds.max} unit="轮" onChange={setRounds} />
              <Stepper label="行动时限" value={windowSec} min={SDK_LIMITS.submitWindowSec.min} max={SDK_LIMITS.submitWindowSec.max} step={5} unit="s" onChange={setWindowSec} />
              {template === 'numberGuess' ? (
                <>
                  <div className="mt-2 border-t border-[rgba(227,194,124,.08)] pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] text-dim">均值倍率</span>
                      <span className="font-mono text-[14px] text-suit-club">{targetRatio.toFixed(3)}</span>
                    </div>
                    <Slider
                      value={[targetRatio]}
                      min={SDK_LIMITS.targetRatio.min}
                      max={SDK_LIMITS.targetRatio.max}
                      step={0.001}
                      onValueChange={(v) => setTargetRatio(Math.round(v[0] * 1000) / 1000)}
                      className="w-full [&_[data-slot=slider-range]]:bg-suit-club [&_[data-slot=slider-thumb]]:border-suit-club [&_[data-slot=slider-thumb]]:bg-ink"
                    />
                  </div>
                  <Stepper label="出数下限" value={rangeMin} min={0} max={999} step={10} onChange={setRangeMin} />
                  <Stepper label="出数上限" value={rangeMax} min={1} max={1000} step={10} onChange={setRangeMax} />
                  <Stepper label="胜轮得分" value={scoreWin} min={1} max={10} onChange={setScoreWin} />
                  <Stepper label="次近得分" value={scoreSecond} min={0} max={10} onChange={setScoreSecond} />
                </>
              ) : template === 'pollDuel' ? (
                <>
                  <div className="mt-2 border-t border-[rgba(227,194,124,.08)] pt-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[13px] text-dim">选项标签（{choices.length}/4）</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={choices.length <= SDK_LIMITS.choices.min}
                          onClick={() => setChoices((cs) => cs.slice(0, -1))}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(227,194,124,.25)] text-gold-300 disabled:opacity-30"
                        >
                          <Minus size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={choices.length >= SDK_LIMITS.choices.max}
                          onClick={() => setChoices((cs) => [...cs, `选项${cs.length + 1}`])}
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(227,194,124,.25)] text-gold-300 disabled:opacity-30"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {choices.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span
                            className="flex h-6 w-6 shrink-0 rotate-2 items-center justify-center rounded-[4px] font-mashan text-[13px] text-white"
                            style={{ background: SEAL_COLORS[i] }}
                          >
                            {i + 1}
                          </span>
                          <input
                            value={c}
                            maxLength={SDK_LIMITS.choiceLabel.max}
                            onChange={(e) =>
                              setChoices((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))
                            }
                            className="h-8 w-full rounded-lg border border-bone/12 bg-ink px-2 text-[13px] text-bone outline-none focus:border-suit-heart/60"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Stepper label="少数派得分" value={scoreWin} min={1} max={10} onChange={setScoreWin} />
                </>
              ) : (
                <>
                  <div className="mt-2 border-t border-[rgba(227,194,124,.08)] pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] text-dim">蛐蛐善变度</span>
                      <span className="font-mono text-[14px] text-suit-spade">{fickleness.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[fickleness]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={(v) => setFickleness(v[0])}
                      className="w-full [&_[data-slot=slider-range]]:bg-suit-spade [&_[data-slot=slider-thumb]]:border-suit-spade [&_[data-slot=slider-thumb]]:bg-ink"
                    />
                  </div>
                  <div className="mt-2 border-t border-[rgba(227,194,124,.08)] pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[13px] text-dim">同形拥挤度</span>
                      <span className="font-mono text-[14px] text-suit-spade">{crowding.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[crowding]}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={(v) => setCrowding(v[0])}
                      className="w-full [&_[data-slot=slider-range]]:bg-suit-spade [&_[data-slot=slider-thumb]]:border-suit-spade [&_[data-slot=slider-thumb]]:bg-ink"
                    />
                  </div>
                  <Stepper label="怒气阈值" value={rageThreshold} min={1} max={30} onChange={setRageThreshold} />
                  <Stepper label="命中得分" value={scoreWin} min={1} max={10} onChange={setScoreWin} />
                </>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[rgba(227,194,124,.12)] bg-ink/40 p-3">
                <div className="mb-1 text-[11px] tracking-[.25em] text-faint">门票（0 = 友谊局）</div>
                <div className="mb-2 flex items-center gap-2">
                  {(['spade', 'heart', 'club', 'diamond'] as Suit[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFeeSuit(s)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border transition-all',
                        feeSuit === s
                          ? 'border-[rgba(246,227,180,.55)] bg-[rgba(227,194,124,.08)]'
                          : 'border-[rgba(227,194,124,.15)] hover:border-[rgba(227,194,124,.35)]',
                      )}
                      style={{ color: SUIT_META[s].color }}
                    >
                      <SuitIcon suit={s} size={16} glow={feeSuit === s} />
                    </button>
                  ))}
                </div>
                <Stepper label="门票数额" value={feeAmount} min={SDK_LIMITS.entryFee.min} max={SDK_LIMITS.entryFee.max} unit="碎片" onChange={setFeeAmount} />
              </div>
              <div className="rounded-xl border border-[rgba(227,194,124,.12)] bg-ink/40 p-3">
                <div className="mb-1 text-[11px] tracking-[.25em] text-faint">奖励（同花色碎片）</div>
                <Stepper label="冠军" value={rewardWinner} min={SDK_LIMITS.reward.min} max={SDK_LIMITS.reward.max} step={5} onChange={setRewardWinner} />
                <Stepper label="亚军" value={rewardRunner} min={SDK_LIMITS.reward.min} max={SDK_LIMITS.reward.max} step={5} onChange={setRewardRunner} />
                <Stepper label="参与" value={rewardPart} min={SDK_LIMITS.reward.min} max={SDK_LIMITS.reward.max} step={5} onChange={setRewardPart} />
              </div>
              <div className="rounded-xl border border-[rgba(78,203,156,.25)] bg-[rgba(78,203,156,.05)] px-3 py-2.5">
                <span className="text-[11px] tracking-[.25em] text-faint">预计一局时长</span>
                <div className="mt-0.5 font-cinzel text-[20px] font-bold text-suit-club">{fmtDuration(estimateSec)}</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 第三步：命名 + 开天辟地 */}
        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-5 py-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="为你的游戏命名…"
              className="h-12 w-full max-w-[380px] rounded-xl border border-bone/15 bg-ink px-4 text-center font-serifsc text-[18px] text-bone outline-none placeholder:text-faint focus:border-gold-300/60"
            />
            <p className="text-center text-[12px] leading-relaxed text-dim">
              {template === 'numberGuess'
                ? `${seats} 席 · ${rounds} 轮 · ${rangeMin}–${rangeMax} 出数 · 倍率 ${targetRatio.toFixed(3)}`
                : template === 'pollDuel'
                  ? `${seats} 席 · ${rounds} 轮 · ${choices.map((c) => c || '？').join(' / ')} 少数派胜`
                  : `${seats} 席 · ${rounds} 轮 · 善变 ${fickleness.toFixed(2)} · 拥挤 ${crowding.toFixed(2)} · 怒气阈值 ${rageThreshold}`}
              <br />
              门票 {feeAmount} <span style={{ color: SUIT_META[activeSuit].color }}>{SUIT_META[activeSuit].symbol}</span>
              {' · '}冠军 {rewardWinner} / 亚军 {rewardRunner} / 参与 {rewardPart} · 时限 {windowSec}s
            </p>
            <motion.button
              type="button"
              disabled={forging}
              onClick={() => void forge()}
              whileHover={{ scale: 1.04, rotate: -2 }}
              whileTap={{ scale: 0.94, rotate: 2 }}
              className="flex h-24 w-24 flex-col items-center justify-center rounded-[10px] bg-[#B0352E] font-mashan text-[22px] leading-tight text-white shadow-[0_0_32px_rgba(216,68,60,.4),inset_0_1px_0_rgba(255,255,255,.25)] disabled:opacity-50"
            >
              {forging ? '铸造中' : '开天辟地'}
            </motion.button>
            <span className="text-[11px] tracking-[.3em] text-faint">印落 · 游戏即成 · 直入新房</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部导航 */}
      <div className="mt-5 flex items-center justify-between">
        <GoldButton variant="ghost" size="sm" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft size={14} /> 上一步
        </GoldButton>
        <span className="text-[11px] tracking-[.3em] text-faint">
          {step + 1} / 3
        </span>
        {step < 2 ? (
          <GoldButton
            variant="gold"
            size="sm"
            disabled={step === 1 && !step2Valid}
            onClick={() => setStep((s) => s + 1)}
          >
            下一步 <ChevronRight size={14} />
          </GoldButton>
        ) : (
          <GoldButton variant="ghost" size="sm" onClick={onClose}>
            <X size={14} /> 稍后再铸
          </GoldButton>
        )}
      </div>
    </GameModal>
  )
}

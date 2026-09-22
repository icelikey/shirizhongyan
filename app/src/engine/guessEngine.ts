/**
 * ============================================================================
 * 猜平均数引擎（src/engine/guessEngine.ts）· ♣ 青野演算场
 * ----------------------------------------------------------------------------
 * 规则：6 人秘密提交 0–100 实数，最接近「平均值 × 2/3」者胜该轮
 *       （平局先提交者胜），共 5 轮，逐轮公布全部数字与均值；
 *       积分制：胜轮 +2，次近 +1。
 * 门票 10 ♣；结算：冠军 +50♣ / 亚军 +25♣ / 参与 +5♣，冠军记 MVP。
 *
 * 纯 TS 状态机：页面通过 subscribe + getState 订阅，通过 submitHuman 等方法输入。
 * AI 决策带 0.8–2.2s 思考延迟（agents.ts），全部异步编排，可 destroy() 中断。
 * ============================================================================
 */
import type { Echo } from '@/data/echoes'
import { getEcho } from '@/data/echoes'
import type { AwaitingInput, GamePhase, LogItem, Seat } from './types'
import { Rng } from './rng'
import type { AgentBrain, GuessHistorySummary } from './agents'
import { HeuristicBrain, clampGuess, decideGuessNumber, thinkMs } from './agents'

export const GUESS_ROUNDS = 5
export const GUESS_TICKET = 10
export const GUESS_SUBMIT_TIMEOUT_SEC = 30
/** 真人提交后的反悔窗口（毫秒） */
export const RETRACT_WINDOW_MS = 3000
/** 揭示阶段停留时长（浑天仪演出） */
export const REVEAL_MS = 4200

export const GUESS_REWARDS = { champion: 50, runnerUp: 25, participant: 5 } as const

export interface GuessEntry {
  seat: number
  value: number
  /** 提交顺序（0 起，平局先提交者胜） */
  order: number
}

export interface GuessRoundResult {
  round: number
  entries: GuessEntry[]
  average: number
  target: number
  winnerSeat: number
  runnerSeat: number
  deltas: Record<number, number>
  points: Record<number, number>
  /** 胜者是否因「先提交」规则从平局中胜出 */
  tieWin: boolean
}

export interface GuessState {
  phase: GamePhase
  round: number
  seats: Seat[]
  /** 正在思忖的座位（AI 或委托中的真人） */
  thinking: number[]
  /** 已提交座位（按提交顺序） */
  submitted: number[]
  /** 揭示阶段公开的数值 */
  values: Record<number, number>
  scores: Record<number, number>
  history: GuessRoundResult[]
  log: LogItem[]
  /** 终局名次（seat 按名次排序），未结束为 null */
  rankings: number[] | null
  awaiting: AwaitingInput | null
  /** 真人反悔截止时间戳（已提交后 3s 内） */
  retractUntil: number | null
  /** countdown / reveal 阶段结束时间戳 */
  phaseEndsAt: number | null
  version: number
}

export interface GuessEngineOptions {
  seats: Seat[]
  /** 真人座位（恒 0） */
  humanSeat: number
  seed: number
  /** 玩家的契约影从（委托代打 / 超时兜底的人设） */
  companion: Echo
  /** 页面侧「委托影从」开关状态 */
  isDelegated: () => boolean
}

export class GuessEngine {
  private state: GuessState
  private listeners = new Set<() => void>()
  private rng: Rng
  private brains = new Map<number, AgentBrain>()
  private humanBrain: AgentBrain
  private opts: GuessEngineOptions
  private stopped = false
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private logId = 0

  /* 本轮提交数据 */
  private submissions = new Map<number, GuessEntry>()
  private allResolve: (() => void) | null = null
  private humanResolve: ((code: 'submitted' | 'retracted' | 'timeout') => void) | null = null
  /** 页面滑杆草稿值（超时兜底按草稿落子） */
  private humanDraft = 33.3

  constructor(opts: GuessEngineOptions) {
    this.opts = opts
    this.rng = new Rng(opts.seed)
    this.humanBrain = new HeuristicBrain(opts.companion)
    for (const s of opts.seats) {
      if (s.kind === 'echo' && s.echoId) {
        const echo = getEcho(s.echoId)
        if (echo) this.brains.set(s.seat, new HeuristicBrain(echo))
      }
    }
    this.state = {
      phase: 'waiting',
      round: 0,
      seats: opts.seats,
      thinking: [],
      submitted: [],
      values: {},
      scores: Object.fromEntries(opts.seats.map((s) => [s.seat, 0])),
      history: [],
      log: [],
      rankings: null,
      awaiting: null,
      retractUntil: null,
      phaseEndsAt: null,
      version: 0,
    }
  }

  /* ------------------------------------------------------------------ */
  /* 订阅                                                                */
  /* ------------------------------------------------------------------ */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getState = (): GuessState => this.state

  private emit(patch: Partial<GuessState>) {
    if (this.stopped) return
    this.state = { ...this.state, ...patch, version: this.state.version + 1 }
    this.listeners.forEach((fn) => fn())
  }

  private log(text: string, kind: LogItem['kind'] = 'system') {
    this.logId += 1
    return [...this.state.log, { id: this.logId, text, kind }].slice(-80)
  }

  /* ------------------------------------------------------------------ */
  /* 定时器管理                                                          */
  /* ------------------------------------------------------------------ */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.timers.delete(t)
        resolve()
      }, ms)
      this.timers.add(t)
    })
  }

  destroy() {
    this.stopped = true
    this.timers.forEach((t) => clearTimeout(t))
    this.timers.clear()
    this.humanResolve?.('timeout')
    this.allResolve?.()
  }

  /* ------------------------------------------------------------------ */
  /* 页面输入                                                            */
  /* ------------------------------------------------------------------ */

  /** 真人提交数字（或委托开关下由引擎代提交） */
  submitHuman(value: number) {
    if (this.state.phase !== 'submit') return
    if (this.submissions.has(this.opts.humanSeat)) return
    this.commit(this.opts.humanSeat, clampGuess(value))
    this.emit({ retractUntil: Date.now() + RETRACT_WINDOW_MS, awaiting: null })
    this.humanResolve?.('submitted')
  }

  /** 3 秒内反悔：撤回本轮提交，重新等待输入 */
  retractHuman() {
    const { phase, retractUntil } = this.state
    if (phase !== 'submit' || retractUntil == null || Date.now() > retractUntil) return
    if (!this.submissions.has(this.opts.humanSeat)) return
    this.submissions.delete(this.opts.humanSeat)
    const submitted = this.state.submitted.filter((s) => s !== this.opts.humanSeat)
    this.emit({ submitted, retractUntil: null, log: this.log('你 撤回了落子', 'action') })
    this.humanResolve?.('retracted')
  }

  /** 页面滑杆草稿（超时按此落子） */
  setHumanDraft(v: number) {
    this.humanDraft = clampGuess(v)
  }

  /* ------------------------------------------------------------------ */
  /* 主流程                                                              */
  /* ------------------------------------------------------------------ */

  async start() {
    // 等待室：座位补满（页面演出）→ 3-2-1
    await this.sleep(1500)
    if (this.stopped) return
    this.emit({ phase: 'countdown', phaseEndsAt: Date.now() + 2400, log: this.log('六座齐 · 青野算庭开演') })
    await this.sleep(2400)

    for (let round = 1; round <= GUESS_ROUNDS; round++) {
      if (this.stopped) return
      await this.runRound(round)
    }

    if (this.stopped) return
    const rankings = this.computeRankings()
    const champion = this.seatName(rankings[0])
    this.emit({
      phase: 'finished',
      rankings,
      phaseEndsAt: null,
      log: this.log(`终局 · ${champion} 夺魁`, 'result'),
    })
  }

  private async runRound(round: number) {
    this.submissions = new Map()
    const allSubmitted = new Promise<void>((resolve) => {
      this.allResolve = resolve
    })

    this.emit({
      phase: 'submit',
      round,
      submitted: [],
      values: {},
      thinking: [],
      retractUntil: null,
      phaseEndsAt: null,
      log: this.log(`第 ${round} / ${GUESS_ROUNDS} 轮 · 请落子`),
    })

    /* AI 座位并发思考（带 0.8–2.2s 延迟，节奏错峰） */
    const aiTasks: Promise<void>[] = []
    for (const seat of this.state.seats) {
      if (seat.kind === 'echo') aiTasks.push(this.aiSubmit(seat.seat))
    }
    /* 真人：委托 → 契约影从代出；否则等待页面输入 */
    if (this.opts.isDelegated()) {
      aiTasks.push(this.aiSubmit(this.opts.humanSeat))
    } else {
      aiTasks.push(this.waitHumanRound())
    }

    await Promise.all([allSubmitted, ...aiTasks])
    if (this.stopped) return

    this.settleRound(round)
    if (this.stopped) return
    await this.sleep(REVEAL_MS)
  }

  /** AI 座位：思考延迟 → 出数 → 提交 */
  private async aiSubmit(seatNo: number) {
    const brain = seatNo === this.opts.humanSeat ? this.humanBrain : this.brains.get(seatNo)
    if (!brain) return
    this.addThinking(seatNo)
    const ms = thinkMs(this.rng, brain.params)
    await this.sleep(ms)
    this.removeThinking(seatNo)
    if (this.stopped || this.state.phase !== 'submit') return
    const value = brain.pickGuessNumber(this.historySummaries(seatNo), this.rng)
    this.commit(seatNo, value)
  }

  /** 真人回合：等待输入（支持反悔重等 / 超时按草稿落子） */
  private async waitHumanRound() {
    const human = this.opts.humanSeat
    while (!this.stopped && this.state.phase === 'submit' && !this.submissions.has(human)) {
      const code = await new Promise<'submitted' | 'retracted' | 'timeout'>((resolve) => {
        this.humanResolve = (c) => {
          this.humanResolve = null
          resolve(c)
        }
        this.emit({
          awaiting: { kind: 'guessNumber', seat: human, timeoutSec: GUESS_SUBMIT_TIMEOUT_SEC, startedAt: Date.now() },
          retractUntil: null,
        })
        const t = setTimeout(() => {
          this.timers.delete(t)
          if (this.humanResolve) {
            this.humanResolve = null
            resolve('timeout')
          }
        }, GUESS_SUBMIT_TIMEOUT_SEC * 1000)
        this.timers.add(t)
      })
      if (code === 'retracted') continue
      if (code === 'timeout' && !this.submissions.has(human)) {
        // 超时兜底：按页面滑杆草稿落子（design：超时自动按滑杆当前值提交）
        this.commit(human, clampGuess(this.humanDraft))
        this.emit({ awaiting: null, log: this.log(`时间到 · 已按 ${this.humanDraft.toFixed(1)} 落子`, 'action') })
      }
    }
  }

  /** 记录一次提交（统一入口，维护提交顺序） */
  private commit(seatNo: number, value: number) {
    if (this.submissions.has(seatNo) || this.state.phase !== 'submit') return
    const entry: GuessEntry = { seat: seatNo, value, order: this.submissions.size }
    this.submissions.set(seatNo, entry)
    const submitted = [...this.state.submitted, seatNo]
    this.emit({ submitted, log: this.log(`${this.seatName(seatNo)} 提交了数字`, 'action') })
    if (this.submissions.size >= this.state.seats.length) {
      this.allResolve?.()
      this.allResolve = null
    }
  }

  /** 结算一轮：均值 / 目标 / 胜者 / 积分 */
  private settleRound(round: number) {
    const entries = [...this.submissions.values()].sort((a, b) => a.order - b.order)
    const sum = entries.reduce((acc, e) => acc + e.value, 0)
    const average = Math.round((sum / entries.length) * 100) / 100
    const target = Math.round(average * (2 / 3) * 100) / 100

    const deltas: Record<number, number> = {}
    for (const e of entries) deltas[e.seat] = Math.round(Math.abs(e.value - target) * 100) / 100

    const minDelta = Math.min(...entries.map((e) => deltas[e.seat]))
    const winners = entries.filter((e) => deltas[e.seat] === minDelta)
    const winner = winners[0] // 平局 → 先提交者胜（entries 已按提交序）
    const tieWin = winners.length > 1

    const rest = entries.filter((e) => e.seat !== winner.seat)
    const runnerDelta = Math.min(...rest.map((e) => deltas[e.seat]))
    const runner = rest.find((e) => deltas[e.seat] === runnerDelta)!

    const points: Record<number, number> = {}
    for (const e of entries) points[e.seat] = 0
    points[winner.seat] = 2
    points[runner.seat] = 1

    const scores = { ...this.state.scores }
    scores[winner.seat] += 2
    scores[runner.seat] += 1

    const values: Record<number, number> = {}
    for (const e of entries) values[e.seat] = e.value

    const result: GuessRoundResult = {
      round,
      entries,
      average,
      target,
      winnerSeat: winner.seat,
      runnerSeat: runner.seat,
      deltas,
      points,
      tieWin,
    }

    const winnerText = tieWin
      ? `${this.seatName(winner.seat)}（同距 · 先提交者胜）`
      : this.seatName(winner.seat)
    this.emit({
      phase: 'reveal',
      values,
      scores,
      history: [...this.state.history, result],
      retractUntil: null,
      awaiting: null,
      log: this.log(
        `第 ${round} 轮 · 均值 ${average.toFixed(2)} → 目标 ${target.toFixed(2)} · ${winnerText} +2 · ${this.seatName(runner.seat)} +1`,
        'result',
      ),
    })
  }

  private computeRankings(): number[] {
    const { seats, scores, history } = this.state
    const roundWins = new Map<number, number>()
    const deltaSum = new Map<number, number>()
    for (const s of seats) {
      roundWins.set(s.seat, 0)
      deltaSum.set(s.seat, 0)
    }
    for (const r of history) {
      roundWins.set(r.winnerSeat, (roundWins.get(r.winnerSeat) ?? 0) + 1)
      for (const e of r.entries) deltaSum.set(e.seat, (deltaSum.get(e.seat) ?? 0) + r.deltas[e.seat])
    }
    return seats
      .map((s) => s.seat)
      .sort(
        (a, b) =>
          scores[b] - scores[a] ||
          (roundWins.get(b) ?? 0) - (roundWins.get(a) ?? 0) ||
          (deltaSum.get(a) ?? 0) - (deltaSum.get(b) ?? 0) ||
          a - b,
      )
  }

  /* ------------------------------------------------------------------ */
  /* 工具                                                                */
  /* ------------------------------------------------------------------ */

  private historySummaries(excludeSeat: number): GuessHistorySummary[] {
    return this.state.history.map((r) => {
      const others = r.entries.filter((e) => e.seat !== excludeSeat)
      const othersMean = others.reduce((a, e) => a + e.value, 0) / Math.max(1, others.length)
      return { average: r.average, target: r.target, othersMean }
    })
  }

  private addThinking(seatNo: number) {
    if (this.stopped) return
    this.emit({ thinking: [...this.state.thinking, seatNo] })
  }

  private removeThinking(seatNo: number) {
    if (this.stopped) return
    this.emit({ thinking: this.state.thinking.filter((s) => s !== seatNo) })
  }

  private seatName(seatNo: number): string {
    return this.state.seats.find((s) => s.seat === seatNo)?.name ?? `${seatNo + 1} 号`
  }

  /** 某名次对应的 ♣ 奖励（友谊局 ranked=false → 0） */
  static rewardFor(rank: number, ranked: boolean): number {
    if (!ranked) return 0
    if (rank === 0) return GUESS_REWARDS.champion
    if (rank === 1) return GUESS_REWARDS.runnerUp
    return GUESS_REWARDS.participant
  }

  /** 供测试 / 调试：直接计算一个 level-k 出数（不走延迟） */
  static peekNumber(echo: Echo, history: readonly GuessHistorySummary[], seed: number): number {
    const brain = new HeuristicBrain(echo)
    return decideGuessNumber(brain.params, history, new Rng(seed))
  }
}

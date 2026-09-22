/**
 * ============================================================================
 * 月影狼人杀引擎（src/engine/werewolfEngine.ts）· ♠ 玄渊圆桌
 * ----------------------------------------------------------------------------
 * 6 人简化局：狼人 ×2、预言家 ×1、女巫 ×1、平民 ×2。
 * 流程：发牌（翻牌演出）→ 夜晚（狼刀 → 预言验 → 女巫救/毒，可同救同毒）
 *       → 清晨死讯 → 白天逐人发言（顺序轮换）→ 投票放逐（平票无人出局）
 *       → 遗言 → 下一夜。
 * 胜负：狼人屠边（狼 ≥ 好人）狼胜；放逐全部狼人则好人胜。
 *
 * AI 行为（agents.ts 人设参数驱动）：
 *   狼：协调刀法（优先神职嫌疑）、悍跳/冲锋/倒钩/划水按人设选策略、互保互踩；
 *   预言家：夜晚验人，白天按人设决定报查验时机与对跳；
 *   女巫：首夜大概率救人，毒药留给高嫌疑目标；
 *   平民：基于发言可信度评分投票。
 * 发言生成见 speech.ts（模板池 + 场上信息填充）。
 *
 * 门票 15♠；结算：胜方 +60♠ / 败方 +8♠ / MVP 额外 +20♠。
 * MVP 启发式：胜方中关键行动最多者（狼刀准 / 验出狼 / 毒中狼 / 带票放逐狼）。
 *
 * 纯 TS 状态机：页面 subscribe + getState；私密信息（AI 验人结果、狼队频道）
 * 不下发到公共 state，页面只能看到人类玩家视角可见的内容。
 * ============================================================================
 */
import type { Echo } from '@/data/echoes'
import { getEcho } from '@/data/echoes'
import type { AwaitingInput, GamePhase, Seat } from './types'
import { Rng } from './rng'
import type { AgentBrain } from './agents'
import { HeuristicBrain, thinkMs } from './agents'
import type { SpeechIntent } from './speech'
import { speak } from './speech'

export const WOLF_TICKET = 15
export const WOLF_REWARDS = { win: 60, lose: 8, mvp: 20 } as const
export const DEAL_MS = 5200
export const DAWN_MS = 3000
export const VOTE_REVEAL_MS = 4600
export const NIGHT_STEP_MS = 1600

export type Role = 'werewolf' | 'seer' | 'witch' | 'villager'
export type Camp = 'wolf' | 'good'

export const ROLE_META: Record<Role, { name: string; camp: Camp; image: string; motto: string }> = {
  werewolf: { name: '狼人', camp: 'wolf', image: '/role-werewolf.png', motto: '夜色，是你最好的外衣。' },
  seer: { name: '预言家', camp: 'good', image: '/role-seer.png', motto: '天目所至，诸相现形。' },
  witch: { name: '女巫', camp: 'good', image: '/role-witch.png', motto: '一瓶救苍生，一瓶断人肠。' },
  villager: { name: '平民', camp: 'good', image: '/role-villager.png', motto: '提灯的人，也能照亮真相。' },
}

export interface WolfSeat extends Seat {
  role: Role
  alive: boolean
}

export interface SpeechEntry {
  id: number
  day: number
  seat: number | null // null = 系统条目
  text: string
  kind: 'speech' | 'system'
  phase: GamePhase
}

export interface SeerRecord {
  day: number
  target: number
  isWolf: boolean
}

export interface WitchSnapshot {
  saveUsed: boolean
  poisonUsed: boolean
}

export interface VoteResult {
  day: number
  votes: Record<number, number | null>
  tally: Record<number, number>
  exiled: number | null
  tie: boolean
}

export interface WolfState {
  phase: GamePhase
  day: number
  seats: WolfSeat[]
  /** 狼队频道：今夜刀口（仅狼人 + 女巫环节页面可见） */
  killTarget: number | null
  /** AI 狼队友的刀法建议气泡（仅真人狼可见） */
  wolfSuggestion: { fromSeat: number; target: number; text: string } | null
  /** 真人预言家的查验记录（仅本人可见；AI 验人不下发） */
  humanSeerRecords: SeerRecord[]
  /** 女巫双药状态 */
  witch: WitchSnapshot
  /** 今夜待救者（女巫行动环节展示给女巫） */
  pendingVictim: number | null
  lastNightDeaths: number[]
  dawnText: string
  speeches: SpeechEntry[]
  currentSpeaker: number | null
  speakerQueue: number[]
  votes: Record<number, number | null>
  voteResult: VoteResult | null
  lastWordsSeat: number | null
  /** 公开跳预言家的座位 */
  seerClaimants: number[]
  winner: Camp | null
  mvpSeat: number | null
  mvpNote: string
  keyActions: Record<number, string[]>
  awaiting: AwaitingInput | null
  /** 公共嫌疑榜榜首（仅供影从低语气泡上下文） */
  topSuspect: number | null
  phaseEndsAt: number | null
  version: number
}

export interface WolfEngineOptions {
  seats: Seat[]
  humanSeat: number
  seed: number
  companion: Echo
  isDelegated: () => boolean
}

type HumanPayload =
  | { type: 'wolfKill'; target: number }
  | { type: 'seerCheck'; target: number }
  | { type: 'witchAction'; save: boolean; poison: number | null }
  | { type: 'speech'; text: string }
  | { type: 'vote'; target: number | null }
  | { type: 'lastWords'; text: string }

export class WerewolfEngine {
  private state: WolfState
  private listeners = new Set<() => void>()
  private rng: Rng
  private brains = new Map<number, AgentBrain>()
  private humanBrain: AgentBrain
  private opts: WolfEngineOptions
  private stopped = false
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private speechId = 0
  private humanResolve: ((p: HumanPayload) => void) | null = null

  /* -------- 私密（不下发） -------- */
  private suspicion: number[] = []
  private aiSeerKnowledge = new Map<number, boolean>() // target → isWolf（AI 预言家视角）
  private aiSeerFoundWolf: number[] = []
  private aiSeerClaimed = false
  private mvpScore = new Map<number, number>()
  private keyAct = new Map<number, string[]>()
  private firstAccuser = new Map<number, number>() // target → 当日最早指控者
  private claimReports = new Map<number, number>() // 跳预言家者 → 其报出的「狼」目标
  private defenders = new Map<number, number[]>() // target → 当日为其辩护者
  private accusersOf = new Map<number, number[]>() // target → 曾公开指控过它的座位（跨天累计）
  private dayAccuseCount = new Map<number, number>() // target → 当日被指控次数（跟风检测）
  private dayAggressors = new Set<number>() // 当日公开踩人者（狼队避免双狼同踩）

  constructor(opts: WolfEngineOptions) {
    this.opts = opts
    this.rng = new Rng(opts.seed)
    this.humanBrain = new HeuristicBrain(opts.companion)
    for (const s of opts.seats) {
      if (s.kind === 'echo' && s.echoId) {
        const echo = getEcho(s.echoId)
        if (echo) this.brains.set(s.seat, new HeuristicBrain(echo))
      }
    }
    const seats: WolfSeat[] = opts.seats.map((s) => ({ ...s, role: 'villager' as Role, alive: true }))
    this.state = {
      phase: 'deal',
      day: 1,
      seats,
      killTarget: null,
      wolfSuggestion: null,
      humanSeerRecords: [],
      witch: { saveUsed: false, poisonUsed: false },
      pendingVictim: null,
      lastNightDeaths: [],
      dawnText: '',
      speeches: [],
      currentSpeaker: null,
      speakerQueue: [],
      votes: {},
      voteResult: null,
      lastWordsSeat: null,
      seerClaimants: [],
      winner: null,
      mvpSeat: null,
      mvpNote: '',
      keyActions: {},
      awaiting: null,
      topSuspect: null,
      phaseEndsAt: null,
      version: 0,
    }
  }

  /* ------------------------------------------------------------------ */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getState = (): WolfState => this.state

  private emit(patch: Partial<WolfState>) {
    if (this.stopped) return
    this.state = { ...this.state, ...patch, version: this.state.version + 1 }
    this.listeners.forEach((fn) => fn())
  }

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
    this.humanResolve?.({ type: 'vote', target: null })
  }

  /* ------------------------------------------------------------------ */
  /* 页面输入                                                            */
  /* ------------------------------------------------------------------ */
  submitWolfKill(target: number) {
    this.humanResolve?.({ type: 'wolfKill', target })
  }
  submitSeerCheck(target: number) {
    this.humanResolve?.({ type: 'seerCheck', target })
  }
  submitWitchAction(save: boolean, poison: number | null) {
    this.humanResolve?.({ type: 'witchAction', save, poison })
  }
  submitSpeech(text: string) {
    this.humanResolve?.({ type: 'speech', text: text.slice(0, 160) })
  }
  submitVote(target: number | null) {
    this.humanResolve?.({ type: 'vote', target })
  }
  submitLastWords(text: string) {
    this.humanResolve?.({ type: 'lastWords', text: text.slice(0, 60) })
  }

  /* ------------------------------------------------------------------ */
  /* 基础工具                                                            */
  /* ------------------------------------------------------------------ */
  private brainOf(seat: number): AgentBrain {
    return seat === this.opts.humanSeat ? this.humanBrain : this.brains.get(seat) ?? this.humanBrain
  }

  private roleOf(seat: number): Role {
    return this.state.seats[seat].role
  }

  private isAlive(seat: number): boolean {
    return this.state.seats[seat].alive
  }

  private aliveSeats(): number[] {
    return this.state.seats.filter((s) => s.alive).map((s) => s.seat)
  }

  private wolves(): number[] {
    return this.state.seats.filter((s) => s.role === 'werewolf').map((s) => s.seat)
  }

  private aliveWolves(): number[] {
    return this.wolves().filter((s) => this.isAlive(s))
  }

  private aliveGoods(): number[] {
    return this.aliveSeats().filter((s) => this.roleOf(s) !== 'werewolf')
  }

  private name(seat: number): string {
    return this.state.seats[seat].name
  }

  /** 展示号位（1–6） */
  static displaySeat(seat: number): number {
    return seat + 1
  }

  private pushSpeech(seat: number | null, text: string, kind: 'speech' | 'system', phase: GamePhase): SpeechEntry[] {
    this.speechId += 1
    const entry: SpeechEntry = { id: this.speechId, day: this.state.day, seat, text, kind, phase }
    return [...this.state.speeches, entry].slice(-160)
  }

  private addKey(seat: number, action: string, score: number) {
    this.keyAct.set(seat, [...(this.keyAct.get(seat) ?? []), action])
    this.mvpScore.set(seat, (this.mvpScore.get(seat) ?? 0) + score)
  }

  private addSuspicion(seat: number, delta: number) {
    this.suspicion[seat] = Math.max(0, Math.min(1, this.suspicion[seat] + delta))
    const top = this.suspicion.indexOf(Math.max(...this.suspicion))
    if (top !== this.state.topSuspect) this.emit({ topSuspect: top })
  }

  /* ------------------------------------------------------------------ */
  /* 真人输入等待（带超时兜底）                                           */
  /* ------------------------------------------------------------------ */
  private waitInput(kind: AwaitingInput['kind'], timeoutSec: number): Promise<HumanPayload | null> {
    return new Promise<HumanPayload | null>((resolve) => {
      this.humanResolve = (p) => {
        this.humanResolve = null
        resolve(p)
      }
      this.emit({ awaiting: { kind, seat: this.opts.humanSeat, timeoutSec, startedAt: Date.now() } })
      const t = setTimeout(() => {
        this.timers.delete(t)
        if (this.humanResolve) {
          this.humanResolve = null
          resolve(null)
        }
      }, timeoutSec * 1000)
      this.timers.add(t)
    }).then((p) => {
      this.emit({ awaiting: null })
      return p
    })
  }

  /* ------------------------------------------------------------------ */
  /* 主流程                                                              */
  /* ------------------------------------------------------------------ */

  async start() {
    this.assignRoles()
    this.emit({ phase: 'deal', phaseEndsAt: Date.now() + DEAL_MS })
    await this.sleep(DEAL_MS)

    for (let day = 1; day <= 12 && !this.stopped; day++) {
      this.emit({ day })
      this.firstAccuser.clear()
      this.defenders.clear()
      this.dayAccuseCount.clear()
      this.dayAggressors.clear()
      /* ---------- 夜晚 ---------- */
      this.pushSystem(`第 ${day} 夜 · 天黑请闭眼`, 'nightWolf')
      const kill = await this.wolfPhase(day)
      if (this.stopped) return
      await this.seerPhase(day)
      if (this.stopped) return
      const deaths = await this.witchPhase(day, kill)
      if (this.stopped) return
      /* ---------- 清晨 ---------- */
      await this.dawn(day, deaths)
      if (this.stopped || this.finishIfOver()) return
      /* ---------- 白天发言 ---------- */
      await this.daySpeech(day)
      if (this.stopped) return
      /* ---------- 投票放逐 ---------- */
      const exiled = await this.dayVote(day)
      if (this.stopped || this.finishIfOver()) return
      /* ---------- 遗言 ---------- */
      if (exiled != null) {
        await this.lastWords(exiled)
        if (this.stopped || this.finishIfOver()) return
      }
    }
    // 异常兜底（不应到达）：按当前局势宣判
    this.finish(this.aliveWolves().length > 0 ? 'wolf' : 'good')
  }

  private assignRoles() {
    const roles = this.rng.shuffle<Role>(['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager'])
    const seats = this.state.seats.map((s, i) => ({ ...s, role: roles[i] }))
    /* 基础嫌疑取平（0.25）：让发言/事件产生的信息差决定票型，而非初始噪声 */
    this.suspicion = seats.map(() => 0.25)
    this.emit({ seats })
  }

  private pushSystem(text: string, phase: GamePhase) {
    this.emit({ speeches: this.pushSpeech(null, text, 'system', phase) })
  }

  /* ------------------------------------------------------------------ */
  /* 夜晚：狼刀                                                          */
  /* ------------------------------------------------------------------ */
  private async wolfPhase(day: number): Promise<number | null> {
    this.emit({ phase: 'nightWolf', killTarget: null, wolfSuggestion: null, pendingVictim: null, lastNightDeaths: [], dawnText: '' })
    const wolves = this.aliveWolves()
    if (wolves.length === 0) return null

    const human = this.opts.humanSeat
    const aiWolves = wolves.filter((w) => w !== human || this.opts.isDelegated())

    /* AI 狼（含被委托的真人狼）各出一个刀法建议 */
    let finalTarget: number | null = null
    const suggestions = new Map<number, number>()
    for (const w of aiWolves) {
      const brain = this.brainOf(w)
      await this.sleep(thinkMs(this.rng, brain.params) * 0.7)
      if (this.stopped) return null
      const target = this.chooseKillTarget(w)
      suggestions.set(w, target)
      finalTarget = target
    }

    if (wolves.includes(human) && !this.opts.isDelegated() && this.isAlive(human)) {
      /* 真人狼：队友建议气泡 + 等待落刀 */
      const aiMate = wolves.find((w) => w !== human)
      if (aiMate != null && suggestions.has(aiMate)) {
        const t = suggestions.get(aiMate)!
        const style = this.brainOf(aiMate).params.style
        this.emit({
          wolfSuggestion: {
            fromSeat: aiMate,
            target: t,
            text: speak(style, 'wolfSuggest', { day, t: WerewolfEngine.displaySeat(t), tn: this.name(t) }, this.rng),
          },
        })
      }
      const payload = await this.waitInput('wolfKill', 30)
      if (this.stopped) return null
      const chosen = payload?.type === 'wolfKill' && this.validKillTarget(payload.target) ? payload.target : null
      finalTarget = chosen ?? suggestions.values().next().value ?? this.chooseKillTarget(wolves[0])
    }

    if (finalTarget == null) finalTarget = this.chooseKillTarget(wolves[0])
    this.emit({ killTarget: finalTarget })
    /* MVP 记账：主刀狼 */
    const knifeOwner =
      wolves.includes(human) && !this.opts.isDelegated()
        ? human
        : wolves.find((w) => suggestions.get(w) === finalTarget) ?? wolves[0]
    this.addKey(knifeOwner, `第 ${day} 夜落刀 ${WerewolfEngine.displaySeat(finalTarget)} 号`, 1)
    if (this.roleOf(finalTarget) === 'seer' || this.roleOf(finalTarget) === 'witch') {
      this.addKey(knifeOwner, `刀落神职（${ROLE_META[this.roleOf(finalTarget)].name}）`, 2)
    }
    await this.sleep(NIGHT_STEP_MS)
    return finalTarget
  }

  private validKillTarget(target: number): boolean {
    return this.isAlive(target) && !this.wolves().includes(target)
  }

  /** 狼刀选目标：优先神职嫌疑，其次高可信/高威胁好人 */
  private chooseKillTarget(wolfSeat: number): number {
    const p = this.brainOf(wolfSeat).params
    const candidates = this.aliveGoods()
    let best = candidates[0]
    let bestScore = -Infinity
    for (const c of candidates) {
      let score = this.rng.gaussian() * 0.4 * (0.5 + p.noise)
      if (this.state.seerClaimants.includes(c)) score += 10 // 明预言家必杀
      score += (1 - this.suspicion[c]) * 1.6 // 越被信任越危险
      score -= this.suspicion[c] * 1.4 // 高嫌疑者留着扛票
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    return best
  }

  /* ------------------------------------------------------------------ */
  /* 夜晚：预言家验人                                                     */
  /* ------------------------------------------------------------------ */
  private async seerPhase(day: number) {
    this.emit({ phase: 'nightSeer' })
    const seerSeat = this.state.seats.find((s) => s.role === 'seer')?.seat
    if (seerSeat == null || !this.isAlive(seerSeat)) {
      await this.sleep(NIGHT_STEP_MS * 0.6)
      return
    }
    const human = this.opts.humanSeat
    if (seerSeat === human && !this.opts.isDelegated()) {
      const payload = await this.waitInput('seerCheck', 30)
      if (this.stopped) return
      const target =
        payload?.type === 'seerCheck' && this.isAlive(payload.target) && payload.target !== human
          ? payload.target
          : this.aiSeerPick(human)
      const isWolf = this.roleOf(target) === 'werewolf'
      this.emit({ humanSeerRecords: [...this.state.humanSeerRecords, { day, target, isWolf }] })
    } else {
      const brain = this.brainOf(seerSeat)
      await this.sleep(thinkMs(this.rng, brain.params) * 0.7)
      if (this.stopped) return
      const target = this.aiSeerPick(seerSeat)
      const isWolf = this.roleOf(target) === 'werewolf'
      this.aiSeerKnowledge.set(target, isWolf)
      if (isWolf) {
        this.aiSeerFoundWolf.push(target)
        this.addKey(seerSeat, `第 ${day} 夜验出狼人（${WerewolfEngine.displaySeat(target)} 号）`, 2)
      }
    }
    await this.sleep(NIGHT_STEP_MS * 0.6)
  }

  /** AI 预言家验人：未验者中嫌疑最高 */
  private aiSeerPick(seerSeat: number): number {
    const candidates = this.aliveSeats().filter((s) => s !== seerSeat && !this.aiSeerKnowledge.has(s))
    if (candidates.length === 0) return this.rng.pick(this.aliveSeats().filter((s) => s !== seerSeat))
    let best = candidates[0]
    let bestScore = -Infinity
    for (const c of candidates) {
      const score = this.suspicion[c] + this.rng.gaussian() * 0.15
      if (score > bestScore) {
        bestScore = score
        best = c
      }
    }
    return best
  }

  /* ------------------------------------------------------------------ */
  /* 夜晚：女巫救/毒（可同救同毒）→ 返回今夜死者                          */
  /* ------------------------------------------------------------------ */
  private async witchPhase(day: number, kill: number | null): Promise<number[]> {
    this.emit({ phase: 'nightWitch', pendingVictim: kill })
    const witchSeat = this.state.seats.find((s) => s.role === 'witch')?.seat
    const human = this.opts.humanSeat
    let deaths = kill != null ? [kill] : []

    if (witchSeat != null && this.isAlive(witchSeat)) {
      let save = false
      let poison: number | null = null
      if (witchSeat === human && !this.opts.isDelegated()) {
        const payload = await this.waitInput('witchAction', 30)
        if (this.stopped) return []
        if (payload?.type === 'witchAction') {
          save = payload.save && !this.state.witch.saveUsed && kill != null
          poison =
            payload.poison != null && !this.state.witch.poisonUsed && this.isAlive(payload.poison) && payload.poison !== witchSeat
              ? payload.poison
              : null
        }
      } else {
        const brain = this.brainOf(witchSeat)
        await this.sleep(thinkMs(this.rng, brain.params) * 0.7)
        if (this.stopped) return []
        const d = this.aiWitchDecision(witchSeat, day, kill)
        save = d.save
        poison = d.poison
      }
      if (save && kill != null) {
        deaths = []
        this.emit({ witch: { ...this.state.witch, saveUsed: true } })
        const savedRole = this.roleOf(kill)
        if (savedRole === 'seer' || savedRole === 'witch') this.addKey(witchSeat, '救下神职', 1)
        /* 女巫视角：被刀者必是好人（狼不自刀），永久排除嫌疑 */
        this.suspicion[kill] = 0.05
      }
      if (poison != null) {
        deaths = [...deaths, poison]
        this.emit({ witch: { ...this.state.witch, poisonUsed: true } })
        if (this.roleOf(poison) === 'werewolf') this.addKey(witchSeat, `毒中狼人（${WerewolfEngine.displaySeat(poison)} 号）`, 3)
      }
    }
    await this.sleep(NIGHT_STEP_MS * 0.6)
    return deaths
  }

  /** AI 女巫：首夜大概率救人；毒药留给高嫌疑目标 */
  private aiWitchDecision(witchSeat: number, day: number, kill: number | null): { save: boolean; poison: number | null } {
    const p = this.brainOf(witchSeat).params
    let save = false
    if (!this.state.witch.saveUsed && kill != null) {
      if (day === 1) save = true // 休闲局惯例：女巫首夜必救
      else save = this.state.seerClaimants.includes(kill) ? this.rng.chance(0.75) : this.rng.chance(0.25)
    }
    let poison: number | null = null
    if (!this.state.witch.poisonUsed) {
      const candidates = this.aliveSeats().filter((s) => s !== witchSeat)
      let best: number | null = null
      let bestScore = 0
      for (const c of candidates) {
        if (this.suspicion[c] > bestScore) {
          bestScore = this.suspicion[c]
          best = c
        }
      }
      const threshold = 0.5 - p.aggression * 0.1
      if (best != null && bestScore > threshold && this.rng.chance(0.35 + p.aggression * 0.45)) poison = best
    }
    return { save, poison }
  }

  /* ------------------------------------------------------------------ */
  /* 清晨死讯                                                            */
  /* ------------------------------------------------------------------ */
  private async dawn(day: number, deaths: number[]) {
    if (deaths.length > 0) {
      const seats = this.state.seats.map((s) => (deaths.includes(s.seat) ? { ...s, alive: false } : s))
      this.emit({ seats })
    }
    /* 死于夜里的「预言家」≈ 真预言家：其报出的狼目标嫌疑大增（死人不会说谎）；
       狼刀灭口：曾指控过死者的人嫌疑上升 */
    for (const d of deaths) {
      const reported = this.claimReports.get(d)
      if (reported != null && this.isAlive(reported)) this.addSuspicion(reported, 0.45)
      /* 对跳中死于夜里者≈真预言家：幸存的「预言家」狼面大 */
      if (this.claimReports.has(d)) {
        for (const c of this.state.seerClaimants) {
          if (c !== d && this.isAlive(c)) this.addSuspicion(c, 0.3)
        }
      }
      for (const acc of this.accusersOf.get(d) ?? []) {
        if (this.isAlive(acc)) this.addSuspicion(acc, 0.15)
      }
    }
    const text =
      deaths.length === 0
        ? '昨夜，平安夜。'
        : `昨夜，${deaths.map((d) => `${WerewolfEngine.displaySeat(d)} 号`).join('、')} 遇害。`
    this.emit({ phase: 'dawn', lastNightDeaths: deaths, dawnText: text, pendingVictim: null, killTarget: null, wolfSuggestion: null })
    this.pushSystem(`第 ${day} 天 · 清晨 —— ${text}`, 'dawn')
    await this.sleep(DAWN_MS)
  }

  /* ------------------------------------------------------------------ */
  /* 白天发言（顺序轮换）                                                 */
  /* ------------------------------------------------------------------ */
  private async daySpeech(day: number) {
    this.emit({ phase: 'daySpeech' })
    this.pushSystem(`第 ${day} 天 · 白日自由发言`, 'daySpeech')
    const alive = this.aliveSeats()
    const order = alive.map((_, i) => alive[(i + day - 1) % alive.length])
    this.emit({ speakerQueue: order })

    for (const seat of order) {
      if (this.stopped) return
      if (!this.isAlive(seat)) continue
      this.emit({ currentSpeaker: seat, speakerQueue: order.filter((s) => s !== seat) })
      const human = this.opts.humanSeat
      if (seat === human && !this.opts.isDelegated()) {
        const payload = await this.waitInput('speech', 45)
        if (this.stopped) return
        const text = payload?.type === 'speech' && payload.text.trim() ? payload.text.trim() : '过。'
        this.emit({ speeches: this.pushSpeech(seat, text, 'speech', 'daySpeech') })
        await this.sleep(this.typingMs(text))
      } else {
        const brain = this.brainOf(seat)
        await this.sleep(thinkMs(this.rng, brain.params) * 0.6)
        if (this.stopped) return
        const utter = this.chooseSpeech(seat, day)
        this.emit({ speeches: this.pushSpeech(seat, utter.text, 'speech', 'daySpeech') })
        this.applySpeechEffects(seat, utter)
        await this.sleep(this.typingMs(utter.text))
      }
    }
    this.emit({ currentSpeaker: null })
    /* 发言结束后：若全场只有一位预言家且无人对跳，其查验被暂时采信 */
    if (this.state.seerClaimants.length === 1) {
      const claimant = this.state.seerClaimants[0]
      const reported = this.claimReports.get(claimant)
      if (reported != null && this.isAlive(reported)) this.addSuspicion(reported, 0.24)
    }
  }

  private typingMs(text: string): number {
    return Math.min(4600, 1100 + text.length * 50)
  }

  /** 真人快捷模板的场外效果入口（页面提交快捷模板时顺带传 intent/target） */
  applyHumanSpeech(intent?: SpeechIntent, target?: number) {
    if (intent == null) return
    this.applySpeechEffects(this.opts.humanSeat, { intent, target })
  }

  private chooseSpeech(seat: number, day: number): { text: string; intent: SpeechIntent; target?: number } {
    const p = this.brainOf(seat).params
    const role = this.roleOf(seat)
    const others = this.aliveSeats().filter((s) => s !== seat)
    const disp = WerewolfEngine.displaySeat

    const topSuspectAmong = (pool: number[]): number => {
      let best = pool[0]
      let s = -Infinity
      for (const c of pool) {
        if (this.suspicion[c] > s) {
          s = this.suspicion[c]
          best = c
        }
      }
      return best
    }

    /* 自保：自身嫌疑偏高先表水 */
    if (this.suspicion[seat] > 0.62 && this.rng.chance(0.55)) {
      return { text: speak(p.style, 'biaoshui', { day }, this.rng), intent: 'biaoshui' }
    }

    if (role === 'werewolf') {
      const mate = this.wolves().find((w) => w !== seat)
      const mateAlive = mate != null && this.isAlive(mate)
      /* 互踩（倒钩）：队友必死时踩队友做高自己 */
      if (mateAlive && this.suspicion[mate] > 0.75 && this.rng.chance(p.deception * 0.7)) {
        return {
          text: speak(p.style, 'accuse', { day, t: disp(mate), tn: this.name(mate) }, this.rng),
          intent: 'accuse',
          target: mate,
        }
      }
      /* 互保 */
      if (mateAlive && this.suspicion[mate] > 0.55 && this.rng.chance(0.5)) {
        return {
          text: speak(p.style, 'defend', { day, t: disp(mate), tn: this.name(mate) }, this.rng),
          intent: 'defend',
          target: mate,
        }
      }
      /* 悍跳预言家（前两天，按欺骗倾向） */
      if (this.state.seerClaimants.length === 0 && day <= 2 && this.rng.chance(p.deception * 0.45)) {
        const goods = this.aliveGoods().filter((g) => g !== seat)
        const fakeTarget = this.rng.pick(goods)
        return {
          text: speak(p.style, 'seerClaim', { day, c: disp(fakeTarget), cn: this.name(fakeTarget), wolf: '狼人' }, this.rng),
          intent: 'seerClaim',
          target: fakeTarget,
        }
      }
      /* 双狼不同踩：队友今日已开踩，则收敛划水（避免共边暴露） */
      const mateAggro = mateAlive && this.dayAggressors.has(mate)
      /* 冲锋 / 带票 */
      const target = topSuspectAmong(this.aliveGoods().filter((g) => g !== seat))
      if (!mateAggro && this.rng.chance(p.aggression * 0.65)) {
        return { text: speak(p.style, 'accuse', { day, t: disp(target), tn: this.name(target) }, this.rng), intent: 'accuse', target }
      }
      if (!mateAggro && this.rng.chance(p.talk)) {
        return { text: speak(p.style, 'bandwagon', { day, t: disp(target), tn: this.name(target) }, this.rng), intent: 'bandwagon', target }
      }
      return { text: speak(p.style, 'pass', { day }, this.rng), intent: 'pass' }
    }

    if (role === 'seer' && seat !== this.opts.humanSeat) {
      /* 对跳：有人悍跳时拍案而起 */
      const fake = this.state.seerClaimants.find((c) => c !== seat)
      if (fake != null && !this.aiSeerClaimed) {
        this.aiSeerClaimed = true
        return { text: speak(p.style, 'seerCounter', { day, t: disp(fake), tn: this.name(fake) }, this.rng), intent: 'seerCounter', target: fake }
      }
      /* 报查验：验出狼即跳（信息必须上桌） */
      const found = this.aiSeerFoundWolf.shift()
      if (found != null) {
        this.aiSeerClaimed = true
        return {
          text: speak(p.style, 'seerClaim', { day, c: disp(found), cn: this.name(found), wolf: '狼人' }, this.rng),
          intent: 'seerClaim',
          target: found,
        }
      }
      /* 藏匿 */
      if (this.rng.chance(p.talk * 0.5)) {
        const target = topSuspectAmong(others)
        return { text: speak(p.style, 'accuse', { day, t: disp(target), tn: this.name(target) }, this.rng), intent: 'accuse', target }
      }
      return { text: speak(p.style, 'pass', { day }, this.rng), intent: 'pass' }
    }

    /* 女巫 / 平民：基于可信度评分发言（无凭据不先开火，避免带错节奏） */
    const target = topSuspectAmong(others)
    if (this.suspicion[target] > this.suspicion[seat] + 0.05 && this.rng.chance(p.talk * 0.75)) {
      return { text: speak(p.style, 'accuse', { day, t: disp(target), tn: this.name(target) }, this.rng), intent: 'accuse', target }
    }
    if (this.rng.chance(0.45)) {
      return { text: speak(p.style, 'biaoshui', { day }, this.rng), intent: 'biaoshui' }
    }
    return { text: speak(p.style, 'pass', { day }, this.rng), intent: 'pass' }
  }

  /** 发言的场外效果：嫌疑榜浮动 + 跳预言家登记 */
  private applySpeechEffects(speaker: number, utter: { intent: SpeechIntent; target?: number }) {
    const p = this.brainOf(speaker).params
    switch (utter.intent) {
      case 'accuse':
        if (utter.target != null) {
          /* 同一目标当日只计首踩（跟风指控不叠加证据），跟风者自曝共边 */
          const pile = this.dayAccuseCount.get(utter.target) ?? 0
          this.dayAccuseCount.set(utter.target, pile + 1)
          if (pile === 0) this.addSuspicion(utter.target, 0.07 * (0.7 + p.deception * 0.3))
          if (!this.firstAccuser.has(utter.target)) this.firstAccuser.set(utter.target, speaker)
          this.accusersOf.set(utter.target, [...(this.accusersOf.get(utter.target) ?? []), speaker])
          /* 攻击性行为本身引人侧目（首日归票先踩人者：带节奏比被踩更可疑） */
          this.addSuspicion(speaker, (pile >= 1 ? 0.11 : 0.08) + 0.03)
          this.dayAggressors.add(speaker)
        } else {
          this.addSuspicion(speaker, 0.045)
        }
        break
      case 'bandwagon':
        if (utter.target != null) {
          const pile = this.dayAccuseCount.get(utter.target) ?? 0
          this.dayAccuseCount.set(utter.target, pile + 1)
          this.addSuspicion(utter.target, 0.04)
          this.addSuspicion(speaker, 0.07 + 0.03)
          this.dayAggressors.add(speaker)
        }
        break
      case 'defend':
        if (utter.target != null) {
          this.addSuspicion(utter.target, -0.08)
          this.defenders.set(utter.target, [...(this.defenders.get(utter.target) ?? []), speaker])
        }
        break
      case 'seerClaim': {
        if (!this.state.seerClaimants.includes(speaker)) {
          this.emit({ seerClaimants: [...this.state.seerClaimants, speaker] })
        }
        if (utter.target != null) {
          this.addSuspicion(utter.target, 0.22)
          this.claimReports.set(speaker, utter.target)
        }
        this.addSuspicion(speaker, 0.05)
        break
      }
      case 'seerCounter': {
        if (!this.state.seerClaimants.includes(speaker)) {
          this.emit({ seerClaimants: [...this.state.seerClaimants, speaker] })
        }
        if (utter.target != null) this.addSuspicion(utter.target, 0.45)
        break
      }
      default:
        break
    }
  }

  /* ------------------------------------------------------------------ */
  /* 投票放逐                                                            */
  /* ------------------------------------------------------------------ */
  private async dayVote(day: number): Promise<number | null> {
    this.emit({ phase: 'dayVote', votes: {}, voteResult: null })
    this.pushSystem(`第 ${day} 天 · 放逐投票`, 'dayVote')
    const human = this.opts.humanSeat
    const votes: Record<number, number | null> = {}

    for (const seat of this.aliveSeats()) {
      if (seat === human && !this.opts.isDelegated()) continue
      votes[seat] = this.chooseVote(seat)
    }

    if (this.isAlive(human)) {
      if (this.opts.isDelegated()) {
        votes[human] = this.chooseVote(human)
      } else {
        const payload = await this.waitInput('vote', 30)
        if (this.stopped) return null
        votes[human] =
          payload?.type === 'vote' && payload.target != null && this.isAlive(payload.target) && payload.target !== human
            ? payload.target
            : null
      }
    }

    /* 开票 */
    const tally: Record<number, number> = {}
    for (const v of Object.values(votes)) {
      if (v != null) tally[v] = (tally[v] ?? 0) + 1
    }
    let exiled: number | null = null
    let tie = false
    const counts = Object.entries(tally).sort((a, b) => b[1] - a[1])
    if (counts.length > 0) {
      if (counts.length > 1 && counts[0][1] === counts[1][1]) tie = true
      else exiled = Number(counts[0][0])
    }

    const voteResult: VoteResult = { day, votes, tally, exiled, tie }
    this.emit({ phase: 'voteReveal', votes, voteResult })

    if (exiled != null) {
      const seats = this.state.seats.map((s) => (s.seat === exiled ? { ...s, alive: false } : s))
      this.emit({ seats })
      const exRole = this.roleOf(exiled)
      this.pushSystem(
        `${WerewolfEngine.displaySeat(exiled)} 号 ${this.name(exiled)} 被放逐，身份：${ROLE_META[exRole].name}`,
        'voteReveal',
      )
      /* MVP 记账 + 场外嫌疑修正 */
      if (exRole === 'werewolf') {
        for (const [voter, target] of Object.entries(votes)) {
          const v = Number(voter)
          if (target === exiled && this.roleOf(v) !== 'werewolf') this.addKey(v, `放逐狼人（${WerewolfEngine.displaySeat(exiled)} 号）`, 1)
        }
        const first = this.firstAccuser.get(exiled)
        if (first != null && this.roleOf(first) !== 'werewolf') this.addKey(first, '率先指狼', 1)
        /* 为被放逐狼辩护过的人，嫌疑上升 */
        for (const d of this.defenders.get(exiled) ?? []) {
          if (this.isAlive(d)) this.addSuspicion(d, 0.2)
        }
      } else {
        for (const w of this.aliveWolves()) this.addKey(w, '带票错杀好人', 1)
        /* 带头放逐了好人的人，嫌疑上升（带错节奏） */
        const first = this.firstAccuser.get(exiled)
        if (first != null && this.isAlive(first)) this.addSuspicion(first, 0.25)
      }
    } else {
      this.pushSystem(tie ? '平票 · 今日无人出局' : '无人被放逐', 'voteReveal')
    }

    await this.sleep(VOTE_REVEAL_MS)
    return exiled
  }

  /** 投票：好人投最高嫌疑；狼跟票好人，队友必死时按欺骗倾向倒钩 */
  private chooseVote(seat: number): number | null {
    const p = this.brainOf(seat).params
    const role = this.roleOf(seat)
    const poolAll = this.aliveSeats().filter((s) => s !== seat)
    if (poolAll.length === 0) return null

    /* AI 预言家：直接投票给已验出的狼 */
    if (role === 'seer' && seat !== this.opts.humanSeat) {
      const knownWolf = [...this.aiSeerKnowledge.entries()].filter(([t, w]) => w && this.isAlive(t)).map(([t]) => t)
      if (knownWolf.length > 0) return knownWolf[0]
    }

    /* 对跳预言家（2 人以上）首夜留给刀口验证：首日好人不在对跳里出；
       仅一人跳时采信其查验（见发言结束后的单边采信加成） */
    let pool = poolAll
    if (role !== 'werewolf' && this.state.day === 1 && this.state.seerClaimants.length >= 2) {
      const filtered = poolAll.filter((s) => !this.state.seerClaimants.includes(s))
      if (filtered.length > 0) pool = filtered
    }

    if (role === 'werewolf') {
      const mate = this.wolves().find((w) => w !== seat && this.isAlive(w))
      if (mate != null && this.suspicion[mate] > 0.72 && this.rng.chance(p.deception * 0.6)) return mate
      const goods = pool.filter((s) => this.roleOf(s) !== 'werewolf')
      if (goods.length === 0) return null
      /* 每只狼独立评估（含噪声）：有真线索时自然归票，无线索时票型分散 */
      let best = goods[0]
      let bestScore = -Infinity
      for (const g of goods) {
        const score = this.suspicion[g] + this.rng.gaussian() * 0.12
        if (score > bestScore) {
          bestScore = score
          best = g
        }
      }
      return best
    }

    /* 好人投票：softmax（温度 6）——倾向高嫌疑但不盲从 */
    const topSus = pool.reduce((a, b) => (this.suspicion[a] >= this.suspicion[b] ? a : b))
    /* 无硬信息时的归票位：首日归票「先踩人者」（好人票型需要聚焦点） */
    if (this.state.day <= 2 && this.suspicion[topSus] < 0.45 && this.dayAggressors.size > 0) {
      const focal = this.dayAggressors.values().next().value
      if (focal != null && focal !== seat && this.isAlive(focal) && this.rng.chance(0.88)) return focal
    }
    if (this.suspicion[topSus] < 0.3 && this.rng.chance(0.5)) return null
    if (this.rng.chance(p.noise * 0.25)) return this.rng.pick(pool)
    const weights = pool.map((c) => Math.exp(this.suspicion[c] * 6))
    const total = weights.reduce((a, b) => a + b, 0)
    let roll = this.rng.next() * total
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i]
      if (roll <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  /* ------------------------------------------------------------------ */
  /* 遗言                                                                */
  /* ------------------------------------------------------------------ */
  private async lastWords(seat: number) {
    this.emit({ phase: 'lastWords', lastWordsSeat: seat })
    const human = this.opts.humanSeat
    let text: string
    if (seat === human && !this.opts.isDelegated()) {
      const payload = await this.waitInput('lastWords', 20)
      if (this.stopped) return
      text = payload?.type === 'lastWords' && payload.text.trim() ? payload.text.trim() : '……保重。'
    } else {
      const p = this.brainOf(seat).params
      await this.sleep(thinkMs(this.rng, p) * 0.5)
      if (this.stopped) return
      text = speak(p.style, 'lastWords', { day: this.state.day }, this.rng)
    }
    this.emit({ speeches: this.pushSpeech(seat, text, 'speech', 'lastWords') })
    await this.sleep(Math.min(3600, 1400 + text.length * 50))
    this.emit({ lastWordsSeat: null })
  }

  /* ------------------------------------------------------------------ */
  /* 胜负与 MVP                                                          */
  /* ------------------------------------------------------------------ */
  private finishIfOver(): boolean {
    const wolves = this.aliveWolves().length
    const goods = this.aliveGoods().length
    if (wolves === 0) {
      this.finish('good')
      return true
    }
    if (wolves >= goods) {
      this.finish('wolf')
      return true
    }
    return false
  }

  private finish(winner: Camp) {
    /* MVP：胜方中关键行动最多者 */
    const winSeats = this.state.seats.filter((s) => (winner === 'wolf' ? s.role === 'werewolf' : s.role !== 'werewolf'))
    let mvp: number | null = null
    let best = -1
    for (const s of winSeats) {
      const score = this.mvpScore.get(s.seat) ?? 0
      if (score > best) {
        best = score
        mvp = s.seat
      }
    }
    const mvpNote = mvp != null ? this.mvpNoteFor(mvp) : ''
    const keyActions: Record<number, string[]> = {}
    for (const [k, v] of this.keyAct) keyActions[k] = v

    this.pushSystem(`终局 · ${winner === 'wolf' ? '狼人' : '好人'}阵营获胜`, 'finished')
    this.emit({ phase: 'finished', winner, mvpSeat: mvp, mvpNote, keyActions, awaiting: null, currentSpeaker: null })
  }

  private mvpNoteFor(seat: number): string {
    const name = this.name(seat)
    switch (this.roleOf(seat)) {
      case 'werewolf':
        return `「${name}刀刀见血，夜夜诛心。」`
      case 'seer':
        return `「${name}天目所至，狼无所遁。」`
      case 'witch':
        return `「${name}一剂断肠，狼魂归夜。」`
      default:
        return `「${name}慧眼带票，手刃恶狼。」`
    }
  }
}

/**
 * ============================================================================
 * 分布式智能体决策引擎（src/engine/agents.ts）
 * ----------------------------------------------------------------------------
 * 每位 AI 影从是一个独立「智能体」：其决策参数完全由 src/data/echoes.ts 的
 * 人设字段（persona / suit / winRate）派生——
 *   · aggression  攻击性（悍跳/带票/下毒倾向）
 *   · deception   欺骗倾向（悍跳预言家、倒钩、隐藏信息）
 *   · levelK      思考层级（level-k 推理深度，0≈随机 50，每层 ×2/3）
 *   · noise       决策噪声（偏离最优的幅度）
 *   · talk        发言欲望（模板选择倾向）
 *   · style       发言风格 archetype（speech.ts 按它选模板池）
 *
 * 所有决策均为异步函数，带 0.8–2.2s 模拟思考延迟，保证牌桌节奏感。
 *
 * 【未来接入真实 LLM】
 * 本模块末尾预留 `LLMAgentAdapter` 适配层：把 `AgentBrain` 接口的实现从
 * `HeuristicBrain`（本文件，模板+启发式）换成调用远端 LLM 的实现即可，
 * 上层引擎（guessEngine / werewolfEngine）只依赖 AgentBrain 接口，无需改动。
 * ============================================================================
 */
import type { Echo } from '@/data/echoes'
import type { Rng } from './rng'

/* ---------------------------------------------------------------------------
 * 决策参数
 * ------------------------------------------------------------------------- */

/** 发言风格 archetype：深算 / 欺诈 / 直觉 / 沉默 / 计算 / 温和 / 市侩 / 情报 */
export type SpeechStyle =
  | 'deep'      // 白泽：冷静推演，句短而准
  | 'deceit'    // 讹兽：满嘴跑火车，悍跳成性
  | 'intuition' // 阿九：凭心跳断案
  | 'silent'    // 守拙：惜字如金
  | 'calc'      // 璇玑：概率与数据挂嘴边
  | 'warm'      // 青囊：温柔带刀
  | 'merchant'  // 烛阴：一切皆是生意
  | 'info'      // 百晓生：贩卖线索

export interface AgentParams {
  aggression: number
  deception: number
  levelK: number
  noise: number
  talk: number
  style: SpeechStyle
}

/** 人设 → 参数映射表（按 echoes.ts 的 persona 字段驱动） */
const PERSONA_TABLE: Record<string, AgentParams> = {
  深算: { aggression: 0.45, deception: 0.50, levelK: 3.2, noise: 0.06, talk: 0.70, style: 'deep' },
  悍跳: { aggression: 0.85, deception: 0.95, levelK: 2.0, noise: 0.12, talk: 0.90, style: 'deceit' },
  计算: { aggression: 0.50, deception: 0.20, levelK: 3.6, noise: 0.04, talk: 0.80, style: 'calc' },
  谈判: { aggression: 0.40, deception: 0.55, levelK: 2.4, noise: 0.08, talk: 0.95, style: 'warm' },
  资源: { aggression: 0.60, deception: 0.40, levelK: 2.6, noise: 0.07, talk: 0.60, style: 'merchant' },
  直觉: { aggression: 0.65, deception: 0.60, levelK: 2.2, noise: 0.15, talk: 0.85, style: 'intuition' },
  保守: { aggression: 0.20, deception: 0.15, levelK: 1.6, noise: 0.05, talk: 0.35, style: 'silent' },
  情报: { aggression: 0.55, deception: 0.70, levelK: 2.8, noise: 0.08, talk: 0.90, style: 'info' },
}

/** 由影从人设派生决策参数（未知人设回落到均衡默认） */
export function deriveAgentParams(echo: Echo): AgentParams {
  const base = PERSONA_TABLE[echo.persona]
  if (base) return { ...base }
  return { aggression: 0.5, deception: 0.4, levelK: 2.2, noise: 0.1, talk: 0.6, style: 'deep' }
}

/* ---------------------------------------------------------------------------
 * 思考延迟（0.8–2.2s）：层级越高思考越久（深算），噪声越大决定越快（直觉）。
 * ------------------------------------------------------------------------- */
export const THINK_MIN_MS = 800
export const THINK_MAX_MS = 2200

export function thinkMs(rng: Rng, params?: AgentParams): number {
  const t = rng.range(THINK_MIN_MS, THINK_MAX_MS)
  if (!params) return t
  const bias = (params.levelK / 4 - params.noise) * 300
  return Math.max(THINK_MIN_MS, Math.min(THINK_MAX_MS, t + bias))
}

export function thinkDelay(rng: Rng, params?: AgentParams): Promise<number> {
  const ms = thinkMs(rng, params)
  return new Promise((resolve) => setTimeout(() => resolve(ms), ms))
}

/* ---------------------------------------------------------------------------
 * 猜平均数决策：level-k 推理 + 人设噪声 + 历史自适应
 * ------------------------------------------------------------------------- */

/** 一轮的历史摘要（引擎传入，用于自适应调层） */
export interface GuessHistorySummary {
  /** 该轮全员均值 */
  average: number
  /** 该轮目标值（均值 × 2/3） */
  target: number
  /** 其他玩家提交值的均值（不含自己） */
  othersMean: number
}

export const LEVEL_K_BASE = 50
export const LEVEL_K_FACTOR = 2 / 3

/** level-k 锚点：层级 k 的出数 = 50 × (2/3)^k（k 可为小数，连续插值） */
export function levelKAnchor(k: number): number {
  return LEVEL_K_BASE * Math.pow(LEVEL_K_FACTOR, k)
}

/**
 * AI 出数决策。
 * 1) 锚点 = levelKAnchor(params.levelK)，并根据上轮目标值微调 ±0.4 层；
 * 2) 自适应：根据历史轮「他人均值」做最优响应（他人均值 × 2/3），
 *    轮次越深、层级越高，自适应权重越大；
 * 3) 叠加人设噪声（高斯，幅度 ∝ params.noise）。
 */
export function decideGuessNumber(
  params: AgentParams,
  history: readonly GuessHistorySummary[],
  rng: Rng,
): number {
  let k = params.levelK
  if (history.length > 0) {
    const last = history[history.length - 1]
    const myAnchor = levelKAnchor(k)
    if (last.target < myAnchor) k += rng.range(0.1, 0.4)
    else k -= rng.range(0.05, 0.25)
    k = Math.max(0, Math.min(4.2, k))
  }
  const anchor = levelKAnchor(k)

  let value = anchor
  if (history.length > 0) {
    // 对「他人下一轮均值」的预测：近期他人均值的指数滑动平均
    let wSum = 0
    let pred = 0
    for (let i = 0; i < history.length; i++) {
      const w = Math.pow(0.7, history.length - 1 - i)
      wSum += w
      pred += history[i].othersMean * w
    }
    pred /= wSum
    const bestResponse = pred * LEVEL_K_FACTOR
    const adaptW = Math.min(0.65, 0.16 * history.length) * (0.4 + params.levelK / 4)
    value = anchor * (1 - adaptW) + bestResponse * adaptW
  }

  value += rng.gaussian() * params.noise * 18
  return clampGuess(value)
}

/** 合法化出数：0–100，保留 1 位小数 */
export function clampGuess(v: number): number {
  const c = Math.max(0, Math.min(100, v))
  return Math.round(c * 10) / 10
}

/* ---------------------------------------------------------------------------
 * AgentBrain 接口 + 启发式实现 + LLM 适配层占位
 * ------------------------------------------------------------------------- */

/**
 * 智能体「大脑」接口：两个对局引擎只依赖此接口。
 * 当前默认实现 = HeuristicBrain（本文件 + speech.ts 的模板池）。
 * 未来接入真实 LLM 时：实现同名方法、在 LLMAgentAdapter 中注入即可无缝替换。
 */
export interface AgentBrain {
  readonly echoId: string
  readonly params: AgentParams
  /** 模拟思考延迟（0.8–2.2s） */
  think(rng: Rng): Promise<number>
  /** 猜平均数出数 */
  pickGuessNumber(history: readonly GuessHistorySummary[], rng: Rng): number
}

/** 默认启发式大脑 */
export class HeuristicBrain implements AgentBrain {
  readonly echoId: string
  readonly params: AgentParams

  constructor(echo: Echo) {
    this.echoId = echo.id
    this.params = deriveAgentParams(echo)
  }

  think(rng: Rng): Promise<number> {
    return thinkDelay(rng, this.params)
  }

  pickGuessNumber(history: readonly GuessHistorySummary[], rng: Rng): number {
    return decideGuessNumber(this.params, history, rng)
  }
}

/**
 * 【占位 · 未来接入真实 LLM】
 * LLMAgentAdapter：把 AgentBrain 的决策委托给远端大模型。
 * 接入步骤（将来）：
 *   1. 在 `endpoint` 配置模型服务地址（建议走后端代理，避免密钥前端暴露）。
 *   2. `think()` 改为真实请求计时的自然延迟（可保留 0.8s 下限兜底节奏）。
 *   3. `pickGuessNumber` 等决策方法：构造带人设 system prompt + 场上信息的
 *      user prompt → 解析模型输出 → 回落到 HeuristicBrain（解析失败/超时）。
 *   4. 引擎层无需任何改动：
 *      new GuessEngine({ brainFactory: (echo) => new LLMAgentAdapter(echo, cfg), ... })。
 */
export class LLMAgentAdapter implements AgentBrain {
  readonly echoId: string
  readonly params: AgentParams
  private fallback: HeuristicBrain
  /** 未来：模型服务端点（走后端代理） */
  readonly endpoint: string | null = null

  constructor(echo: Echo, endpoint?: string) {
    this.echoId = echo.id
    this.params = deriveAgentParams(echo)
    this.fallback = new HeuristicBrain(echo)
    this.endpoint = endpoint ?? null
  }

  /** 占位：当前仍走启发式 + 模拟延迟；接入 LLM 后此处为真实调用 */
  async think(rng: Rng): Promise<number> {
    // TODO(LLM): if (this.endpoint) { 发起请求并返回真实耗时 }
    return this.fallback.think(rng)
  }

  /** 占位：解析失败/未配置时回落启发式 */
  pickGuessNumber(history: readonly GuessHistorySummary[], rng: Rng): number {
    // TODO(LLM): prompt = buildGuessPrompt(this.params, history) → parse
    return this.fallback.pickGuessNumber(history, rng)
  }
}

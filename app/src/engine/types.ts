/**
 * ============================================================================
 * 《十日牌局》对局引擎 · 共享类型（src/engine/types.ts）
 * ----------------------------------------------------------------------------
 * 纯 TS，无 React 依赖。两个对局引擎（guessEngine / werewolfEngine）共用。
 * Suit 直接复用 @/data/echoes 的定义（♠♥♣♦ 四花色）。
 * ============================================================================
 */
import type { Suit } from '@/data/echoes'

export type { Suit }

/** 座位玩家类型：真人 / AI 影从 */
export type PlayerKind = 'human' | 'echo'

/**
 * 座位。seat 为 0–5 的逻辑座号；0 号恒为真人玩家（展示为「1 号位」，
 * 渲染时固定在椭圆桌 6 点位 / 底部）。
 */
export interface Seat {
  /** 逻辑座号 0–5 */
  seat: number
  kind: PlayerKind
  /** 展示名（真人=昵称，AI=影从名） */
  name: string
  /** AI 座位的影从 id（对应 src/data/echoes.ts） */
  echoId?: string
}

/**
 * 对局大阶段（两游戏并集；各引擎内部使用其子集）。
 * - waiting   等待室（影从补满落座）
 * - countdown 开局 3-2-1
 * - deal      狼人杀身份发放（翻牌演出）
 * - submit    猜平均数·出数阶段
 * - reveal    猜平均数·浑天仪均值揭示
 * - nightWolf / nightSeer / nightWitch  夜晚三段
 * - dawn      清晨死讯
 * - daySpeech 白天逐人发言
 * - dayVote / voteReveal 投票放逐 / 开票
 * - lastWords 遗言
 * - finished  终局（结算演出）
 */
export type GamePhase =
  | 'waiting'
  | 'countdown'
  | 'deal'
  | 'submit'
  | 'reveal'
  | 'nightWolf'
  | 'nightSeer'
  | 'nightWitch'
  | 'dawn'
  | 'daySpeech'
  | 'dayVote'
  | 'voteReveal'
  | 'lastWords'
  | 'finished'

/** 记录流条目（右栏系统消息） */
export interface LogItem {
  id: number
  text: string
  kind: 'system' | 'action' | 'result'
}

/** 引擎等待真人输入的描述（页面据此渲染操作带与 TimerRing） */
export interface AwaitingInput {
  /** 输入类型 */
  kind:
    | 'guessNumber'   // 猜平均数：提交数字
    | 'wolfKill'      // 狼人：落刀目标
    | 'seerCheck'     // 预言家：验人目标
    | 'witchAction'   // 女巫：救/毒决策
    | 'speech'        // 白天发言
    | 'vote'          // 放逐投票
    | 'lastWords'     // 遗言
  /** 输入者座位 */
  seat: number
  /** 超时秒数（到时引擎应用兜底策略） */
  timeoutSec: number
  /** 输入开始时间戳（页面渲染 TimerRing） */
  startedAt: number
}

/** 引擎通用事件订阅句柄 */
export type EngineListener = () => void

/**
 * ============================================================================
 * Jev 驱动的 AI 裁判（api/world/jevJudge.ts）
 * ----------------------------------------------------------------------------
 * J1「明镜」的真实实现：把条款正文与质询主张交给 Jev，由它裁断。
 *
 * 【三问一包】每位裁判的判断打包成一次 Jev 调用：
 *   supported  noul   原文是否支持该主张（是否确有含混）
 *   strength   score  主张的论据强度 0–2
 *   verdict    choice 采纳 / 驳回 / 部分成立
 * 一次请求拿全，而不是三次往返——这是 Jev 的用法要点。
 *
 * 【降级】Jev 不可用时回落 judges.ts 的 heuristicVote，机制不中断。
 * 黑客松现场网络不可靠，这条降级路径必须存在且被测试覆盖。
 *
 * 【Jev 不写理由】它不生成文本，故裁决理由由本地按其判定与概率生成模板句。
 * 这个分工是刻意的：结论可审计，理由可追溯，两者都不靠自由生成。
 * ============================================================================
 */
import {
  findClause,
  type Judge,
  type JudgeVote,
  type RuleBook,
} from "@contracts/rulebook";
import { heuristicVote } from "./judges";
import {
  askJev,
  asChoice,
  asNoul,
  asScore,
  jevEnabled,
  JevUnavailableError,
  type JevQuestion,
} from "./jev";

/** 采纳所需的最低支持度——低于此值即便 choice 选了采纳也不作数 */
const SUPPORT_THRESHOLD = 0.6;

/** 一次 Jev 裁判的完整结果（含可观测指标，演示时展示） */
export interface JevJudgeResult {
  vote: JudgeVote;
  /** 是否真由 Jev 判定（false = 已降级到启发式） */
  byJev: boolean;
  /** Jev 端到端耗时，降级时为 null */
  elapsedMs: number | null;
  /** 原文支持度 0–1 */
  support: number | null;
  /** 论据强度 0–2 */
  strength: number | null;
  model: string | null;
}

/** 构造裁判用的三个问题 */
function judgeQuestions(clauseTitle: string): Record<string, JevQuestion> {
  return {
    supported: {
      type: "noul",
      instructions: `条款《${clauseTitle}》的原文对质询者所述情形确实存在含混或未穷尽之处`,
    },
    strength: {
      type: "score",
      instructions: "质询主张的论据强度",
      criteria: [
        "空泛不服，未指出条款的具体缺口",
        "指出了情形，但未说明条款为何不足",
        "明确指出条款未涵盖的具体情形，论据充分",
      ],
    },
    verdict: {
      type: "choice",
      instructions: "对该规则质询应当如何裁断",
      criteria: {
        uphold: "采纳：条款确有含混，应当另立判例补其阙",
        reject: "驳回：条款原文已足以涵盖此情形",
        partial: "部分成立：情形属实但不足以另立判例",
      },
    },
  };
}

/**
 * 单席 Jev 裁判投票。Jev 不可用或出错时自动降级，绝不抛错——
 * 裁判团必须凑满法定人数，一席失败不能让整场裁决中断。
 */
export async function jevVote(params: {
  judge: Judge;
  book: RuleBook;
  clauseId: string;
  assertion: string;
  seed: string;
}): Promise<JevJudgeResult> {
  const { judge, book, clauseId, assertion, seed } = params;
  const clause = findClause(book, clauseId);

  const fallback = (): JevJudgeResult => ({
    vote: heuristicVote({ judge, book, clauseId, assertion, seed }),
    byJev: false,
    elapsedMs: null,
    support: null,
    strength: null,
    model: null,
  });

  if (!clause || !jevEnabled()) return fallback();

  // state 只含客观素材：条款正文 + 主张原文。不放入裁判人设，
  // 否则同一主张会因裁判不同得到不同判定，裁决就不可复现了。
  const state = [
    `【规则书】${book.name}（版本 ${book.version}）`,
    `【被质询条款】《${clause.title}》（${clause.category}）`,
    `条款原文：${clause.text}`,
    `【质询主张】${assertion}`,
  ].join("\n");

  try {
    const res = await askJev({ state, questions: judgeQuestions(clause.title) });

    const support = asNoul(res.answers.supported);
    const strength = asScore(res.answers.strength);
    const verdict = asChoice(res.answers.verdict);

    // 采纳需两个条件同时满足：选了 uphold 且支持度过阈值。
    // 单看 choice 会让「勉强采纳」也计入，判例就不值钱了。
    const upheld =
      verdict?.choice === "uphold" && (support ?? 0) >= SUPPORT_THRESHOLD;

    const reason = buildReason({
      clauseTitle: clause.title,
      upheld,
      verdictChoice: verdict?.choice ?? null,
      support,
      strength: strength?.score ?? null,
    });

    return {
      vote: { judgeIndex: judge.index, upheld, reason },
      byJev: true,
      elapsedMs: res.elapsedMs,
      support,
      strength: strength?.score ?? null,
      model: res.model,
    };
  } catch (e) {
    if (e instanceof JevUnavailableError) return fallback();
    throw e;
  }
}

/**
 * 裁决理由的本地模板生成。
 *
 * Jev 只给判定与概率，不给文本。理由在此按其输出组装——
 * 这样每句理由都能回溯到一个具体的数值，而不是模型的自由发挥。
 */
function buildReason(params: {
  clauseTitle: string;
  upheld: boolean;
  verdictChoice: string | null;
  support: number | null;
  strength: number | null;
}): string {
  const { clauseTitle, upheld, verdictChoice, support, strength } = params;
  const pct = support !== null ? `${Math.round(support * 100)}%` : "未测";

  if (upheld) {
    const weight =
      strength !== null && strength >= 1.5 ? "论据充分" : "论据尚可";
    return `《${clauseTitle}》就此情形确有含混（支持度 ${pct}，${weight}），主张成立。`;
  }

  if (verdictChoice === "partial") {
    return `《${clauseTitle}》所述情形属实，然不足以另立判例（支持度 ${pct}）。`;
  }

  if (verdictChoice === "uphold") {
    return `《${clauseTitle}》虽有可议，然支持度仅 ${pct}，未达立例之准。`;
  }

  return `《${clauseTitle}》原文已足以涵盖此情形（支持度 ${pct}），主张驳回。`;
}

/* ------------------------------------------------------------------ */
/* 狼人杀发言分析：Jev 的第二个用场                                      */
/* ------------------------------------------------------------------ */

/**
 * 发言可信度分析。这是现有模板引擎做不到的事——
 * 模板能生成发言，但无法判断「这段话是否自相矛盾」。
 *
 * 用途有二：
 *   1. 给真人玩家的辅助提示（可开关，默认关，否则削弱推理乐趣）
 *   2. 给 echo-bot 的决策输入，让 AI 的投票有真实依据而非随机
 */
export interface SpeechAnalysis {
  /** 自相矛盾概率 */
  contradiction: number;
  /** 行为风格归类 */
  style: "hantiao" | "chongfeng" | "huashui" | "daogou" | "unknown";
  styleConfidence: number;
  /** 信息量 0–2 */
  informativeness: number;
  elapsedMs: number;
  model: string;
}

export const SPEECH_STYLE_LABEL: Record<SpeechAnalysis["style"], string> = {
  hantiao: "悍跳",
  chongfeng: "冲锋",
  huashui: "划水",
  daogou: "倒钩",
  unknown: "未明",
};

/**
 * 分析一段狼人杀发言。Jev 不可用时返回 null——调用方应据此隐藏分析面板，
 * 而不是显示一个假数值。
 */
export async function analyzeSpeech(params: {
  /** 该玩家本局的历史发言（供判断前后矛盾） */
  history: string[];
  /** 本次发言 */
  speech: string;
  /** 场上公开信息摘要（死讯、票型等） */
  publicContext: string;
}): Promise<SpeechAnalysis | null> {
  if (!jevEnabled()) return null;

  const state = [
    `【场上公开信息】${params.publicContext}`,
    params.history.length
      ? `【该玩家此前发言】\n${params.history.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
      : "【该玩家此前发言】无",
    `【本次发言】${params.speech}`,
  ].join("\n");

  try {
    const res = await askJev({
      state,
      questions: {
        contradiction: {
          type: "noul",
          instructions: "该玩家的发言与其此前发言或场上公开信息存在矛盾",
        },
        style: {
          type: "choice",
          instructions: "该发言最接近哪种狼人杀行为风格",
          criteria: {
            hantiao: "悍跳：假冒神职身份抢夺话语权",
            chongfeng: "冲锋：激进指认他人出局",
            huashui: "划水：发言无实质信息，回避表态",
            daogou: "倒钩：表面中立实则为某人洗白",
          },
        },
        informativeness: {
          type: "score",
          instructions: "该发言为场上提供的有效推理信息量",
          criteria: [
            "无信息，纯表态或复述",
            "有部分信息，但含糊",
            "信息明确，给出可验证的判断依据",
          ],
        },
      },
    });

    const style = asChoice(res.answers.style);
    const validStyles = ["hantiao", "chongfeng", "huashui", "daogou"] as const;
    const styleKey = validStyles.find(s => s === style?.choice) ?? "unknown";

    return {
      contradiction: asNoul(res.answers.contradiction) ?? 0,
      style: styleKey,
      styleConfidence: style?.confidence ?? 0,
      informativeness: asScore(res.answers.informativeness)?.score ?? 0,
      elapsedMs: res.elapsedMs,
      model: res.model,
    };
  } catch (e) {
    if (e instanceof JevUnavailableError) return null;
    throw e;
  }
}

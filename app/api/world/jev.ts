/**
 * ============================================================================
 * Jev 决策模型客户端（api/world/jev.ts）
 * ----------------------------------------------------------------------------
 * TypeSafe AI 的 Jev 是「系统一」决策模型：不生成文本，只输出带概率的
 * 结构化判定。这恰好是裁判需要的能力——裁判要的是裁断，不是作文。
 *
 * 三种输出原语与本项目的对应：
 *   noul   是/否 + 概率  → 质询是否成立、发言是否矛盾、是否串通
 *   choice 从候选中择一  → 发言风格归类、工具路由、意图识别
 *   score  数值评分      → 主张的论据强度、发言可信度
 *
 * 【为什么不用通用大模型做裁判】
 * 三个工程理由，而非偏好：
 *   1. 延迟：裁决发生在对局中途，全场等待。Jev 70–500ms，LLM 数秒。
 *   2. 格式确定性：Jev 的输出锁定在预定义 schema 内，不会跑出选项之外；
 *      LLM 需要额外的解析与重试逻辑。
 *   3. 成本：单次判定约 0.0004 美元，可以在每次发言后都跑一遍。
 *
 * 【边界】Jev 不能解释理由。因此裁决摘要（判例卡正文）仍由本地模板生成，
 * Jev 只提供裁断与概率。这个分工是刻意的：可审计的结论 + 可追溯的证据。
 *
 * 【降级策略】无 API Key 或调用失败时回落到 judges.ts 的启发式判定。
 * 黑客松现场网络不可靠，机制必须在离线时也能完整演示。
 * ============================================================================
 */

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";

/** 单次调用超时：裁决在对局中途发生，不能让全场无限等待 */
const JEV_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/* 请求与响应类型（对齐 docs.typesafe.ai/introduction/quickstart）      */
/* ------------------------------------------------------------------ */

export interface NoulQuestion {
  type: "noul";
  instructions: string;
}

export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  /** 选项名 → 选项描述 */
  criteria: Record<string, string>;
}

export interface ScoreQuestion {
  type: "score";
  instructions: string;
  /** 各档描述，数组下标即分值 */
  criteria: string[];
}

export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface NoulAnswer {
  type: "noul";
  /** 0–1 概率，>0.5 视为「是」 */
  noul: number;
}

export interface ChoiceAnswer {
  type: "choice";
  /** 选中的选项名 */
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
}

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface JevResult {
  /** 解析出的实际版本，如 'jev-1.13.0'（落日志便于复现） */
  model: string;
  answers: Record<string, JevAnswer>;
  usage: { input_tokens: number; output_tokens: number };
  /** 端到端耗时（毫秒），用于演示时展示「快判断」 */
  elapsedMs: number;
}

/* ------------------------------------------------------------------ */
/* 客户端                                                              */
/* ------------------------------------------------------------------ */

export class JevUnavailableError extends Error {}

/** Key 只从环境变量读取，绝不写入代码或数据库 */
function apiKey(): string | null {
  return process.env.TYPESAFE_API_KEY?.trim() || null;
}

/** Jev 是否可用（无 Key 时调用方应降级到启发式判定） */
export function jevEnabled(): boolean {
  return apiKey() !== null;
}

/**
 * 一次调用可携带多个问题，并行返回——务必把同一场景的所有判断打包进
 * 一次请求，而不是循环单问。这是 Jev 的核心优势，也是延迟的主要来源。
 */
export async function askJev(params: {
  state: string;
  questions: Record<string, JevQuestion>;
}): Promise<JevResult> {
  const key = apiKey();
  if (!key) {
    throw new JevUnavailableError("未配置 TYPESAFE_API_KEY");
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);

  try {
    const res = await fetch(JEV_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        state: params.state,
        model: JEV_MODEL,
        questions: params.questions,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new JevUnavailableError(
        `Jev 返回 ${res.status}${detail ? `：${detail.slice(0, 200)}` : ""}`,
      );
    }

    const body = (await res.json()) as Omit<JevResult, "elapsedMs">;
    return { ...body, elapsedMs: Date.now() - started };
  } catch (e) {
    if (e instanceof JevUnavailableError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new JevUnavailableError(`Jev 超时（>${JEV_TIMEOUT_MS}ms）`);
    }
    throw new JevUnavailableError(
      `Jev 调用失败：${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* 取值助手（收窄联合类型，避免调用方到处写类型断言）                     */
/* ------------------------------------------------------------------ */

export function asNoul(a: JevAnswer | undefined): number | null {
  return a?.type === "noul" ? a.noul : null;
}

export function asChoice(
  a: JevAnswer | undefined,
): { choice: string; confidence: number } | null {
  return a?.type === "choice"
    ? { choice: a.choice, confidence: a.confidence }
    : null;
}

export function asScore(
  a: JevAnswer | undefined,
): { score: number; confidence: number } | null {
  return a?.type === "score"
    ? { score: a.score, confidence: a.confidence }
    : null;
}

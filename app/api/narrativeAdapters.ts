import {
  asChoice,
  asScore,
  askJev,
  jevEnabled,
} from "./world/jev";
import {
  buildFallbackTacticalDigest,
  type JEVAdapter,
  type NarrativeAdapter,
} from "./narrativePipeline";
import {
  narrativeReportSchema,
  type NarrativeReport,
  type TacticalDigest,
} from "../contracts/aiNativeWorld";
import type { MatchEvent } from "../contracts/matchLog";
import type { WorldEventRef } from "../contracts/aiNativeWorld";

type ModelNarrativePayload = {
  title: string;
  body: string;
  claims?: Array<{
    text: string;
    kind: "fact" | "inference";
    evidenceSeqs: number[];
  }>;
};

function publicState(input: {
  events: readonly MatchEvent[];
  eventRefs: readonly WorldEventRef[];
  world: WorldEventRef;
}): string {
  return JSON.stringify({
    world: input.world,
    events: input.events,
    eventRefs: input.eventRefs,
  });
}

function evidenceSeqs(input: { eventRefs: readonly WorldEventRef[] }): number[] {
  const actions = input.eventRefs
    .filter(ref => ref.eventType === "action" || ref.eventType === "speech" || ref.eventType === "tactic")
    .map(ref => ref.eventSeq);
  return actions.length > 0 ? actions : [input.eventRefs[0]?.eventSeq ?? 0];
}

/**
 * 把现有 Jev「结构化判断」接到 AI 原生战报的 TacticalDigest 契约。
 * Jev 只负责给公开事件打标签和评分；事实列表仍由确定性摘要生成，
 * 因此即使模型返回异常，也只会丢弃这次模型增强，不会污染事实账本。
 */
export function createJevTacticalDigestAdapter(): JEVAdapter {
  return {
    async summarize(input) {
      const fallback = buildFallbackTacticalDigest({
        events: input.events,
        eventRefs: input.eventRefs,
        world: input.world,
        digestId: input.digestId,
        idempotencyKey: input.idempotencyKey,
        mode: "agent-v-agent",
        matchId: Number(input.world.matchId) || null,
      });
      const state = publicState(input);
      const result = await askJev({
        state,
        questions: {
          tactical_style: {
            type: "choice",
            instructions: "只根据公开事件，把本局主要交锋节奏归类为一个标签。不能推断隐藏身份。",
            criteria: {
              pressure: "连续施压、迫使对手暴露选择",
              probe: "用低风险动作试探信息",
              patience: "延迟承诺，等待对手先行动",
              disruption: "通过改变节奏或盘外招打断既有预期",
            },
          },
          tactical_confidence: {
            type: "score",
            instructions: "评估公开事件是否足以支持战术节奏判断。只能使用公开证据。",
            criteria: ["证据很少", "证据有限", "证据一般", "证据充分", "证据很充分"],
          },
        },
      });
      const refs = evidenceSeqs(input);
      const style = asChoice(result.answers.tactical_style);
      const confidence = asScore(result.answers.tactical_confidence);
      const inferences = [...fallback.inferences];
      const labels = [...fallback.strategyLabels];
      if (style) {
        labels.push(`jev:${style.choice}`);
        inferences.push({
          text: `JEV 将公开对局节奏归类为“${style.choice}”，模型置信度 ${Math.round(style.confidence * 100)}%。`,
          evidenceSeqs: refs,
        });
      }
      if (confidence) {
        inferences.push({
          text: `JEV 对公开证据充分度评分为 ${confidence.score}，置信度 ${Math.round(confidence.confidence * 100)}%。`,
          evidenceSeqs: refs,
        });
      }
      return {
        ...fallback,
        inferences,
        strategyLabels: [...new Set(labels)].slice(0, 32),
        uncertainty: fallback.uncertainty.filter(item => !item.includes("策略摘要")),
      } satisfies TacticalDigest;
    },
  };
}

function narrativeApiConfig(): { url: string; key: string; model: string } | null {
  const key = process.env.TDG_NARRATIVE_API_KEY?.trim();
  const url = process.env.TDG_NARRATIVE_API_URL?.trim();
  if (!key || !url) return null;
  return {
    key,
    url,
    model: process.env.TDG_NARRATIVE_MODEL?.trim() || "deepseek-chat",
  };
}

function parseModelContent(content: string): ModelNarrativePayload {
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(normalized) as ModelNarrativePayload;
}

/**
 * 可选的 OpenAI-compatible 叙事适配器（例如 DeepSeek）。模型只返回标题、
 * 正文和证据序号；世界引用、stateHash、权限和 claim 引用由服务端补齐，
 * 并再次经过 narrativeReportSchema 校验。没有配置时不发起任何外部请求。
 */
export function createConfiguredNarrativeAdapter(): NarrativeAdapter | undefined {
  const config = narrativeApiConfig();
  if (!config) return undefined;
  return {
    async generate({ digest, plan }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(config.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.7,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "你是终焉世界的战报编剧。只写基于证据的原创战报，不模仿任何具体作家或作品，不泄露思维链。所有事实句必须在 claims 中绑定 evidenceSeqs；无法证明的心理活动只能标记 inference。",
              },
              {
                role: "user",
                content: JSON.stringify({
                  output: "只返回 JSON：{title,body,claims:[{text,kind:'fact'|'inference',evidenceSeqs:number[]}]}。",
                  digest,
                  plan,
                }),
              },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`叙事模型返回 ${response.status}`);
        }
        const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error("叙事模型没有返回内容");
        const payload = parseModelContent(content);
        const refsBySeq = new Map(digest.eventRefs.map(ref => [ref.eventSeq, ref]));
        const claims = (payload.claims?.length ? payload.claims : digest.facts.map(fact => ({
          text: fact.text,
          kind: "fact" as const,
          evidenceSeqs: fact.evidenceSeqs,
        }))).map(claim => {
          const evidence = claim.evidenceSeqs.map(seq => refsBySeq.get(seq));
          if (evidence.some(ref => !ref)) throw new Error("叙事模型引用了未授权证据");
          return {
            text: claim.text,
            kind: claim.kind,
            evidence: evidence.filter((ref): ref is WorldEventRef => Boolean(ref)),
            evidenceSeqs: [...claim.evidenceSeqs],
          };
        });
        const anchor = digest.eventRefs.at(-1) ?? digest.world;
        return narrativeReportSchema.parse({
          contractVersion: "1.0.0",
          reportId: `report:${digest.digestId}`,
          idempotencyKey: plan.idempotencyKey,
          world: digest.world,
          planId: plan.planId,
          title: payload.title,
          body: payload.body,
          claims,
          eventRefs: digest.eventRefs,
          stateHash: anchor.stateHash,
          eventSeq: anchor.eventSeq,
          rulebookVersion: anchor.rulebookVersion,
          projectionVersion: plan.projectionVersion,
          visibility: anchor.visibility,
        }) as NarrativeReport;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createConfiguredNarrativeAdapters(): {
  jev?: JEVAdapter;
  narrative?: NarrativeAdapter;
} {
  return {
    jev: jevEnabled() ? createJevTacticalDigestAdapter() : undefined,
    narrative: createConfiguredNarrativeAdapter(),
  };
}

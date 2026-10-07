import { z } from "zod";
import { projectEvents, type MatchEvent } from "../contracts/matchLog";
import {
  narrativePlanSchema,
  narrativeReportSchema,
  tacticalDigestSchema,
  type NarrativePlan,
  type NarrativeReport,
  type TacticalDigest,
  type WorldEventRef,
} from "../contracts/aiNativeWorld";
import {
  buildBattleReportBrief,
  renderBattleReportText,
} from "../contracts/battleReport";
import type { MatchMode } from "../contracts/matchMode";

export type NarrativeViewer = number | "spectator";

export interface JEVAdapter {
  summarize(input: {
    events: readonly MatchEvent[];
    eventRefs: readonly WorldEventRef[];
    world: WorldEventRef;
    digestId: string;
    idempotencyKey: string;
  }): TacticalDigest | Promise<TacticalDigest>;
}

export interface NarrativeAdapter {
  generate(input: {
    digest: TacticalDigest;
    plan: NarrativePlan;
  }): NarrativeReport | Promise<NarrativeReport>;
}

export interface NarrativePipelineInput {
  events: readonly MatchEvent[];
  eventRefs: readonly WorldEventRef[];
  world: WorldEventRef;
  viewer: NarrativeViewer;
  mode: MatchMode;
  matchId?: number | null;
  digestId: string;
  /** 保留旧调用：有计划时先审计并复用，没有时自动生成确定性计划。 */
  plan?: NarrativePlan;
  /** JEV 和叙事模型都是可选适配器，缺失时走确定性链路。 */
  jev?: JEVAdapter;
  narrative?: NarrativeAdapter;
}

export interface NarrativePipelineResult {
  digest: TacticalDigest | null;
  plan: NarrativePlan | null;
  report: NarrativeReport | null;
  text: string;
  usedFallback: boolean;
  audit: {
    ok: boolean;
    stage: "permission" | "digest" | "plan" | "report" | "fallback";
    errors: string[];
  };
}

type NarrativeAuditStage =
  "permission" | "digest" | "plan" | "report" | "fallback";

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const unique = (values: readonly number[]): number[] => [...new Set(values)];
const uniqueStrings = (values: readonly string[]): string[] => [
  ...new Set(values),
];

function visibleEvents(
  events: readonly MatchEvent[],
  viewer: NarrativeViewer
): MatchEvent[] {
  return projectEvents(events, viewer);
}

function visibleRefs(
  refs: readonly WorldEventRef[],
  viewer: NarrativeViewer
): WorldEventRef[] {
  if (viewer === "spectator") return [...refs];
  // WorldEventRef 当前没有 audienceSeat 字段；座位视角先只允许公共引用，
  // 避免把其他席位的密态事件误送给 JEV 或确定性战报。
  return refs.filter(ref => ref.visibility === "public");
}

function sameWorld(a: WorldEventRef, b: WorldEventRef): boolean {
  return a.worldId === b.worldId && a.matchId === b.matchId;
}

function sameRef(a: WorldEventRef, b: WorldEventRef): boolean {
  return (
    a.worldId === b.worldId &&
    a.cycle === b.cycle &&
    a.matchId === b.matchId &&
    a.eventSeq === b.eventSeq &&
    a.eventType === b.eventType &&
    a.stateHash === b.stateHash &&
    a.rulebookVersion === b.rulebookVersion &&
    a.visibility === b.visibility
  );
}

function assertAuthorizedRefs(
  candidates: readonly WorldEventRef[],
  authorized: readonly WorldEventRef[],
  label: string
): void {
  for (const candidate of candidates) {
    if (!authorized.some(ref => sameRef(ref, candidate))) {
      throw new Error(`${label}引用了未授权事件 E${candidate.eventSeq}`);
    }
  }
}

function assertAuthorizedSeqs(
  seqs: readonly number[],
  authorized: readonly WorldEventRef[],
  label: string
): void {
  const allowed = new Set(authorized.map(ref => ref.eventSeq));
  const invalid = seqs.find(eventSeq => !allowed.has(eventSeq));
  if (invalid !== undefined)
    throw new Error(`${label}引用了未授权事件 E${invalid}`);
}

function refsForSeqs(
  refs: readonly WorldEventRef[],
  seqs: readonly number[]
): WorldEventRef[] {
  const result: WorldEventRef[] = [];
  for (const eventSeq of unique(seqs)) {
    const ref = refs.find(candidate => candidate.eventSeq === eventSeq);
    if (ref) result.push(ref);
  }
  return result;
}

function fallbackId(prefix: string, value: string): string {
  const candidate = `${prefix}-${value}`.trim();
  return candidate.length <= 160 ? candidate : candidate.slice(0, 160);
}

function fallbackIdempotencyKey(digestId: string): string {
  return fallbackId("fallback", digestId).padEnd(8, "-");
}

function isUsableIdempotencyKey(value: string | undefined): value is string {
  const length = value?.trim().length ?? 0;
  return length >= 8 && length <= 200;
}

function safeBrief(input: {
  events: readonly MatchEvent[];
  eventRefs: readonly WorldEventRef[];
  mode: MatchMode;
  matchId?: number | null;
}) {
  const allowed = new Set(input.eventRefs.map(ref => ref.eventSeq));
  const scopedEvents = input.events.filter(event => allowed.has(event.seq));
  const brief = buildBattleReportBrief({
    events: scopedEvents,
    mode: input.mode,
    matchId: input.matchId,
  });
  const sanitizeMoment = (moment: (typeof brief.moments)[number]) => ({
    ...moment,
    evidenceSeqs: moment.evidenceSeqs.filter(eventSeq => allowed.has(eventSeq)),
  });
  const moments = brief.moments
    .map(sanitizeMoment)
    .filter(moment => moment.evidenceSeqs.length > 0);
  const momentBySeq = new Map(moments.map(moment => [moment.seq, moment]));

  return {
    ...brief,
    moments,
    turningPoints: brief.turningPoints
      .map(moment => momentBySeq.get(moment.seq) ?? sanitizeMoment(moment))
      .filter(moment => moment.evidenceSeqs.length > 0),
    strategyProfiles: brief.strategyProfiles.map(profile => ({
      ...profile,
      inferredSignals: profile.inferredSignals
        .map(signal => ({
          ...signal,
          evidenceSeqs: signal.evidenceSeqs.filter(eventSeq =>
            allowed.has(eventSeq)
          ),
        }))
        .filter(signal => signal.evidenceSeqs.length > 0),
    })),
  };
}

/**
 * 在 JEV 不可用时，从同一批已授权 MatchEvent 构建结构化战术摘要。
 * 这里不推测隐藏思维，只把事实、公开策略摘要和可见转折绑定到 E 序号。
 */
export function buildFallbackTacticalDigest(input: {
  events: readonly MatchEvent[];
  eventRefs: readonly WorldEventRef[];
  world: WorldEventRef;
  digestId: string;
  idempotencyKey: string;
  mode: MatchMode;
  matchId?: number | null;
}): TacticalDigest {
  const refs = [
    ...new Map(input.eventRefs.map(ref => [ref.eventSeq, ref])).values(),
  ];
  const brief = safeBrief({
    events: input.events,
    eventRefs: refs,
    mode: input.mode,
    matchId: input.matchId,
  });
  const facts = brief.moments.map(moment => ({
    text: `${moment.headline}：${moment.facts.join(" ")}`,
    evidenceSeqs: unique(moment.evidenceSeqs),
  }));
  const inferences = brief.strategyProfiles.flatMap(profile =>
    profile.inferredSignals.map(signal => ({
      text: `席位 ${profile.seat}：${signal.text}`,
      evidenceSeqs: unique(signal.evidenceSeqs),
    }))
  );
  const eventSeqs = refs.map(ref => ref.eventSeq);
  const uncertainty = [
    ...(brief.moments.some(moment => moment.kind === "ending")
      ? []
      : ["事件流尚未出现终局事件，胜负仍未确认。"]),
    ...(brief.moments.some(moment => moment.kind === "reveal")
      ? []
      : ["事件流尚未出现揭示事件，部分轮次结果仍不明确。"]),
    ...(inferences.length > 0
      ? []
      : ["没有可公开的策略摘要，只能依据已记录动作复盘。"]),
  ];

  return tacticalDigestSchema.parse({
    contractVersion: "1.0.0",
    digestId: input.digestId,
    idempotencyKey: input.idempotencyKey,
    world: input.world,
    eventRefs: refs,
    evidenceSeqs: eventSeqs.length > 0 ? eventSeqs : [input.world.eventSeq],
    facts,
    inferences,
    publicFacts: facts.map(fact => fact.text),
    turningPointSeqs: brief.turningPoints.map(moment => moment.seq),
    strategyLabels: uniqueStrings([
      ...brief.strategyProfiles.flatMap(profile => profile.confirmedSignals),
    ]).slice(0, 32),
    uncertainty,
  });
}

/** 从确定性摘要生成可审计的叙事分段，供真实叙事适配器或文本兜底共用。 */
export function buildFallbackNarrativePlan(input: {
  digest: TacticalDigest;
  planId?: string;
}): NarrativePlan {
  const refs = input.digest.eventRefs;
  const sections: NarrativePlan["sections"] = input.digest.facts
    .map((fact, index) => {
      const eventRefs = refsForSeqs(refs, fact.evidenceSeqs);
      if (eventRefs.length === 0) return null;
      return {
        sectionId: `fallback-section-${index + 1}`,
        title: fact.text.slice(0, 80),
        eventRefs,
        evidenceSeqs: unique(fact.evidenceSeqs),
        visibility: input.digest.world.visibility,
      } as NarrativePlan["sections"][number];
    })
    .filter(
      (section): section is NarrativePlan["sections"][number] =>
        section !== null
    );
  const covered = new Set(
    sections.flatMap(section => section.eventRefs.map(ref => ref.eventSeq))
  );
  const uncoveredRefs = refs.filter(ref => !covered.has(ref.eventSeq));
  if (uncoveredRefs.length > 0) {
    sections.push({
      sectionId: `fallback-section-${sections.length + 1}`,
      title: "其余已授权事件",
      eventRefs: uncoveredRefs,
      evidenceSeqs: uncoveredRefs.map(ref => ref.eventSeq),
      visibility: input.digest.world.visibility,
    });
  }
  if (sections.length === 0) {
    const worldRef =
      refs.find(ref => ref.eventSeq === input.digest.world.eventSeq) ??
      input.digest.world;
    sections.push({
      sectionId: "fallback-section-1",
      title: "对局证据",
      eventRefs: [worldRef],
      evidenceSeqs: [worldRef.eventSeq],
      visibility: worldRef.visibility,
    });
  }
  const evidenceSeqs = unique(
    sections.flatMap(section => section.evidenceSeqs)
  );

  return narrativePlanSchema.parse({
    contractVersion: "1.0.0",
    planId: input.planId ?? fallbackId("fallback-plan", input.digest.digestId),
    idempotencyKey: input.digest.idempotencyKey,
    world: input.digest.world,
    sourceDigestId: input.digest.digestId,
    evidenceSeqs,
    sections,
    projectionVersion: "v1.0.0",
  });
}

function validateDigest(
  digest: TacticalDigest,
  input: { digestId: string; idempotencyKey: string; world: WorldEventRef },
  refs: readonly WorldEventRef[]
): TacticalDigest {
  const parsed = tacticalDigestSchema.parse(digest);
  if (parsed.digestId !== input.digestId) throw new Error("JEV 摘要 ID 不匹配");
  if (parsed.idempotencyKey !== input.idempotencyKey)
    throw new Error("JEV 摘要幂等键不匹配");
  if (!sameWorld(parsed.world, input.world))
    throw new Error("JEV 摘要世界或对局不匹配");
  assertAuthorizedRefs(parsed.eventRefs, refs, "JEV 摘要");
  assertAuthorizedSeqs(parsed.evidenceSeqs, refs, "JEV 摘要证据");
  assertAuthorizedSeqs(parsed.turningPointSeqs, refs, "JEV 摘要转折点");
  parsed.facts.forEach(fact =>
    assertAuthorizedSeqs(fact.evidenceSeqs, refs, "JEV 摘要事实")
  );
  parsed.inferences.forEach(inference =>
    assertAuthorizedSeqs(inference.evidenceSeqs, refs, "JEV 摘要推断")
  );
  return parsed;
}

function validatePlan(
  plan: NarrativePlan,
  digest: TacticalDigest
): NarrativePlan {
  const parsed = narrativePlanSchema.parse(plan);
  if (!sameWorld(parsed.world, digest.world))
    throw new Error("叙事计划世界或对局不匹配");
  if (parsed.sourceDigestId !== digest.digestId)
    throw new Error("叙事计划未绑定当前战术摘要");
  if (parsed.idempotencyKey !== digest.idempotencyKey)
    throw new Error("叙事计划幂等键不匹配");
  const digestRefs = digest.eventRefs;
  const sectionRefs = parsed.sections.flatMap(section => section.eventRefs);
  assertAuthorizedRefs(sectionRefs, digestRefs, "叙事计划");
  assertAuthorizedSeqs(parsed.evidenceSeqs, digestRefs, "叙事计划证据");
  parsed.sections.forEach(section =>
    assertAuthorizedSeqs(section.evidenceSeqs, digestRefs, "叙事计划分段证据")
  );
  return parsed;
}

function validateReport(
  report: NarrativeReport,
  digest: TacticalDigest,
  plan: NarrativePlan
): NarrativeReport {
  const parsed = narrativeReportSchema.parse(report);
  if (!sameWorld(parsed.world, digest.world))
    throw new Error("叙事报告世界或对局不匹配");
  if (parsed.planId !== plan.planId) throw new Error("叙事报告计划不匹配");
  if (parsed.idempotencyKey !== plan.idempotencyKey)
    throw new Error("叙事报告幂等键不匹配");
  const digestRefs = digest.eventRefs;
  assertAuthorizedRefs(parsed.eventRefs, digestRefs, "叙事报告");
  parsed.claims.forEach(claim => {
    assertAuthorizedRefs(claim.evidence, digestRefs, "叙事报告证据");
    assertAuthorizedSeqs(claim.evidenceSeqs, digestRefs, "叙事报告证据");
  });
  if (/思维链|chain of thought|分析过程/i.test(parsed.body))
    throw new Error("叙事报告包含内部思维链内容");
  return parsed;
}

export async function runNarrativePipeline(
  input: NarrativePipelineInput
): Promise<NarrativePipelineResult> {
  const refs = visibleRefs(input.eventRefs, input.viewer);
  const events = visibleEvents(input.events, input.viewer).filter(event =>
    refs.some(ref => ref.eventSeq === event.seq)
  );
  const audit: { ok: boolean; stage: NarrativeAuditStage; errors: string[] } = {
    ok: false,
    stage: "permission",
    errors: [],
  };
  let digest: TacticalDigest | null = null;
  let plan: NarrativePlan | null = null;
  let report: NarrativeReport | null = null;
  let brief: ReturnType<typeof safeBrief> | null = null;
  let usedFallback = false;

  try {
    const worldRefVisible = refs.some(
      ref =>
        ref.eventSeq === input.world.eventSeq && sameWorld(ref, input.world)
    );
    if (!worldRefVisible) throw new Error("权限过滤后缺少世界锚点事件");
    if (refs.length === 0) throw new Error("权限过滤后没有可用事件引用");

    const idempotencyKey = isUsableIdempotencyKey(input.plan?.idempotencyKey)
      ? input.plan.idempotencyKey
      : fallbackIdempotencyKey(input.digestId);
    brief = safeBrief({
      events,
      eventRefs: refs,
      mode: input.mode,
      matchId: input.matchId,
    });
    const fallbackDigest = buildFallbackTacticalDigest({
      events,
      eventRefs: refs,
      world: input.world,
      digestId: input.digestId,
      idempotencyKey,
      mode: input.mode,
      matchId: input.matchId,
    });

    if (input.jev) {
      try {
        audit.stage = "digest";
        digest = validateDigest(
          await input.jev.summarize({
            events,
            eventRefs: refs,
            world: input.world,
            digestId: input.digestId,
            idempotencyKey,
          }),
          { digestId: input.digestId, idempotencyKey, world: input.world },
          refs
        );
      } catch (error) {
        usedFallback = true;
        audit.errors.push(errorText(error));
      }
    } else {
      usedFallback = true;
      audit.errors.push("未配置 JEV 适配器，使用确定性 TacticalDigest");
    }
    if (!digest) digest = fallbackDigest;

    if (input.plan) {
      try {
        audit.stage = "plan";
        plan = validatePlan(input.plan, digest);
      } catch (error) {
        usedFallback = true;
        audit.errors.push(errorText(error));
      }
    }
    if (!plan) {
      usedFallback = true;
      plan = buildFallbackNarrativePlan({ digest });
    }

    if (input.narrative) {
      try {
        audit.stage = "report";
        report = validateReport(
          await input.narrative.generate({ digest, plan }),
          digest,
          plan
        );
      } catch (error) {
        usedFallback = true;
        audit.errors.push(errorText(error));
      }
    } else {
      usedFallback = true;
      audit.errors.push("未配置叙事适配器，使用确定性战报文本");
    }

    if (report) {
      audit.ok = !usedFallback;
      return { digest, plan, report, text: report.body, usedFallback, audit };
    }
    audit.stage = "fallback";
    const fallbackBrief =
      brief ??
      safeBrief({
        events,
        eventRefs: refs,
        mode: input.mode,
        matchId: input.matchId,
      });
    return {
      digest,
      plan,
      report: null,
      text: renderBattleReportText(fallbackBrief),
      usedFallback: true,
      audit,
    };
  } catch (error) {
    audit.errors.push(errorText(error));
    audit.stage = "fallback";
    const fallbackBrief = safeBrief({
      events,
      eventRefs: refs,
      mode: input.mode,
      matchId: input.matchId,
    });
    return {
      digest,
      plan,
      report: null,
      text: renderBattleReportText(fallbackBrief),
      usedFallback: true,
      audit,
    };
  }
}

export const narrativePipelineInputSchema = z.object({
  viewer: z.union([z.number().int().nonnegative(), z.literal("spectator")]),
});

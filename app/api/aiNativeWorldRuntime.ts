import type { MatchEvent, MatchLogEnvelope } from "../contracts/matchLog";
import type { MatchMode } from "../contracts/matchMode";
import {
  AI_NATIVE_WORLD_CONTRACT_VERSION,
  type NarrativePlan,
  type NarrativeReport,
  type TacticalDigest,
  type WorldEventRef,
} from "../contracts/aiNativeWorld";
import {
  AiNativeProjectionCoordinator,
  type AiNativeProjectionOptions,
  type CanonicalProjectionEvent,
  type ProjectionBatch,
} from "./aiNativeProjection";
import {
  runNarrativePipeline,
  type JEVAdapter,
  type NarrativeAdapter,
  type NarrativePipelineResult,
  type NarrativeViewer,
} from "./narrativePipeline";
import { buildMatchStream } from "./aiNativeMatchStream";

export interface AppendWorldMatchEventInput {
  event: MatchEvent;
  ref: WorldEventRef;
  payload?: unknown;
}

export interface AiNativeWorldRuntimeOptions extends AiNativeProjectionOptions {
  cycle: number;
}

/**
 * 游戏运行时与两个世界投影之间的内存边界。
 *
 * 它不负责数据库、模型或 HTTP；这些依赖由上层注入。这样游戏模板可以
 * 先把真实 MatchEvent 接进来，再分别选择文字投影和图形投影的消费者。
 */
export class AiNativeWorldRuntime {
  private readonly projection: AiNativeProjectionCoordinator;
  private readonly options: AiNativeWorldRuntimeOptions;
  private readonly events: MatchEvent[] = [];
  private readonly refs: WorldEventRef[] = [];

  constructor(options: AiNativeWorldRuntimeOptions) {
    if (!Number.isInteger(options.cycle) || options.cycle < 0) {
      throw new Error("cycle 必须是非负整数");
    }
    this.options = { ...options };
    this.projection = new AiNativeProjectionCoordinator(options);
  }

  get eventCount(): number {
    return this.events.length;
  }

  get eventRefs(): readonly WorldEventRef[] {
    return this.refs;
  }

  get matchEvents(): readonly MatchEvent[] {
    return this.events;
  }

  /**
   * 追加一个已经由游戏内核产生的事实事件。重复投递必须完全相同，
   * 否则会被拒绝；这保证文字和图形投影不会各自看到不同的事实。
   */
  append(input: AppendWorldMatchEventInput): void {
    const { event, ref } = input;
    if (event.seq !== ref.eventSeq) throw new Error("MatchEvent.seq 与 WorldEventRef.eventSeq 不一致");
    if (event.t !== ref.eventType) throw new Error("MatchEvent.t 与 WorldEventRef.eventType 不一致");
    if (ref.worldId !== this.options.worldId || ref.matchId !== this.options.matchId) {
      throw new Error("事件不属于当前世界或对局");
    }
    if (ref.cycle !== this.options.cycle) throw new Error("事件周期与当前世界不一致");

    const canonical: CanonicalProjectionEvent = { ...ref, payload: input.payload };
    const existing = this.refs.find(candidate => candidate.eventSeq === ref.eventSeq);
    if (existing) {
      const same = JSON.stringify(existing) === JSON.stringify(ref)
        && JSON.stringify(this.events[ref.eventSeq]) === JSON.stringify(event);
      if (same) return;
      throw new Error(`重复事件内容不一致：eventSeq=${ref.eventSeq}`);
    }

    this.projection.accept(canonical);
    this.refs.push({ ...ref });
    this.events.push(event);
  }

  project(projection: "text" | "graphic", afterEventSeq?: number): ProjectionBatch {
    return this.projection.batch(projection, afterEventSeq);
  }

  async narrate(input: {
    viewer: NarrativeViewer;
    mode: MatchMode;
    digestId: string;
    plan: NarrativePlan;
    jev: JEVAdapter;
    narrative: NarrativeAdapter;
  }): Promise<NarrativePipelineResult> {
    return runNarrativePipeline({
      events: this.events,
      eventRefs: this.refs,
      world: this.refs[0] ?? this.emptyWorldRef(),
      viewer: input.viewer,
      mode: input.mode,
      matchId: this.options.matchId ? Number(this.options.matchId) || null : null,
      digestId: input.digestId,
      plan: input.plan,
      jev: input.jev,
      narrative: input.narrative,
    });
  }

  private emptyWorldRef(): WorldEventRef {
    return {
      worldId: this.options.worldId,
      cycle: this.options.cycle,
      matchId: this.options.matchId,
      eventSeq: 0,
      eventType: "world.empty",
      stateHash: "0".repeat(64),
      rulebookVersion: this.options.rulebookVersion,
      visibility: "public",
    };
  }
}

export function createAiNativeWorldRuntime(options: AiNativeWorldRuntimeOptions): AiNativeWorldRuntime {
  return new AiNativeWorldRuntime({
    ...options,
    projectionVersion: options.projectionVersion ?? AI_NATIVE_WORLD_CONTRACT_VERSION,
  });
}

/**
 * 生产事件流适配器：从已落库的 match_logs 重建同一条 AI 原生运行时。
 * 这一步不重新跑胜负，只验证并重放事实事件，因此服务重启后文字世界和
 * 图形投影仍然使用同一组 eventSeq/stateHash。
 */
export function createAiNativeWorldRuntimeFromEnvelope(input: {
  envelope: MatchLogEnvelope;
  worldId: string;
  cycle: number;
  matchId: string | null;
  rulebookVersion?: string;
}): AiNativeWorldRuntime {
  const stream = buildMatchStream(input);
  const runtime = createAiNativeWorldRuntime({
    worldId: input.worldId,
    matchId: input.matchId,
    cycle: input.cycle,
    rulebookVersion: input.rulebookVersion ?? "v1.0.0",
  });
  input.envelope.events.forEach((event, index) => {
    const ref = stream.refs[index];
    if (!ref) throw new Error(`事件引用缺失：eventSeq=${index}`);
    runtime.append({ event, ref });
  });
  return runtime;
}

export type { NarrativeReport, TacticalDigest };

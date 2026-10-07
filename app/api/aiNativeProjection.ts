import {
  AI_NATIVE_WORLD_CONTRACT_VERSION,
  projectionCursorSchema,
  type ProjectionCursor,
  type WorldEventRef,
} from "@contracts/aiNativeWorld";

export type AiNativeProjection = "text" | "graphic";

export type CanonicalProjectionEvent = WorldEventRef & {
  /** Optional canonical payload. It is carried through without interpretation. */
  payload?: unknown;
};

export type ProjectionEvent = {
  projection: AiNativeProjection;
  event: CanonicalProjectionEvent;
};

export type ProjectionBatch = {
  projection: AiNativeProjection;
  events: readonly ProjectionEvent[];
  cursor: ProjectionCursor;
};

export type AiNativeProjectionOptions = {
  worldId: string;
  matchId: string | null;
  rulebookVersion: string;
  projectionVersion?: string;
};

function cloneEvent(event: CanonicalProjectionEvent): CanonicalProjectionEvent {
  return { ...event };
}

function sameEvent(a: CanonicalProjectionEvent, b: CanonicalProjectionEvent): boolean {
  return a.worldId === b.worldId
    && a.matchId === b.matchId
    && a.eventSeq === b.eventSeq
    && a.stateHash === b.stateHash;
}

/**
 * Pure in-memory coordinator for the two projections of one canonical stream.
 * It has no persistence, model, database, or routing concerns.
 */
export class AiNativeProjectionCoordinator {
  private readonly options: Required<AiNativeProjectionOptions>;
  private readonly events: CanonicalProjectionEvent[] = [];

  constructor(options: AiNativeProjectionOptions) {
    this.options = {
      ...options,
      projectionVersion: options.projectionVersion ?? AI_NATIVE_WORLD_CONTRACT_VERSION,
    };
  }

  get cursor(): ProjectionCursor | null {
    const event = this.events.at(-1);
    return event ? this.makeCursor("text", event) : null;
  }

  get count(): number {
    return this.events.length;
  }

  /** Accept one canonical event. Duplicate delivery is idempotent. */
  accept(event: CanonicalProjectionEvent): void {
    this.assertEnvelope(event);
    const previous = this.events.at(-1);

    if (previous && event.eventSeq <= previous.eventSeq) {
      const duplicate = this.events.find(candidate => candidate.eventSeq === event.eventSeq);
      if (duplicate && sameEvent(duplicate, event)) return;
      throw new Error(`拒绝非幂等事件：eventSeq=${event.eventSeq}`);
    }

    const expectedSeq = previous ? previous.eventSeq + 1 : 0;
    if (event.eventSeq !== expectedSeq) {
      throw new Error(`事件序号不连续：expected=${expectedSeq}, received=${event.eventSeq}`);
    }

    this.events.push(cloneEvent(event));
  }

  /** Return all newly accumulated events for one projection and its current cursor. */
  batch(projection: AiNativeProjection, afterEventSeq?: number): ProjectionBatch {
    this.assertProjection(projection);
    const start = afterEventSeq === undefined ? 0 : afterEventSeq + 1;
    const selected = this.events
      .filter(event => event.eventSeq >= start)
      .map(event => ({ projection, event: cloneEvent(event) }));
    const latest = this.events.at(-1);
    const cursor = latest
      ? this.makeCursor(projection, latest)
      : this.makeCursor(projection, { eventSeq: 0, stateHash: "0".repeat(64) });

    return { projection, events: selected, cursor };
  }

  private assertEnvelope(event: CanonicalProjectionEvent): void {
    if (event.worldId !== this.options.worldId) throw new Error("拒绝跨世界事件");
    if (event.matchId !== this.options.matchId) throw new Error("拒绝跨比赛事件");
    if (event.rulebookVersion !== this.options.rulebookVersion) throw new Error("拒绝规则版本不一致的事件");
    if (!/^[a-f0-9]{64}$/i.test(event.stateHash)) throw new Error("拒绝非法状态哈希");
  }

  private assertProjection(projection: AiNativeProjection): void {
    if (projection !== "text" && projection !== "graphic") throw new Error("未知投影类型");
  }

  private makeCursor(projection: AiNativeProjection, event: Pick<CanonicalProjectionEvent, "eventSeq" | "stateHash">): ProjectionCursor {
    return projectionCursorSchema.parse({
      contractVersion: AI_NATIVE_WORLD_CONTRACT_VERSION,
      worldId: this.options.worldId,
      matchId: this.options.matchId,
      projection,
      eventSeq: event.eventSeq,
      stateHash: event.stateHash,
      rulebookVersion: this.options.rulebookVersion,
      projectionVersion: this.options.projectionVersion,
    });
  }
}

export function createAiNativeProjectionCoordinator(options: AiNativeProjectionOptions): AiNativeProjectionCoordinator {
  return new AiNativeProjectionCoordinator(options);
}

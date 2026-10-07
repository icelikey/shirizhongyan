import { createHash } from "node:crypto";
import type { MatchEvent, MatchLogEnvelope } from "../contracts/matchLog";
import type { CanonicalProjectionEvent } from "./aiNativeProjection";
import type { ProjectionCursor, WorldEventRef } from "../contracts/aiNativeWorld";

export interface BuildMatchStreamInput {
  envelope: MatchLogEnvelope;
  worldId: string;
  cycle: number;
  matchId: string | null;
  rulebookVersion?: string;
}

export interface MatchStream {
  refs: WorldEventRef[];
  events: CanonicalProjectionEvent[];
  cursor: ProjectionCursor | null;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function prefixHash(envelope: MatchLogEnvelope, prefix: readonly MatchEvent[]): string {
  return createHash("sha256")
    .update(stableJson({ rulebookId: envelope.rulebookId, seed: envelope.seed, events: prefix }))
    .digest("hex");
}

export function buildMatchStream(input: BuildMatchStreamInput): MatchStream {
  const { envelope } = input;
  const rulebookVersion = input.rulebookVersion ?? "v1.0.0";
  if (!Number.isInteger(input.cycle) || input.cycle < 0) throw new Error("cycle 必须是非负整数");

  const refs: WorldEventRef[] = [];
  const events: CanonicalProjectionEvent[] = [];
  for (const [index, event] of envelope.events.entries()) {
    if (event.seq !== index) throw new Error(`事件序号必须与数组位置一致：index=${index}, received=${event.seq}`);
    const ref: WorldEventRef = {
      worldId: input.worldId,
      cycle: input.cycle,
      matchId: input.matchId,
      eventSeq: event.seq,
      eventType: event.t,
      stateHash: prefixHash(envelope, envelope.events.slice(0, index + 1)),
      rulebookVersion,
      visibility: event.secret ? "judge" : "public",
    };
    refs.push(ref);
    events.push({ ...ref, payload: event });
  }

  const latest = refs.at(-1);
  return {
    refs,
    events,
    cursor: latest ? { contractVersion: "1.0.0", worldId: input.worldId, matchId: input.matchId, projection: "text", eventSeq: latest.eventSeq, stateHash: latest.stateHash, rulebookVersion, projectionVersion: "1.0.0" } : null,
  };
}

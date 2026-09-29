/** 世界 Outbox 事件的可持久化契约。 */
import { z } from "zod";
import type { SeatKind } from "./room";

export const WORLD_OUTBOX_EVENT_VERSION = 1 as const;

const worldSeatProjectionSchema = z.object({
  index: z.number().int().min(0).max(15),
  kind: z.enum(["human", "external-agent", "echo-bot"] satisfies [SeatKind, ...SeatKind[]]),
  userId: z.number().int().positive().nullable(),
  agentKeyId: z.number().int().positive().nullable(),
});

export const matchSettledWorldEventSchema = z.object({
  version: z.literal(WORLD_OUTBOX_EVENT_VERSION),
  matchLogId: z.number().int().positive(),
  defId: z.string().min(1).max(64),
  mapperId: z.string().min(1).max(96),
  worldId: z.string().min(1).max(64),
  epoch: z.number().int().positive(),
  settledAt: z.string().datetime({ offset: true }),
  rankings: z.array(z.number().int().min(0).max(15)).max(16),
  seats: z.array(worldSeatProjectionSchema.nullable()).max(16),
});

export type MatchSettledWorldEvent = z.infer<typeof matchSettledWorldEventSchema>;
export type WorldSeatProjection = z.infer<typeof worldSeatProjectionSchema>;

export function makeMatchSettledWorldEvent(
  input: Omit<MatchSettledWorldEvent, "version">,
): MatchSettledWorldEvent {
  return matchSettledWorldEventSchema.parse({
    version: WORLD_OUTBOX_EVENT_VERSION,
    ...input,
  });
}

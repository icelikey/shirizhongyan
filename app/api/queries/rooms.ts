import { eq } from "drizzle-orm";
import { rooms } from "@db/schema";
import type { Room } from "@db/schema";
import { getDb } from "./connection";

export async function insertRoom(data: {
  code: string;
  game: string;
  defId?: string;
  status: string;
  config?: unknown;
  stateJson?: unknown;
  createdByUserId?: number | null;
}) {
  await getDb().insert(rooms).values(data);
}

export async function findRoomByCode(code: string) {
  return getDb().query.rooms.findFirst({ where: eq(rooms.code, code) });
}

/** 每次状态变更后写回 stateJson / status（重启可从 stateJson 恢复） */
export async function persistRoomState(
  code: string,
  status: Room["status"],
  stateJson: unknown,
) {
  await getDb()
    .update(rooms)
    .set({ status, stateJson: stateJson as never })
    .where(eq(rooms.code, code));
}

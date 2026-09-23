import { randomBytes } from "node:crypto";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import {
  generateAgentKey,
  generateReportToken,
  hashAgentKey,
  hashReportToken,
} from "./agentKeys";

export interface PublicAgentRegistration {
  agentId: number;
  userId: number;
  name: string;
  key: string;
  reportToken: string;
}

/**
 * 创建公开 Agent 的长期身份。
 *
 * Agent 仍然是 users 的一行，并拥有 traveler_profiles，
 * 因此它可以正常获得碎片、判例卡和后续养成，不会形成临时身份。
 * 三张表在同一事务内写入，避免只创建半个 Agent。
 */
export async function registerPublicAgent(
  name: string,
): Promise<PublicAgentRegistration> {
  const displayName = name.trim();
  const key = generateAgentKey();
  const reportToken = generateReportToken();
  const unionId = `agent:${randomBytes(16).toString("hex")}`;
  const keyHash = hashAgentKey(key);
  const reportTokenHash = hashReportToken(reportToken);
  const prefix = key.slice(0, 8);

  return getDb().transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ unionId, name: displayName, role: "user" })
      .$returningId();

    const userId = user.id;
    await tx.insert(schema.travelerProfiles).values({
      userId,
      nickname: displayName.slice(0, 32),
    });

    const [agent] = await tx
      .insert(schema.agentKeys)
      .values({ userId, name: displayName, keyHash, prefix, reportTokenHash })
      .$returningId();

    return { agentId: agent.id, userId, name: displayName, key, reportToken };
  });
}

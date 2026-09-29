import { randomBytes } from "node:crypto";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import {
  generateAgentKey,
  generateReportToken,
  hashAgentKey,
  hashReportToken,
} from "./agentKeys";
import { createWorldState } from "@contracts/worldCycle";
import { ensureDefaultCoi, publicCoiGrant } from "./agentCoi";

export interface PublicAgentRegistration {
  agentId: number;
  userId: number;
  name: string;
  key: string;
  reportToken: string;
  coi: ReturnType<typeof publicCoiGrant>;
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
  const starterEchoes = ["baize", "eshou", "xuanji", "qingnang", "zhuyin", "ajiu", "shouzhuo", "baixiao"] as const;
  const companionEchoId = starterEchoes[randomBytes(1)[0] % starterEchoes.length];
  const world = createWorldState(Date.now(), companionEchoId);

  const result = await getDb().transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ unionId, name: displayName, role: "user" })
      .$returningId();

    const userId = user.id;
    await tx.insert(schema.travelerProfiles).values({
      userId,
      nickname: displayName.slice(0, 32),
      companionJson: {
        echoId: companionEchoId,
        customName: companionEchoId,
        style: "balanced",
        memorySlots: 3,
        bond: 1,
      },
      recordsJson: { world },
    });

    const [agent] = await tx
      .insert(schema.agentKeys)
      .values({ userId, name: displayName, keyHash, prefix, reportTokenHash })
      .$returningId();

    // 新注册的影从获得一组最小可玩的盘外招；它们仍须经过对局窗口和 CoI 校验。
    // 这样外部 Agent 注册后即可真实体验“观测 → 盘外招 → 战报”闭环。
    await tx.insert(schema.playerCards).values([
      { userId, cardId: "tactic-extra-breath", kind: "tactic", count: 1, source: "grant" },
      { userId, cardId: "tactic-false-signal", kind: "tactic", count: 1, source: "grant" },
      { userId, cardId: "tactic-echo-lens", kind: "tactic", count: 1, source: "grant" },
    ]);

    return { agentId: agent.id, userId, name: displayName, key, reportToken };
  });
  const coi = await ensureDefaultCoi(result.agentId);
  return { ...result, coi: publicCoiGrant(coi) };
}

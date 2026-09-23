/**
 * 冒烟测试（真 MySQL）：创建房 → 2 人类 + 1 key Agent 入座 → bot 填充
 * → 打满 5 轮 → finished 结算入账（fragClub + recordsJson）。
 *
 * 运行：npm run test -- api/games/guessRoom.smoke.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "../router";
import type { TrpcContext } from "../context";
import type { User } from "@db/schema";
import {
  users,
  travelerProfiles,
  agentKeys,
  playerCards,
  rooms,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { upsertUser } from "../queries/users";

const suffix = Math.random().toString(36).slice(2, 10);

function ctxFor(user?: User): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  };
}

async function makeUser(tag: string): Promise<User> {
  const unionId = `smoke_${tag}_${suffix}`;
  await upsertUser({ unionId, name: `烟测${tag}` });
  const row = await getDb().query.users.findFirst({
    where: eq(users.unionId, unionId),
  });
  if (!row) throw new Error("user provisioning failed");
  return row;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

const createdUserIds: number[] = [];
let roomCode = "";

afterAll(async () => {
  const db = getDb();
  if (roomCode) await db.delete(rooms).where(eq(rooms.code, roomCode));
  if (createdUserIds.length > 0) {
    await db
      .delete(travelerProfiles)
      .where(inArray(travelerProfiles.userId, createdUserIds));
    await db.delete(agentKeys).where(inArray(agentKeys.userId, createdUserIds));
    await db
      .delete(playerCards)
      .where(inArray(playerCards.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.$client.end();
});

describe("guess room full pipeline (smoke)", () => {
  it("create → 2 humans + 1 agent join → bots fill → 5 rounds → settle", async () => {
    const userA = await makeUser("a");
    const userB = await makeUser("b");
    createdUserIds.push(userA.id, userB.id);

    const callerA = appRouter.createCaller(ctxFor(userA));
    const callerB = appRouter.createCaller(ctxFor(userB));
    const callerAnon = appRouter.createCaller(ctxFor());

    // 档案：A 先存一份云端档案
    await callerA.profile.save({
      nickname: "烟测甲",
      fragSpade: 3,
      fragHeart: 2,
      fragClub: 10,
      fragDiamond: 1,
      tier: "huang",
    });
    const profileBefore = await callerA.profile.get();
    expect(profileBefore?.fragClub).toBe(10);

    // Agent Key 注册（明文仅返回一次）
    const { key, agentId } = await callerA.agent.register({
      name: "smoke-bot",
    });
    expect(key.startsWith("tdg_")).toBe(true);
    expect(agentId).toBeGreaterThan(0);
    const keyList = await callerA.agent.list();
    expect(keyList.some(k => k.id === agentId && k.active)).toBe(true);

    // 建房：A 占 0 号人类席
    const created = await callerA.room.create({ roomName: "烟测算庭" });
    roomCode = created.code;
    expect(created.code).toHaveLength(6);
    expect(created.seatIndex).toBe(0);
    if (!created.seatToken) throw new Error("guess room creator seat was not assigned");
    const creatorSeatToken = created.seatToken;

    // B 加入（1 号席）
    const joinedB = await callerB.room.join({ code: created.code });
    expect(joinedB.seatIndex).toBe(1);

    // Agent 入座（2 号席，key 鉴权）
    const joinedAgent = await callerAnon.agent.gatewayJoin({
      key,
      code: created.code,
    });
    expect(joinedAgent.seatIndex).toBe(2);
    expect(joinedAgent.agentId).toBe(agentId);

    // 房间列表可见
    const summaries = await callerAnon.room.list();
    const summary = summaries.find(s => s.code === created.code);
    expect(summary?.status).toBe("waiting");
    expect(summary?.hasAgentSeat).toBe(true);
    expect(summary?.seatsTaken).toBe(3);

    // 房主开局 → 空位全部由 echo-bot 填充
    await callerA.room.act({
      code: created.code,
      seatToken: creatorSeatToken,
      action: { type: "start" },
    });
    const started = await callerA.room.state({
      code: created.code,
      seatToken: creatorSeatToken,
    });
    expect(started.status).toBe("playing");
    expect(started.seats).toHaveLength(6);
    expect(started.seats.filter(s => s.kind === "echo-bot")).toHaveLength(3);
    expect(started.mySeat).toBe(0);

    // 打满 5 轮：轮询 submit 阶段，三方提交
    const submittedRounds = new Set<string>();
    const deadline = Date.now() + 240_000;
    let lastView = started;
    while (Date.now() < deadline) {
      const view = await callerAnon.agent.gatewayObserve({
        key,
        code: created.code,
      });
      lastView = view;
      if (view.status === "finished") break;
      if (view.phase === "submit") {
        const meAgent = view.seats.find(s => s.index === view.mySeat);
        if (meAgent && !meAgent.submitted) {
          const tag = `${view.round}`;
          if (!submittedRounds.has(`a${tag}`)) {
            submittedRounds.add(`a${tag}`);
            void callerA.room
              .act({
                code: created.code,
                seatToken: creatorSeatToken,
                action: { type: "submit", value: 22.2 },
              })
              .catch(() => undefined);
          }
          if (!submittedRounds.has(`b${tag}`)) {
            submittedRounds.add(`b${tag}`);
            void callerB.room
              .act({
                code: created.code,
                seatToken: joinedB.seatToken,
                action: { type: "submit", value: 18.5 },
              })
              .catch(() => undefined);
          }
          submittedRounds.add(`g${tag}`);
          void callerAnon.agent
            .gatewayAct({
              key,
              code: created.code,
              action: { type: "submit", value: 20 },
            })
            .catch(() => undefined);
        }
      }
      await sleep(400);
    }

    expect(lastView.status).toBe("finished");
    expect(lastView.totalRounds).toBe(5);
    expect(lastView.rankings).toHaveLength(6);
    expect(lastView.winner).not.toBeNull();
    expect(lastView.lastReveal?.round).toBe(5);
    // 揭晓信息完整公开
    expect(lastView.lastReveal && "values" in lastView.lastReveal)
      .toBe(true);
    if (!lastView.lastReveal || !("values" in lastView.lastReveal)) {
      throw new Error("guess room did not return a guess reveal");
    }
    expect(Object.keys(lastView.lastReveal.values)).toHaveLength(6);

    // 结算入账：等待奖励写入（settleRewards 在 finish 后异步执行）
    let profileA = await callerA.profile.get();
    let profileB = await callerB.profile.get();
    for (let i = 0; i < 20; i++) {
      const aOk =
        profileA &&
        profileA.fragClub !== 10 &&
        (profileA.recordsJson as { guess?: { played?: number } } | null)?.guess
          ?.played === 1;
      const bOk =
        profileB &&
        (profileB.recordsJson as { guess?: { played?: number } } | null)?.guess
          ?.played === 1;
      if (aOk && bOk) break;
      await sleep(500);
      profileA = await callerA.profile.get();
      profileB = await callerB.profile.get();
    }

    const recordsA = profileA?.recordsJson as {
      guess?: { played: number; won: number };
    } | null;
    const recordsB = profileB?.recordsJson as {
      guess?: { played: number; won: number };
    } | null;
    expect(recordsA?.guess?.played).toBe(1);
    expect(recordsB?.guess?.played).toBe(1);
    // 冠军 +50 / 亚军 +25 / 参与 +5，两人必居其一
    expect([50 + 10, 25 + 10, 5 + 10]).toContain(profileA?.fragClub);
    expect([50, 25, 5]).toContain(profileB?.fragClub);
    const wonA = recordsA?.guess?.won ?? 0;
    const wonB = recordsB?.guess?.won ?? 0;
    expect(wonA + wonB).toBeLessThanOrEqual(1);

    // lastUsedAt 已更新
    const keysAfter = await callerA.agent.list();
    expect(keysAfter.find(k => k.id === agentId)?.lastUsedAt).not.toBeNull();
  }, 300_000);
});

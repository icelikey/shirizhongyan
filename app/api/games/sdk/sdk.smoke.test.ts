/**
 * Game SDK 冒烟测试（真 MySQL）：
 * 创建 UGC 定义（红眼病 pollDuel：4 选项 / 7 轮 / 自定义奖励 120/60/10 ♥）
 * → 开房（room.create defId）→ 1 人类 + 1 Key Agent 入座 → bot 填充
 * → 打完 7 轮 → finished → 奖励按自定义数额入账 traveler_profiles.fragHeart。
 * 另含 zod 边界校验用例（seats/rounds/choices/奖励/时限越界拒绝）。
 *
 * 运行：npm run test -- api/games/sdk/sdk.smoke.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { appRouter } from "../../router";
import type { TrpcContext } from "../../context";
import type { User } from "@db/schema";
import {
  users,
  travelerProfiles,
  agentKeys,
  playerCards,
  rooms,
  gameDefs,
} from "@db/schema";
import { getDb } from "../../queries/connection";
import { upsertUser } from "../../queries/users";

const suffix = Math.random().toString(36).slice(2, 10);

function ctxFor(user?: User): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc"),
    resHeaders: new Headers(),
    user,
  };
}

async function makeUser(tag: string): Promise<User> {
  const unionId = `sdksmoke_${tag}_${suffix}`;
  await upsertUser({ unionId, name: `SDK烟测${tag}` });
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
let ugcDefId = "";

afterAll(async () => {
  const db = getDb();
  if (roomCode) await db.delete(rooms).where(eq(rooms.code, roomCode));
  if (ugcDefId) await db.delete(gameDefs).where(eq(gameDefs.defId, ugcDefId));
  if (createdUserIds.length > 0) {
    // 边界测试会创建一个合法的定义来确认上限，不能只依赖 ugcDefId。
    // 先清理这些烟测用户创建的全部 UGC 定义，再删除 users。
    await db
      .delete(gameDefs)
      .where(inArray(gameDefs.creatorUserId, createdUserIds));
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

describe("game sdk boundary validation", () => {
  it("rejects out-of-range UGC params", async () => {
    const user = await makeUser("zod");
    createdUserIds.push(user.id);
    const caller = appRouter.createCaller(ctxFor(user));
    const base = {
      name: "越界测试",
      entryFee: { suit: "heart" as const, amount: 0 },
      rewards: { winner: 10, runnerUp: 5, participation: 1 },
      submitWindowSec: 30,
    };
    const params = {
      rounds: 5,
      choices: ["红", "蓝"],
      payoff: "minority-wins" as const,
      scoreWin: 2,
    };
    await expect(
      caller.game.createDef({ ...base, template: "pollDuel", seats: 9, params })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({ ...base, template: "pollDuel", seats: 1, params })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        params: { ...params, rounds: 2 },
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        params: { ...params, rounds: 1001 },
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        params: { ...params, choices: ["a", "b", "c", "d", "e"] },
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        params: { ...params, choices: ["独"] },
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        entryFee: { suit: "heart", amount: 51 },
        params,
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        rewards: { winner: 201, runnerUp: 5, participation: 1 },
        params,
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "pollDuel",
        seats: 4,
        submitWindowSec: 9,
        params,
      })
    ).rejects.toThrow();
    await expect(
      caller.game.createDef({
        ...base,
        template: "numberGuess",
        seats: 4,
        params: {
          rounds: 5,
          min: 0,
          max: 100,
          targetRatio: 1.6,
          scoreWin: 2,
          scoreSecond: 1,
        },
      })
    ).rejects.toThrow();
  });
});

describe("sdk pollDuel UGC full pipeline (smoke)", () => {
  it("createDef → create room → human + key agent + bots → 7 rounds → custom rewards", async () => {
    const userA = await makeUser("a");
    createdUserIds.push(userA.id);
    const callerA = appRouter.createCaller(ctxFor(userA));
    const callerAnon = appRouter.createCaller(ctxFor());

    // 档案：A 先存一份（fragHeart 起始 7）
    await callerA.profile.save({
      nickname: "SDK烟测甲",
      fragSpade: 0,
      fragHeart: 7,
      fragClub: 0,
      fragDiamond: 0,
      tier: "huang",
    });

    // ① 创建 UGC 定义：红眼病 4 选项 7 轮，自定义 ♥ 奖励 120/60/10
    const def = await callerA.game.createDef({
      template: "pollDuel",
      name: "烟测红眼病",
      seats: 4,
      params: {
        rounds: 7,
        choices: ["红", "蓝", "青", "金"],
        payoff: "minority-wins",
        scoreWin: 2,
      },
      entryFee: { suit: "heart", amount: 0 },
      rewards: { winner: 120, runnerUp: 60, participation: 10 },
      submitWindowSec: 10,
    });
    ugcDefId = def.id;
    expect(def.id).toMatch(/^ugc_/);
    expect(def.isOfficial).toBe(false);

    // listDefs 可见（官方 2 个 + UGC）
    const defs = await callerAnon.game.listDefs();
    expect(defs.some(d => d.id === "guess-core" && d.isOfficial)).toBe(true);
    expect(defs.some(d => d.id === "poll-duel-core" && d.isOfficial)).toBe(
      true
    );
    expect(defs.some(d => d.id === def.id)).toBe(true);

    // ② 开房（defId），A 占 0 号席
    const created = await callerA.room.create({
      defId: def.id,
      roomName: "烟测票庭",
    });
    roomCode = created.code;
    expect(created.template).toBe("pollDuel");
    expect(created.seatIndex).toBe(0);
    if (!created.seatToken) throw new Error("poll room creator seat was not assigned");
    const creatorSeatToken = created.seatToken;

    // ③ Key Agent 入座
    const { key, agentId } = await callerA.agent.register({
      name: "sdk-smoke-bot",
    });
    const joinedAgent = await callerAnon.agent.gatewayJoin({
      key,
      code: roomCode,
    });
    expect(joinedAgent.seatIndex).toBe(1);
    expect(joinedAgent.agentId).toBe(agentId);

    // 房间列表摘要带 defId/模板/UGC 标记
    const summaries = await callerAnon.room.list();
    const summary = summaries.find(s => s.code === roomCode);
    expect(summary?.defId).toBe(def.id);
    expect(summary?.template).toBe("pollDuel");
    expect(summary?.isOfficial).toBe(false);
    expect(summary?.seatsTotal).toBe(4);

    // 房主开局 → bot 填充 2/3 号席
    await callerA.room.act({
      code: roomCode,
      seatToken: creatorSeatToken,
      action: { type: "start" },
    });
    const started = await callerAnon.agent.gatewayObserve({
      key,
      code: roomCode,
    });
    expect(started.status).toBe("playing");
    expect(started.seats).toHaveLength(4);
    expect(started.seats.filter(s => s.kind === "echo-bot")).toHaveLength(2);
    // PollDuel 观测含 choices
    expect(started.choices).toEqual(["红", "蓝", "青", "金"]);
    expect(started.totalRounds).toBe(7);
    expect(started.submitWindowSec).toBe(10);

    // ④ 打完 7 轮：人类 choose 轮转 0–3，Agent 轮转 1–0
    const submittedRounds = new Set<string>();
    const deadline = Date.now() + 240_000;
    let lastView = started;
    while (Date.now() < deadline) {
      const view = await callerAnon.agent.gatewayObserve({
        key,
        code: roomCode,
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
                code: roomCode,
                seatToken: creatorSeatToken,
                action: { type: "choose", choice: view.round % 4 },
              })
              .catch(() => undefined);
          }
          submittedRounds.add(`g${tag}`);
          void callerAnon.agent
            .gatewayAct({
              key,
              code: roomCode,
              action: { type: "choose", choice: (view.round + 1) % 4 },
            })
            .catch(() => undefined);
        }
      }
      await sleep(400);
    }

    expect(lastView.status).toBe("finished");
    expect(lastView.rankings).toHaveLength(4);
    expect(lastView.winner).not.toBeNull();
    expect(lastView.lastReveal?.round).toBe(7);
    const lr = lastView.lastReveal;
    expect(lr && "counts" in lr ? lr.counts : null).toHaveLength(4);

    // ⑤ 结算入账：fragHeart 按自定义奖励（120/60/10 − 门票 0）入账
    let profileA = await callerA.profile.get();
    for (let i = 0; i < 20; i++) {
      const rec = (profileA?.recordsJson ?? null) as {
        poll?: { played?: number };
      } | null;
      if (rec?.poll?.played === 1) break;
      await sleep(500);
      profileA = await callerA.profile.get();
    }
    const records = profileA?.recordsJson as {
      poll?: { played: number; won: number };
    } | null;
    expect(records?.poll?.played).toBe(1);
    expect([120 + 7, 60 + 7, 10 + 7]).toContain(profileA?.fragHeart);

    // UGC plays 计数 +1
    const defsAfter = await callerAnon.game.listDefs();
    const mine = defsAfter.find(d => d.id === def.id);
    expect(mine && !mine.isOfficial ? mine.plays : 0).toBe(1);
  }, 300_000);
});

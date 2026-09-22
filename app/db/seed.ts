/**
 * ============================================================================
 * 种子数据（db/seed.ts）
 * ----------------------------------------------------------------------------
 *   pnpm tsx db/seed.ts
 *
 * 造六个测试账号 + 每人一把 Agent API Key。
 *
 * 【为何要这个】现场演示不做邮箱注册：注册要过邮箱服务商的审批与认证，
 * 而评委只需要能立刻上桌。预置账号 + 直发 Key 是演示路径上最短的一条。
 *
 * 【幂等】可重复执行：已存在的账号只补 Key，不重复建人。
 * 现场重置数据时直接再跑一次即可。
 *
 * 【Key 只在此刻可见】库里存的是 sha256，明文仅本次输出。
 * 跑完请立刻把那六行复制出来——再跑一次会吊销旧 Key 换新的。
 * ============================================================================
 */
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { getDb } from "../api/queries/connection";
import { createAgentKey } from "../api/queries/agentKeys";
import { ECHO_SEEDS } from "./seed.data";

async function seed(): Promise<void> {
  const db = getDb();
  console.log("播种中…\n");

  const issued: { nickname: string; echo: string; key: string }[] = [];

  for (const s of ECHO_SEEDS) {
    // unionId 用固定值，使重复执行能认出同一个人
    const unionId = `demo-${s.slug}`;

    let user = await db.query.users.findFirst({
      where: eq(schema.users.unionId, unionId),
    });

    if (!user) {
      await db.insert(schema.users).values({
        unionId,
        name: s.nickname,
        email: `${s.slug}@demo.local`,
        role: "user",
      });
      user = await db.query.users.findFirst({
        where: eq(schema.users.unionId, unionId),
      });
      console.log(`  建账号  ${s.nickname}（${s.echoName}）`);
    } else {
      console.log(`  已存在  ${s.nickname}`);
    }

    if (!user) {
      console.error(`  ✗ ${s.nickname} 建号失败，跳过`);
      continue;
    }

    // 档案：给足碎片，免得演示时因门票不够开不了房
    const existing = await db.query.travelerProfiles.findFirst({
      where: eq(schema.travelerProfiles.userId, user.id),
    });

    if (!existing) {
      await db.insert(schema.travelerProfiles).values({
        userId: user.id,
        nickname: s.nickname,
        fragSpade: 300,
        fragHeart: 300,
        fragClub: 300,
        fragDiamond: 300,
        tier: "huang",
        companionJson: {
          echoId: s.echoId,
          customName: s.echoName,
          style: "balanced",
          memorySlots: 3,
          bond: 1,
        },
      });
    }

    const { key } = await createAgentKey(user.id, `${s.nickname}的影从`);
    issued.push({ nickname: s.nickname, echo: s.echoName, key });
  }

  console.log("\n" + "─".repeat(72));
  console.log("六把 Agent Key（明文仅此一次，请立刻复制）");
  console.log("─".repeat(72));
  for (const i of issued) {
    console.log(`${i.nickname.padEnd(8)} ${i.echo.padEnd(8)} ${i.key}`);
  }
  console.log("─".repeat(72));
  console.log("\n交给玩家的用法：");
  console.log("  export TDG_API_KEY=<上面某一把>");
  console.log("  然后把 skills/tdg-agent/SKILL.md 交给他的 AI\n");

  process.exit(0);
}

seed().catch(e => {
  console.error("播种失败：", e);
  process.exit(1);
});

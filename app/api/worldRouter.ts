/**
 * ============================================================================
 * 世界层路由（api/worldRouter.ts）
 * ----------------------------------------------------------------------------
 * 把分布式裁判机制接成可调用的端点：规则书查阅 → 质询 → 裁决 → 判例沉淀。
 *
 * 【设计取舍】质询对外暴露两条路径：
 *   appeal        真人玩家发起（需登录）
 *   gatewayAppeal 外部 Agent 发起（API Key 鉴权，与 agentRouter 同一套）
 * 两条路径共用 adjudicate，保证人与 Agent 受同一套规则约束——
 * 这正是「分布式智能」应有的对称性。
 * ============================================================================
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  appealableClauses,
  isAppealable,
  ASSERTION_MIN_LENGTH,
  APPEAL_REJECTION_LABEL,
  QUORUM_SIZES,
  type RuleBook,
} from "@contracts/rulebook";
import { RULEBOOKS, getRuleBook } from "@contracts/rulebooks.data";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  adjudicateWithJev,
  verdictToJudgeVotes,
  AppealRejectedError,
  QuorumError,
} from "./world/judges";
import { jevEnabled } from "./world/jev";
import {
  effectiveRuleBookVersion,
  findRecentRulings,
  findRulingsByClause,
  findUpheldRulings,
  insertRuling,
} from "./queries/rulings";
import { grantCard } from "./queries/playerCards";
import { findEnvelopeForViewer, findRecentMatchLogs } from "./queries/matchLogs";
import {
  checkGateForUser,
  gateContextForUser,
  relicProgressForUser,
} from "./queries/relicProgress";
import { SPECTATOR } from "@contracts/matchLog";

/* ------------------------------------------------------------------ */
/* 入参校验                                                            */
/* ------------------------------------------------------------------ */

const appealInputSchema = z.object({
  rulebookId: z.string().min(1).max(32),
  clauseId: z.string().min(1).max(32),
  assertion: z.string().trim().min(ASSERTION_MIN_LENGTH).max(500),
  /** 发起质询的座位号 */
  seat: z.number().int().min(0).max(15),
  /** 本局全部座位（铁律三：全部排除在裁判之外） */
  matchSeats: z.array(z.number().int().min(0).max(15)).min(2).max(16),
  /** 对局种子（保证裁判团可复现） */
  seed: z.string().min(1).max(64),
  quorumSize: z
    .union([z.literal(3), z.literal(5), z.literal(7)])
    .default(3),
  /** 关联的对局日志 id（尚未落库时为 null） */
  matchLogId: z.number().int().positive().nullable().default(null),
});

/** 规则书 → 前端视图（附判例演化后的有效版本号） */
async function bookView(book: RuleBook) {
  const version = await effectiveRuleBookVersion(book.id, book.version);
  return {
    id: book.id,
    name: book.name,
    template: book.template,
    baseVersion: book.version,
    /** 含判例演化的有效版本 */
    version,
    clauses: book.clauses.map(c => ({
      id: c.id,
      title: c.title,
      text: c.text,
      category: c.category,
      appealable: isAppealable(c),
    })),
  };
}

function requireBook(rulebookId: string): RuleBook {
  const book = getRuleBook(rulebookId);
  if (!book) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `规则书不存在：${rulebookId}`,
    });
  }
  return book;
}

/* ------------------------------------------------------------------ */
/* 裁决 + 沉淀（两条质询路径共用）                                       */
/* ------------------------------------------------------------------ */

async function runAppeal(params: {
  input: z.infer<typeof appealInputSchema>;
  discovererUserId: number | null;
  discovererName: string | null;
}) {
  const { input, discovererUserId, discovererName } = params;
  const book = requireBook(input.rulebookId);

  let result;
  try {
    result = await adjudicateWithJev({
      book,
      clauseId: input.clauseId,
      assertion: input.assertion,
      appellantSeat: input.seat,
      matchSeats: input.matchSeats,
      seed: input.seed,
      quorumSize: input.quorumSize,
    });
  } catch (e) {
    if (e instanceof AppealRejectedError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: APPEAL_REJECTION_LABEL[e.rejection],
      });
    }
    if (e instanceof QuorumError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    }
    throw e;
  }

  const { verdict, panel, jevMeta } = result;

  // 判例落库（采纳与驳回都记录：驳回也是规则史的一部分）
  const rulingId = await insertRuling({
    verdict,
    matchLogId: input.matchLogId,
    discovererUserId,
    discovererName,
  });

  // 采纳则铸判例卡（judicial 稀有度，唯一）
  if (verdict.upheld && discovererUserId !== null) {
    await grantCard({
      userId: discovererUserId,
      cardId: `j_${rulingId}`,
      kind: "ruling",
      source: "appeal",
    });
  }

  return {
    rulingId,
    upheld: verdict.upheld,
    summary: verdict.summary,
    /** 裁判团构成（观众可见，这是演出的一部分） */
    panel: panel.judges.map(j => ({
      index: j.index,
      kind: j.kind,
      name: j.name,
    })),
    votes: verdict.votes,
    /** 对齐 contracts/matchLog.ts 的 RulingEvent.judgeVotes */
    judgeVotes: verdictToJudgeVotes(verdict),
    /** 采纳后铸成的判例卡 id（未采纳为 null） */
    cardId: verdict.upheld ? `j_${rulingId}` : null,
    /** 可观测：哪几席由 Jev 裁断、各自耗时（演示时展示「快判断」） */
    jevMeta,
  };
}

/* ------------------------------------------------------------------ */
/* 路由                                                                */
/* ------------------------------------------------------------------ */

export const worldRouter = createRouter({
  /* ---------------- 规则书 ---------------- */

  /** 全部规则书摘要（规则图鉴列表） */
  rulebooks: publicQuery.query(async () => {
    return Promise.all(
      RULEBOOKS.map(async book => ({
        id: book.id,
        name: book.name,
        template: book.template,
        version: await effectiveRuleBookVersion(book.id, book.version),
        clauseCount: book.clauses.length,
        appealableCount: appealableClauses(book).length,
      })),
    );
  }),

  /** 单本规则书全文（含条款可质询标记） */
  rulebook: publicQuery
    .input(z.object({ rulebookId: z.string().min(1).max(32) }))
    .query(async ({ input }) => bookView(requireBook(input.rulebookId))),

  /** 某条款的判例沿革（条款下方展示） */
  clauseRulings: publicQuery
    .input(
      z.object({
        rulebookId: z.string().min(1).max(32),
        clauseId: z.string().min(1).max(32),
      }),
    )
    .query(async ({ input }) =>
      findRulingsByClause(input.rulebookId, input.clauseId),
    ),

  /** 某规则书已生效的判例（开局时加载） */
  upheldRulings: publicQuery
    .input(z.object({ rulebookId: z.string().min(1).max(32) }))
    .query(async ({ input }) => findUpheldRulings(input.rulebookId)),

  /** 全站最新判例（首页「规则正在演化」展示位） */
  recentRulings: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(10) }).optional())
    .query(async ({ input }) => findRecentRulings(input?.limit ?? 10)),

  /* ---------------- 质询 ---------------- */

  /** 真人玩家发起质询 */
  appeal: authedQuery
    .input(appealInputSchema)
    .mutation(async ({ ctx, input }) =>
      runAppeal({
        input,
        discovererUserId: ctx.user.id,
        discovererName: ctx.user.name ?? "旅人",
      }),
    ),

  /** 法定人数选项（前端质询面板用） */
  quorumSizes: publicQuery.query(() => QUORUM_SIZES),

  /**
   * 裁判层健康状态。
   * jev=false 表示未配 TYPESAFE_API_KEY，此时 J1/J2 走本地启发式——
   * 机制仍完整可演示，但前端应据此隐藏「AI 裁断」标记，不显示假数值。
   */
  judgeHealth: publicQuery.query(() => ({
    jev: jevEnabled(),
    quorumSizes: QUORUM_SIZES,
  })),

  /* ---------------- 残章拼图与塔门 ---------------- */

  /**
   * 我的残章拼图进度（卡册页逐组展示）。
   * 未集齐的组不下发 truth——提前泄露真相等于送出塔门答案。
   */
  myRelicProgress: authedQuery.query(async ({ ctx }) =>
    relicProgressForUser(ctx.user.id),
  ),

  /** 我的塔门判定快照（四项数据来自三张表，一次取齐） */
  myGateContext: authedQuery.query(async ({ ctx }) =>
    gateContextForUser(ctx.user.id),
  ),

  /** 判定某道门禁对我是否开启（含未通过时的世界观提示） */
  checkGate: authedQuery
    .input(
      z.object({
        gate: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("open") }),
          z.object({ kind: z.literal("relicSet"), setId: z.string().max(32) }),
          z.object({ kind: z.literal("anyRuling") }),
          z.object({ kind: z.literal("authoredGame") }),
          z.object({
            kind: z.literal("fragments"),
            cost: z.record(z.string(), z.number().int().min(0)),
          }),
        ]),
      }),
    )
    .query(async ({ ctx, input }) =>
      checkGateForUser(ctx.user.id, input.gate as never),
    ),

  /* ---------------- 观战 / 回放 ---------------- */

  /** 最近对局列表（观战大厅） */
  recentMatches: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ input }) => {
      const rows = await findRecentMatchLogs(input?.limit ?? 20);
      return rows.map(r => ({
        id: r.id,
        roomCode: r.roomCode,
        rulebookId: r.rulebookId,
        winnerSeat: r.winnerSeat,
        eventCount: r.eventCount,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
      }));
    }),

  /**
   * 取一局事件流用于观战/回放。
   *
   * 对局已结束，故默认全知视角（SPECTATOR）；传 seat 则按该座位投影，
   * 用于「以某人视角重看」。投影由 findEnvelopeForViewer 强制执行。
   */
  matchEvents: publicQuery
    .input(
      z.object({
        matchLogId: z.number().int().positive(),
        seat: z.number().int().min(0).max(15).nullable().default(null),
      }),
    )
    .query(async ({ input }) => {
      const envelope = await findEnvelopeForViewer(
        input.matchLogId,
        input.seat ?? SPECTATOR,
      );
      if (!envelope) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "对局日志不存在或版本不兼容",
        });
      }
      return envelope;
    }),
});

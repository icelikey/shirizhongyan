import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { AgentKey } from "@db/schema";
import {
  isAppealable,
  APPEAL_REJECTION_LABEL,
  ASSERTION_MIN_LENGTH,
} from "@contracts/rulebook";
import { ruleBookForTemplate } from "@contracts/rulebooks.data";
import {
  adjudicate,
  verdictToJudgeVotes,
  AppealRejectedError,
} from "./world/judges";
import { insertRuling } from "./queries/rulings";
import { grantCard } from "./queries/playerCards";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import {
  createAgentKey,
  findActiveAgentKey,
  findAgentKeysByUser,
  revokeAgentKey,
  touchAgentKey,
} from "./queries/agentKeys";
import { getSdkRoom, listRoomSummaries } from "./games/sdk/registry";
import { findRoomByCode } from "./queries/rooms";
import { gameActionSchema } from "./roomRouter";

const codeSchema = z
  .string()
  .min(4)
  .max(8)
  .transform((s) => s.toUpperCase());

/** 从入参或 Header 提取并校验 API Key（返回 active 的 agent_keys 行） */
async function requireAgentKey(
  headerVal: string | null,
  inputKey?: string,
): Promise<AgentKey> {
  let raw = inputKey?.trim() || "";
  if (!raw && headerVal) {
    raw = headerVal.startsWith("Bearer ")
      ? headerVal.slice("Bearer ".length).trim()
      : headerVal.trim();
  }
  if (!raw) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "缺少 API Key（入参 key 或 x-api-key / Authorization Header）",
    });
  }
  const row = await findActiveAgentKey(raw);
  if (!row) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "API Key 无效或已吊销" });
  }
  void touchAgentKey(row.id).catch(() => undefined);
  return row;
}

async function requireRoom(code: string) {
  const row = await findRoomByCode(code);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在" });
  }
  const room = await getSdkRoom(code, row);
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "房间不存在" });
  }
  return room;
}

export const agentRouter = createRouter({
  /** 生成 tdg_ 前缀 API Key（明文仅返回一次，库存 sha256 + prefix） */
  register: authedQuery
    .input(z.object({ name: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const { id, key } = await createAgentKey(ctx.user.id, input.name.trim());
      return { key, agentId: id };
    }),

  /** 当前用户的 Key 列表（脱敏：仅 prefix） */
  list: authedQuery.query(async ({ ctx }) => {
    const rows = await findAgentKeysByUser(ctx.user.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      active: r.active,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
    }));
  }),

  revoke: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await revokeAgentKey(ctx.user.id, input.id);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Key 不存在" });
      }
      return { ok: true };
    }),

  /** 外部 Agent 入座：分配 agent 席，返回与 key 绑定的 seatToken */
  gatewayJoin: publicQuery
    .input(z.object({ key: z.string().optional(), code: codeSchema }))
    .mutation(async ({ ctx, input }) => {
      const key = await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input.key,
      );
      const room = await requireRoom(input.code);
      const joined = await room.joinAsAgent({ id: key.id, name: key.name });
      return { ...joined, agentId: key.id };
    }),

  /** 可见房间列表（key 鉴权） */
  gatewayRooms: publicQuery
    .input(z.object({ key: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input?.key,
      );
      return listRoomSummaries();
    }),

  /** 该 Agent 座位视角观测（key 必须绑定了该房间的 agent 席） */
  gatewayObserve: publicQuery
    .input(z.object({ key: z.string().optional(), code: codeSchema }))
    .query(async ({ ctx, input }) => {
      const key = await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input.key,
      );
      const room = await requireRoom(input.code);
      const state = room.getState();
      const seat = state.seats.find(
        (s) => s?.kind === "external-agent" && s.agentKeyId === key.id,
      );
      if (!seat?.seatToken) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "该 Agent 未在此房间入座（先调用 gatewayJoin）",
        });
      }
      return room.view(seat.seatToken);
    }),

  /** 提交动作；更新 lastUsedAt */
  gatewayAct: publicQuery
    .input(
      z.object({
        key: z.string().optional(),
        code: codeSchema,
        action: gameActionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const key = await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input.key,
      );
      const room = await requireRoom(input.code);
      const state = room.getState();
      const seat = state.seats.find(
        (s) => s?.kind === "external-agent" && s.agentKeyId === key.id,
      );
      if (!seat?.seatToken) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "该 Agent 未在此房间入座（先调用 gatewayJoin）",
        });
      }
      await touchAgentKey(key.id);
      return room.act(seat.seatToken, input.action);
    }),

  /**
   * 外部 Agent 查阅本房间规则书全文。
   *
   * 质询的前提是读得到条款正文——不给 Agent 读规则的能力，
   * 「AI 挑战规则」就只是个说法。
   */
  gatewayRulebook: publicQuery
    .input(z.object({ key: z.string().optional(), code: codeSchema }))
    .query(async ({ ctx, input }) => {
      await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input.key,
      );
      const room = await requireRoom(input.code);
      const book = ruleBookForTemplate(room.def.template);
      if (!book) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `模板 ${room.def.template} 尚无规则书`,
        });
      }
      return {
        id: book.id,
        name: book.name,
        version: book.version,
        clauses: book.clauses.map(c => ({
          id: c.id,
          title: c.title,
          text: c.text,
          category: c.category,
          appealable: isAppealable(c),
        })),
      };
    }),

  /**
   * 外部 Agent 发起规则质询。
   *
   * 与真人的 world.appeal 共用同一套 adjudicate 与同一套约束——
   * 人与 Agent 在规则面前对称，这是「分布式智能」的题中之义。
   */
  gatewayAppeal: publicQuery
    .input(
      z.object({
        key: z.string().optional(),
        code: codeSchema,
        clauseId: z.string().min(1).max(32),
        assertion: z.string().trim().min(ASSERTION_MIN_LENGTH).max(500),
        quorumSize: z
          .union([z.literal(3), z.literal(5), z.literal(7)])
          .default(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const key = await requireAgentKey(
        ctx.req.headers.get("x-api-key") ??
          ctx.req.headers.get("authorization"),
        input.key,
      );
      const room = await requireRoom(input.code);
      const state = room.getState();
      const seat = state.seats.find(
        (s) => s?.kind === "external-agent" && s.agentKeyId === key.id,
      );
      if (!seat?.seatToken) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "该 Agent 未在此房间入座（先调用 gatewayJoin）",
        });
      }

      const book = ruleBookForTemplate(room.def.template);
      if (!book) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `模板 ${room.def.template} 尚无规则书`,
        });
      }

      // 铁律三：本局全部座位排除在裁判之外
      const matchSeats = state.seats
        .map((s, i) => (s ? i : -1))
        .filter(i => i >= 0);

      let result;
      try {
        result = adjudicate({
          book,
          clauseId: input.clauseId,
          assertion: input.assertion,
          appellantSeat: seat.index,
          matchSeats,
          // SdkRoom 尚未生成对局种子（事件流生产端待补），
          // 暂以「房间码 + 开局时刻」派生：同一局内稳定，可复现裁判团。
          seed: `${room.code}:${state.startedAt ?? 0}`,
          quorumSize: input.quorumSize,
        });
      } catch (e) {
        if (e instanceof AppealRejectedError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: APPEAL_REJECTION_LABEL[e.rejection],
          });
        }
        throw e;
      }

      const { verdict, panel } = result;
      const rulingId = await insertRuling({
        verdict,
        matchLogId: null,
        discovererUserId: key.userId,
        discovererName: key.name,
      });

      if (verdict.upheld) {
        await grantCard({
          userId: key.userId,
          cardId: `j_${rulingId}`,
          kind: "ruling",
          source: "appeal",
        });
      }

      await touchAgentKey(key.id);

      return {
        rulingId,
        upheld: verdict.upheld,
        summary: verdict.summary,
        panel: panel.judges.map(j => ({
          index: j.index,
          kind: j.kind,
          name: j.name,
        })),
        votes: verdict.votes,
        judgeVotes: verdictToJudgeVotes(verdict),
        cardId: verdict.upheld ? `j_${rulingId}` : null,
      };
    }),
});

import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  timestamp,
  datetime,
  bigint,
  int,
  boolean,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true })
    .autoincrement()
    .primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()

/* ---------------------------------------------------------------------------
 * ① traveler_profiles —— Kimi 登录用户的云端档案（与 src/store/profile.ts 对应）
 * ------------------------------------------------------------------------- */
export const travelerProfiles = mysqlTable("traveler_profiles", {
  id: bigint("id", { mode: "number", unsigned: true })
    .autoincrement()
    .primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .unique()
    .references(() => users.id),
  nickname: varchar("nickname", { length: 32 }).notNull().default("旅人"),
  fragSpade: int("fragSpade").notNull().default(0),
  fragHeart: int("fragHeart").notNull().default(0),
  fragClub: int("fragClub").notNull().default(0),
  fragDiamond: int("fragDiamond").notNull().default(0),
  /** 位阶：huang/xuan/di/tian（天地玄黄） */
  tier: varchar("tier", { length: 16 }).notNull().default("huang"),
  zodiacJson: json("zodiacJson"),
  companionJson: json("companionJson"),
  recordsJson: json("recordsJson"),
  echoMemoriesJson: json("echoMemoriesJson"),
  unlockedLoreJson: json("unlockedLoreJson"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type TravelerProfile = typeof travelerProfiles.$inferSelect;
export type InsertTravelerProfile = typeof travelerProfiles.$inferInsert;

/* ---------------------------------------------------------------------------
 * ② agent_keys —— 外部 Agent API Key（只存 sha256，明文仅注册时返回一次）
 * ------------------------------------------------------------------------- */
export const agentKeys = mysqlTable("agent_keys", {
  id: bigint("id", { mode: "number", unsigned: true })
    .autoincrement()
    .primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 64 }).notNull(),
  /** sha256(key) 十六进制（64 字符） */
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
  /** 明文前缀，用于列表展示（tdg_xxxx…） */
  prefix: varchar("prefix", { length: 16 }).notNull(),
  /** 只读日报 Token 的 sha256；明文仅在注册响应中返回一次。 */
  reportTokenHash: varchar("reportTokenHash", { length: 64 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: datetime("lastUsedAt"),
});

export type AgentKey = typeof agentKeys.$inferSelect;
export type InsertAgentKey = typeof agentKeys.$inferInsert;

/* ---------------------------------------------------------------------------
 * ②.1 agent_coi_grants —— Agent 的 CoI 影响域授权
 *     身份 Key 只证明“是谁”；CoI 才决定“能看什么、能做什么、能影响什么”。
 * ------------------------------------------------------------------------- */
export const agentCoiGrants = mysqlTable(
  "agent_coi_grants",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    agentKeyId: bigint("agentKeyId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => agentKeys.id, { onDelete: "cascade" }),
    grantId: varchar("grantId", { length: 96 }).notNull(),
    worldId: varchar("worldId", { length: 64 }).notNull(),
    epoch: int("epoch").notNull().default(1),
    scopeJson: json("scopeJson").notNull(),
    readScopesJson: json("readScopesJson").notNull(),
    actionScopesJson: json("actionScopesJson").notNull(),
    publishScopesJson: json("publishScopesJson").notNull(),
    budgetJson: json("budgetJson").notNull(),
    status: mysqlEnum("status", ["active", "revoked", "expired"]).notNull().default("active"),
    expiresAt: datetime("expiresAt").notNull(),
    revokedAt: datetime("revokedAt"),
    revokeReason: text("revokeReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    grantIdIdx: uniqueIndex("agent_coi_grants_grant_id_idx").on(table.grantId),
    agentStatusIdx: index("agent_coi_grants_agent_status_idx").on(table.agentKeyId, table.status),
    expiryIdx: index("agent_coi_grants_expiry_idx").on(table.status, table.expiresAt),
  }),
);

export type AgentCoiGrantRow = typeof agentCoiGrants.$inferSelect;
export type InsertAgentCoiGrantRow = typeof agentCoiGrants.$inferInsert;

/* ---------------------------------------------------------------------------
 * ②.2 agent_coi_usage —— CoI 使用账本，日报和预算都从这里重建
 * ------------------------------------------------------------------------- */
export const agentCoiUsage = mysqlTable(
  "agent_coi_usage",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    grantId: bigint("grantId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => agentCoiGrants.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    scopeId: varchar("scopeId", { length: 160 }),
    amount: int("amount").notNull().default(1),
    payloadJson: json("payloadJson"),
    occurredAt: datetime("occurredAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    grantOccurredIdx: index("agent_coi_usage_grant_occurred_idx").on(table.grantId, table.occurredAt),
    kindIdx: index("agent_coi_usage_kind_idx").on(table.kind),
  }),
);

export type AgentCoiUsageRow = typeof agentCoiUsage.$inferSelect;
export type InsertAgentCoiUsageRow = typeof agentCoiUsage.$inferInsert;

/* ---------------------------------------------------------------------------
 * ③ agent_activities —— Agent 的长期活动流
 *     入座、观测、行动、奇遇与 Worker 自主判断都写入这里。它是日报、
 *     Agent 档案和外部通知的共同事实来源，不把运行状态藏在 Worker 日志里。
 * ------------------------------------------------------------------------- */
export const agentActivities = mysqlTable(
  "agent_activities",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    agentKeyId: bigint("agentKeyId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => agentKeys.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    detail: text("detail"),
    payloadJson: json("payloadJson"),
    occurredAt: datetime("occurredAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    agentOccurredIdx: index("agent_activities_agent_occurred_idx").on(
      table.agentKeyId,
      table.occurredAt,
    ),
    kindIdx: index("agent_activities_kind_idx").on(table.kind),
  }),
);

export type AgentActivityRow = typeof agentActivities.$inferSelect;
export type InsertAgentActivityRow = typeof agentActivities.$inferInsert;

/* ---------------------------------------------------------------------------
 * ④ agent_daily_reports —— 可重建、可审计的日报快照
 * ------------------------------------------------------------------------- */
export const agentDailyReports = mysqlTable(
  "agent_daily_reports",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    agentKeyId: bigint("agentKeyId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => agentKeys.id, { onDelete: "cascade" }),
    reportDate: varchar("reportDate", { length: 10 }).notNull(),
    summary: text("summary").notNull(),
    statsJson: json("statsJson").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    agentDateIdx: uniqueIndex("agent_daily_reports_agent_date_idx").on(
      table.agentKeyId,
      table.reportDate,
    ),
  }),
);

export type AgentDailyReportRow = typeof agentDailyReports.$inferSelect;
export type InsertAgentDailyReportRow = typeof agentDailyReports.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑤ rooms —— 联机 SDK 房间，stateJson 为权威房间状态
 * ------------------------------------------------------------------------- */
export const rooms = mysqlTable(
  "rooms",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    code: varchar("code", { length: 8 }).notNull(),
    game: varchar("game", { length: 16 }).notNull().default("guess"),
    /** v4 SDK：关联 game_defs.defId；旧 guess 行默认 'guess-core' */
    // 官方内容包 ID 允许携带完整语义（例如 superpower-billiards-core）。
    // 不能用旧的 24 字符上限截断，否则注册表可见但房间无法落库。
    defId: varchar("defId", { length: 48 }).notNull().default("guess-core"),
    status: varchar("status", { length: 16 }).notNull().default("waiting"),
    config: json("config"),
    stateJson: json("stateJson"),
    createdByUserId: bigint("createdByUserId", {
      mode: "number",
      unsigned: true,
    }).references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  table => ({
    codeIdx: uniqueIndex("rooms_code_idx").on(table.code),
  })
);

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑥ game_defs —— v4 Game SDK：玩家自创（UGC）游戏定义
 *    官方定义（guess-core / poll-duel-core）是 api/games/sdk/registry.ts 中的
 *    常量，不入库；本表仅存 UGC 定义，defId 形如 'ugc_xxxxxxxx'。
 * ------------------------------------------------------------------------- */
export const gameDefs = mysqlTable(
  "game_defs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    defId: varchar("defId", { length: 48 }).notNull(),
    name: varchar("name", { length: 48 }).notNull(),
    template: varchar("template", { length: 24 }).notNull(),
    /** NumberGuessParams | PollDuelParams（见 contracts/gameSdk.ts） */
    params: json("params").notNull(),
    /** { suit, amount } */
    entryFee: json("entryFee").notNull(),
    /** { winner, runnerUp, participation } */
    rewards: json("rewards").notNull(),
    submitWindowSec: int("submitWindowSec").notNull().default(30),
    seats: int("seats").notNull().default(6),
    creatorUserId: bigint("creatorUserId", {
      mode: "number",
      unsigned: true,
    }).references(() => users.id),
    /** 累计开局数（房间 finished 时 +1） */
    plays: int("plays").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    defIdIdx: uniqueIndex("game_defs_defId_idx").on(table.defId),
  })
);

export type GameDefRow = typeof gameDefs.$inferSelect;
export type InsertGameDefRow = typeof gameDefs.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑦ match_logs —— 对局事件流（回放 / J2 仲裁 / 彩蛋判定 / 观战演出的唯一来源）
 *    payloadJson 结构见 contracts/matchLog.ts 的 MatchLogEnvelope。
 *    seed + rulebookId 足以从内核重跑整局，事件流用于逐步比对。
 * ------------------------------------------------------------------------- */
export const matchLogs = mysqlTable(
  "match_logs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    /** 房间码（便于按房间检索；房间可复用码，故不唯一） */
    roomCode: varchar("roomCode", { length: 8 }).notNull(),
    /** 使用的规则书 id */
    rulebookId: varchar("rulebookId", { length: 32 }).notNull(),
    /** 复现种子 */
    seed: varchar("seed", { length: 64 }).notNull(),
    /** MatchLogEnvelope */
    payloadJson: json("payloadJson").notNull(),
    /** 冗余列：便于不解 JSON 就能查询 */
    winnerSeat: int("winnerSeat"),
    eventCount: int("eventCount").notNull().default(0),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    endedAt: datetime("endedAt"),
  },
  table => ({
    roomIdx: index("match_logs_room_idx").on(table.roomCode),
  })
);

export type MatchLogRow = typeof matchLogs.$inferSelect;
export type InsertMatchLogRow = typeof matchLogs.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑦.1 text_world_chapters —— 文字世界章节投影
 *     章节只保存已落库事件的事实摘要和证据游标。它不是胜负输入，
 *     也不能反向修改 match_logs；删除章节不会影响回放和结算。
 * ------------------------------------------------------------------------- */
export const textWorldChapters = mysqlTable(
  "text_world_chapters",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    chapterId: varchar("chapterId", { length: 192 }).notNull(),
    worldId: varchar("worldId", { length: 64 }).notNull(),
    matchId: varchar("matchId", { length: 160 }).notNull(),
    matchLogId: bigint("matchLogId", { mode: "number", unsigned: true }),
    projection: varchar("projection", { length: 16 }).notNull().default("text"),
    eventSeq: int("eventSeq").notNull(),
    stateHash: varchar("stateHash", { length: 64 }).notNull(),
    rulebookVersion: varchar("rulebookVersion", { length: 32 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    evidenceJson: json("evidenceJson").notNull(),
    status: mysqlEnum("status", ["fallback", "generated"]).notNull().default("fallback"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    chapterIdIdx: uniqueIndex("text_world_chapters_chapter_id_idx").on(table.chapterId),
    matchCursorIdx: uniqueIndex("text_world_chapters_match_cursor_idx").on(
      table.worldId,
      table.matchId,
      table.projection,
      table.eventSeq,
    ),
    matchLogIdx: index("text_world_chapters_match_log_idx").on(table.matchLogId),
  }),
);

export type TextWorldChapterRow = typeof textWorldChapters.$inferSelect;
export type InsertTextWorldChapterRow = typeof textWorldChapters.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑧ command_receipts —— Gateway 命令幂等收据
 *    唯一键是已认证 Agent（agent_keys.id）+ commandId。payloadHash 用于
 *    拒绝同一 commandId 携带不同动作；pending 表示效果可能已交给房间
 *    actor，但收据尚未完成，不能把它当作 committed 重放。
 * ------------------------------------------------------------------------- */
export const commandReceipts = mysqlTable(
  "command_receipts",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    agentKeyId: bigint("agentKeyId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => agentKeys.id),
    commandId: varchar("commandId", { length: 128 }).notNull(),
    scopeId: varchar("scopeId", { length: 160 }).notNull(),
    bindingId: varchar("bindingId", { length: 160 }),
    contextRef: varchar("contextRef", { length: 160 }),
    /** canonical { contextRef, bindingId, action } 的 SHA-256 十六进制摘要 */
    payloadHash: varchar("payloadHash", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["pending", "committed", "rejected"])
      .notNull()
      .default("pending"),
    responseJson: json("responseJson"),
    errorCode: varchar("errorCode", { length: 64 }),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    completedAt: datetime("completedAt"),
  },
  table => ({
    agentCommandIdx: uniqueIndex("command_receipts_agent_command_idx").on(
      table.agentKeyId,
      table.commandId
    ),
    scopeIdx: index("command_receipts_scope_idx").on(table.scopeId),
  })
);

export type CommandReceiptRow = typeof commandReceipts.$inferSelect;
export type InsertCommandReceiptRow = typeof commandReceipts.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑨ world_outbox —— 最小可靠事件出口
 *    Gateway 成功命令写入一条 committed 事件；消费者可按 status/availableAt
 *    领取并以 eventId 幂等确认。它不替代 match_logs 的完整对局事件流。
 * ------------------------------------------------------------------------- */
export const worldOutbox = mysqlTable(
  "world_outbox",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    eventId: varchar("eventId", { length: 192 }).notNull(),
    scopeId: varchar("scopeId", { length: 160 }).notNull(),
    aggregateId: varchar("aggregateId", { length: 160 }),
    eventType: varchar("eventType", { length: 96 }).notNull(),
    commandId: varchar("commandId", { length: 128 }),
    payloadJson: json("payloadJson").notNull(),
    status: mysqlEnum("status", [
      "pending",
      "processing",
      "published",
      "failed",
    ])
      .notNull()
      .default("pending"),
    attempts: int("attempts").notNull().default(0),
    availableAt: timestamp("availableAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    workerId: varchar("workerId", { length: 96 }),
    leaseUntil: datetime("leaseUntil"),
    publishedAt: datetime("publishedAt"),
    lastError: text("lastError"),
  },
  table => ({
    eventIdIdx: uniqueIndex("world_outbox_event_id_idx").on(table.eventId),
    pendingIdx: index("world_outbox_pending_idx").on(
      table.status,
      table.availableAt,
      table.leaseUntil,
    ),
    scopeIdx: index("world_outbox_scope_idx").on(table.scopeId),
  })
);

export type WorldOutboxRow = typeof worldOutbox.$inferSelect;
export type InsertWorldOutboxRow = typeof worldOutbox.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑨ world_contributions —— 已结算对局进入服务器世界层的公开贡献
 *    只记录可审计的最小事实，不写秘密身份、完整对话或 API Key。
 *    contributionKey 是服务端生成的幂等键；同一参与者同一游戏同一对局
 *    只能贡献一次，避免 CLI 重试或房间恢复造成刷票。
 * ------------------------------------------------------------------------- */
export const worldContributions = mysqlTable(
  "world_contributions",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    contributionKey: varchar("contributionKey", { length: 192 }).notNull(),
    eventId: varchar("eventId", { length: 192 }).notNull(),
    worldId: varchar("worldId", { length: 64 }).notNull(),
    epoch: int("epoch").notNull(),
    participantRef: varchar("participantRef", { length: 128 }).notNull(),
    participantKind: varchar("participantKind", { length: 16 }).notNull(),
    gameId: varchar("gameId", { length: 64 }).notNull(),
    direction: varchar("direction", { length: 16 }).notNull(),
    weight: int("weight").notNull().default(1),
    evidenceRefs: json("evidenceRefs").notNull(),
    clueId: varchar("clueId", { length: 96 }),
    committedAt: datetime("committedAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    contributionKeyIdx: uniqueIndex("world_contributions_key_idx").on(
      table.contributionKey,
    ),
    eventIdIdx: uniqueIndex("world_contributions_event_idx").on(table.eventId),
    worldEpochIdx: index("world_contributions_world_epoch_idx").on(
      table.worldId,
      table.epoch,
    ),
    participantGameIdx: index("world_contributions_participant_game_idx").on(
      table.worldId,
      table.epoch,
      table.participantRef,
      table.gameId,
    ),
  }),
);

export type WorldContributionRow = typeof worldContributions.$inferSelect;
export type InsertWorldContributionRow = typeof worldContributions.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑩ world_epochs —— 服务器世界纪元快照
 *    snapshotJson 保存 WorldEpochSnapshot；checksum 对应公开快照内容，
 *    供跨服务器接轨和后续链上存证使用。实时玩法不读取区块链。
 * ------------------------------------------------------------------------- */
export const worldEpochs = mysqlTable(
  "world_epochs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    worldId: varchar("worldId", { length: 64 }).notNull(),
    epoch: int("epoch").notNull(),
    ruleVersion: varchar("ruleVersion", { length: 64 }).notNull(),
    direction: varchar("direction", { length: 16 }),
    snapshotJson: json("snapshotJson").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    worldEpochUniqueIdx: uniqueIndex("world_epochs_world_epoch_idx").on(
      table.worldId,
      table.epoch,
    ),
    latestIdx: index("world_epochs_latest_idx").on(
      table.worldId,
      table.epoch,
    ),
  }),
);

export type WorldEpochRow = typeof worldEpochs.$inferSelect;
export type InsertWorldEpochRow = typeof worldEpochs.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑪ player_cards —— 玩家持有的卡牌（见 contracts/cards.ts）
 *    策略卡只在规则书声明的窗口改变信息、时机或异能状态，不直接
 *    改写胜负函数；残章、判例、情报和契约仍按各自门禁规则使用。
 *    同一张卡可重复获得（count），重复份可用于交易。
 * ------------------------------------------------------------------------- */
export const playerCards = mysqlTable(
  "player_cards",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    /** 卡牌 id（残章见 contracts/relics.ts；策略卡见 contracts/tacticCards.ts） */
    cardId: varchar("cardId", { length: 48 }).notNull(),
    /** 'relic' | 'ruling' | 'intel' | 'contract' | 'tactic' */
    kind: varchar("kind", { length: 16 }).notNull(),
    count: int("count").notNull().default(1),
    /** CardSource：victory / egg / appeal / trade / grant */
    source: varchar("source", { length: 16 }).notNull().default("victory"),
    acquiredAt: timestamp("acquiredAt").defaultNow().notNull(),
  },
  table => ({
    ownerCardIdx: uniqueIndex("player_cards_owner_card_idx").on(
      table.userId,
      table.cardId
    ),
  })
);

export type PlayerCardRow = typeof playerCards.$inferSelect;
export type InsertPlayerCardRow = typeof playerCards.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑫ rulings —— 判例：规则质询被 J1 裁判团采纳后沉淀
 *    判例不改判已结算的胜负（否则回放不可复现），只影响本局后续与
 *    未来使用同一 RuleBook 的对局。世界的规则由 AI 的博弈真实地演化。
 * ------------------------------------------------------------------------- */
export const rulings = mysqlTable(
  "rulings",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .autoincrement()
      .primaryKey(),
    /** 被质询的规则书 */
    rulebookId: varchar("rulebookId", { length: 32 }).notNull(),
    /** 被质询的条款 id */
    clauseId: varchar("clauseId", { length: 32 }).notNull(),
    /** 质询主张原文 */
    assertion: text("assertion").notNull(),
    /** 裁判团裁决摘要 */
    summary: text("summary").notNull(),
    /** 是否采纳 */
    upheld: boolean("upheld").notNull().default(false),
    /** 铸成于哪一局 */
    matchLogId: bigint("matchLogId", { mode: "number", unsigned: true }),
    /** 首位发现者 */
    discovererUserId: bigint("discovererUserId", {
      mode: "number",
      unsigned: true,
    }).references(() => users.id),
    /** 发现者展示名（留名，用户改名后仍保留当时的名字） */
    discovererName: varchar("discovererName", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    bookClauseIdx: index("rulings_book_clause_idx").on(
      table.rulebookId,
      table.clauseId
    ),
  })
);

export type RulingRow = typeof rulings.$inferSelect;
export type InsertRulingRow = typeof rulings.$inferInsert;

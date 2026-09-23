import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
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
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 64 }).notNull(),
  /** sha256(key) 十六进制（64 字符） */
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(),
  /** 明文前缀，用于列表展示（tdg_xxxx…） */
  prefix: varchar("prefix", { length: 16 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type AgentKey = typeof agentKeys.$inferSelect;
export type InsertAgentKey = typeof agentKeys.$inferInsert;

/* ---------------------------------------------------------------------------
 * ③ rooms —— 联机房间（当前仅 'guess' 猜平均数），stateJson 为权威房间状态
 * ------------------------------------------------------------------------- */
export const rooms = mysqlTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull(),
    game: varchar("game", { length: 16 }).notNull().default("guess"),
    /** v4 SDK：关联 game_defs.defId；旧 guess 行默认 'guess-core' */
    defId: varchar("defId", { length: 24 }).notNull().default("guess-core"),
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
  (table) => ({
    codeIdx: uniqueIndex("rooms_code_idx").on(table.code),
  }),
);

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = typeof rooms.$inferInsert;

/* ---------------------------------------------------------------------------
 * ④ game_defs —— v4 Game SDK：玩家自创（UGC）游戏定义
 *    官方定义（guess-core / poll-duel-core）是 api/games/sdk/registry.ts 中的
 *    常量，不入库；本表仅存 UGC 定义，defId 形如 'ugc_xxxxxxxx'。
 * ------------------------------------------------------------------------- */
export const gameDefs = mysqlTable(
  "game_defs",
  {
    id: serial("id").primaryKey(),
    defId: varchar("defId", { length: 24 }).notNull(),
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
  (table) => ({
    defIdIdx: uniqueIndex("game_defs_defId_idx").on(table.defId),
  }),
);

export type GameDefRow = typeof gameDefs.$inferSelect;
export type InsertGameDefRow = typeof gameDefs.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑤ match_logs —— 对局事件流（回放 / J2 仲裁 / 彩蛋判定 / 观战演出的唯一来源）
 *    payloadJson 结构见 contracts/matchLog.ts 的 MatchLogEnvelope。
 *    seed + rulebookId 足以从内核重跑整局，事件流用于逐步比对。
 * ------------------------------------------------------------------------- */
export const matchLogs = mysqlTable(
  "match_logs",
  {
    id: serial("id").primaryKey(),
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
    endedAt: timestamp("endedAt"),
  },
  table => ({
    roomIdx: index("match_logs_room_idx").on(table.roomCode),
  })
);

export type MatchLogRow = typeof matchLogs.$inferSelect;
export type InsertMatchLogRow = typeof matchLogs.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑥ command_receipts —— Gateway 命令幂等收据
 *    唯一键是已认证 Agent（agent_keys.id）+ commandId。payloadHash 用于
 *    拒绝同一 commandId 携带不同动作；pending 表示效果可能已交给房间
 *    actor，但收据尚未完成，不能把它当作 committed 重放。
 * ------------------------------------------------------------------------- */
export const commandReceipts = mysqlTable(
  "command_receipts",
  {
    id: serial("id").primaryKey(),
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
    completedAt: timestamp("completedAt"),
  },
  table => ({
    agentCommandIdx: uniqueIndex("command_receipts_agent_command_idx").on(
      table.agentKeyId,
      table.commandId,
    ),
    scopeIdx: index("command_receipts_scope_idx").on(table.scopeId),
  }),
);

export type CommandReceiptRow = typeof commandReceipts.$inferSelect;
export type InsertCommandReceiptRow = typeof commandReceipts.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑦ world_outbox —— 最小可靠事件出口
 *    Gateway 成功命令写入一条 committed 事件；消费者可按 status/availableAt
 *    领取并以 eventId 幂等确认。它不替代 match_logs 的完整对局事件流。
 * ------------------------------------------------------------------------- */
export const worldOutbox = mysqlTable(
  "world_outbox",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("eventId", { length: 192 }).notNull(),
    scopeId: varchar("scopeId", { length: 160 }).notNull(),
    aggregateId: varchar("aggregateId", { length: 160 }),
    eventType: varchar("eventType", { length: 96 }).notNull(),
    commandId: varchar("commandId", { length: 128 }),
    payloadJson: json("payloadJson").notNull(),
    status: mysqlEnum("status", ["pending", "processing", "published", "failed"])
      .notNull()
      .default("pending"),
    attempts: int("attempts").notNull().default(0),
    availableAt: timestamp("availableAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    publishedAt: timestamp("publishedAt"),
    lastError: text("lastError"),
  },
  table => ({
    eventIdIdx: uniqueIndex("world_outbox_event_id_idx").on(table.eventId),
    pendingIdx: index("world_outbox_pending_idx").on(
      table.status,
      table.availableAt,
    ),
    scopeIdx: index("world_outbox_scope_idx").on(table.scopeId),
  }),
);

export type WorldOutboxRow = typeof worldOutbox.$inferSelect;
export type InsertWorldOutboxRow = typeof worldOutbox.$inferInsert;

/* ---------------------------------------------------------------------------
 * ⑧ player_cards —— 玩家持有的卡牌（四类见 contracts/cards.ts）
 *    卡牌不参与对局胜负计算，只决定能解开什么 / 进入哪里 / 引用什么条款。
 *    同一张卡可重复获得（count），重复份可用于交易。
 * ------------------------------------------------------------------------- */
export const playerCards = mysqlTable(
  "player_cards",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    /** 卡牌 id（残章卡见 contracts/relics.ts；判例卡形如 'j_<rulingId>'） */
    cardId: varchar("cardId", { length: 48 }).notNull(),
    /** 'relic' | 'ruling' | 'intel' | 'contract' */
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
 * ⑨ rulings —— 判例：规则质询被 J1 裁判团采纳后沉淀
 *    判例不改判已结算的胜负（否则回放不可复现），只影响本局后续与
 *    未来使用同一 RuleBook 的对局。世界的规则由 AI 的博弈真实地演化。
 * ------------------------------------------------------------------------- */
export const rulings = mysqlTable(
  "rulings",
  {
    id: serial("id").primaryKey(),
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

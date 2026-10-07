import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = await mysql.createConnection(databaseUrl);
try {
  // 旧部署把 GamePackage ID 限制为 24 字符，完整官方 ID
  // superpower-billiards-core 为 25 字符，会出现“目录可见、房间无法创建”。
  // 这条 MODIFY 是幂等的，兼容已经存在的旧数据库；新数据库由迁移直接创建 48 字符列。
  await db.query("ALTER TABLE `game_defs` MODIFY COLUMN `defId` varchar(48) NOT NULL");
  await db.query("ALTER TABLE `rooms` MODIFY COLUMN `defId` varchar(48) NOT NULL DEFAULT 'guess-core'");

  await db.query(`CREATE TABLE IF NOT EXISTS \`world_outbox\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`eventId\` varchar(192) NOT NULL,
    \`scopeId\` varchar(160) NOT NULL,
    \`aggregateId\` varchar(160) NULL,
    \`eventType\` varchar(96) NOT NULL,
    \`commandId\` varchar(128) NULL,
    \`payloadJson\` json NOT NULL,
    \`status\` enum('pending','processing','published','failed') NOT NULL DEFAULT 'pending',
    \`attempts\` int NOT NULL DEFAULT 0,
    \`availableAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`workerId\` varchar(96) NULL,
    \`leaseUntil\` datetime NULL,
    \`publishedAt\` datetime NULL,
    \`lastError\` text NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`world_outbox_event_id_idx\` (\`eventId\`),
    KEY \`world_outbox_pending_idx\` (\`status\`, \`availableAt\`, \`leaseUntil\`),
    KEY \`world_outbox_scope_idx\` (\`scopeId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  for (const statement of [
    "ALTER TABLE `world_outbox` ADD COLUMN `workerId` varchar(96) NULL",
    "ALTER TABLE `world_outbox` ADD COLUMN `leaseUntil` datetime NULL",
  ]) {
    try {
      await db.query(statement);
    } catch (error) {
      if (!String(error?.message ?? error).includes("Duplicate column")) throw error;
    }
  }

  await db.query(`CREATE TABLE IF NOT EXISTS \`world_contributions\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`contributionKey\` varchar(192) NOT NULL,
    \`eventId\` varchar(192) NOT NULL,
    \`worldId\` varchar(64) NOT NULL,
    \`epoch\` int NOT NULL,
    \`participantRef\` varchar(128) NOT NULL,
    \`participantKind\` varchar(16) NOT NULL,
    \`gameId\` varchar(64) NOT NULL,
    \`direction\` varchar(16) NOT NULL,
    \`weight\` int NOT NULL DEFAULT 1,
    \`evidenceRefs\` json NOT NULL,
    \`clueId\` varchar(96) NULL,
    \`committedAt\` datetime NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`world_contributions_key_idx\` (\`contributionKey\`),
    UNIQUE KEY \`world_contributions_event_idx\` (\`eventId\`),
    KEY \`world_contributions_world_epoch_idx\` (\`worldId\`, \`epoch\`),
    KEY \`world_contributions_participant_game_idx\` (\`worldId\`, \`epoch\`, \`participantRef\`, \`gameId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.query(`CREATE TABLE IF NOT EXISTS \`world_epochs\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`worldId\` varchar(64) NOT NULL,
    \`epoch\` int NOT NULL,
    \`ruleVersion\` varchar(64) NOT NULL,
    \`direction\` varchar(16) NULL,
    \`snapshotJson\` json NOT NULL,
    \`checksum\` varchar(64) NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`world_epochs_world_epoch_idx\` (\`worldId\`, \`epoch\`),
    KEY \`world_epochs_latest_idx\` (\`worldId\`, \`epoch\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // 文字世界章节是已结算事件的投影，不参与胜负计算；
  // 与世界涌现一起确保，避免终局投影因缺表被静默降级。
  await db.query(`CREATE TABLE IF NOT EXISTS \`text_world_chapters\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`chapterId\` varchar(192) NOT NULL,
    \`worldId\` varchar(64) NOT NULL,
    \`matchId\` varchar(160) NOT NULL,
    \`matchLogId\` bigint unsigned NULL,
    \`projection\` varchar(16) NOT NULL DEFAULT 'text',
    \`eventSeq\` int NOT NULL,
    \`stateHash\` varchar(64) NOT NULL,
    \`rulebookVersion\` varchar(32) NOT NULL,
    \`title\` varchar(200) NOT NULL,
    \`body\` text NOT NULL,
    \`evidenceJson\` json NOT NULL,
    \`status\` enum('fallback','generated') NOT NULL DEFAULT 'fallback',
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`text_world_chapters_chapter_id_idx\` (\`chapterId\`),
    UNIQUE KEY \`text_world_chapters_match_cursor_idx\` (\`worldId\`, \`matchId\`, \`projection\`, \`eventSeq\`),
    KEY \`text_world_chapters_match_log_idx\` (\`matchLogId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("World emergence/text projection schema ready");
} finally {
  await db.end();
}

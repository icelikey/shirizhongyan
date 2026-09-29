import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = await mysql.createConnection(databaseUrl);
try {
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

  console.log("World emergence schema ready");
} finally {
  await db.end();
}

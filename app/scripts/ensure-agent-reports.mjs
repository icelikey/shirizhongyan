import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = await mysql.createConnection(databaseUrl);
try {
  try {
    await db.query("ALTER TABLE `agent_keys` ADD COLUMN `reportTokenHash` varchar(64) NULL");
  } catch (error) {
    if (!String(error.message).includes("Duplicate column name")) throw error;
  }
  await db.query(`CREATE TABLE IF NOT EXISTS \`agent_activities\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`agentKeyId\` bigint unsigned NOT NULL,
    \`kind\` varchar(32) NOT NULL,
    \`title\` varchar(128) NOT NULL,
    \`detail\` text,
    \`payloadJson\` json,
    \`occurredAt\` datetime NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`agent_activities_agent_occurred_idx\` (\`agentKeyId\`, \`occurredAt\`),
    KEY \`agent_activities_kind_idx\` (\`kind\`),
    CONSTRAINT \`agent_activities_agentKeyId_fk\` FOREIGN KEY (\`agentKeyId\`) REFERENCES \`agent_keys\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS \`agent_daily_reports\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`agentKeyId\` bigint unsigned NOT NULL,
    \`reportDate\` varchar(10) NOT NULL,
    \`summary\` text NOT NULL,
    \`statsJson\` json NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`agent_daily_reports_agent_date_idx\` (\`agentKeyId\`, \`reportDate\`),
    CONSTRAINT \`agent_daily_reports_agentKeyId_fk\` FOREIGN KEY (\`agentKeyId\`) REFERENCES \`agent_keys\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log("Agent activity/report schema ready");
} finally {
  await db.end();
}

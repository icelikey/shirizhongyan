import "dotenv/config";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const db = await mysql.createConnection(databaseUrl);
try {
  await db.query(`CREATE TABLE IF NOT EXISTS \`agent_coi_grants\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`agentKeyId\` bigint unsigned NOT NULL,
    \`grantId\` varchar(96) NOT NULL,
    \`worldId\` varchar(64) NOT NULL,
    \`epoch\` int NOT NULL DEFAULT 1,
    \`scopeJson\` json NOT NULL,
    \`readScopesJson\` json NOT NULL,
    \`actionScopesJson\` json NOT NULL,
    \`publishScopesJson\` json NOT NULL,
    \`budgetJson\` json NOT NULL,
    \`status\` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
    \`expiresAt\` datetime NOT NULL,
    \`revokedAt\` datetime NULL,
    \`revokeReason\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`agent_coi_grants_grant_id_idx\` (\`grantId\`),
    KEY \`agent_coi_grants_agent_status_idx\` (\`agentKeyId\`, \`status\`),
    KEY \`agent_coi_grants_expiry_idx\` (\`status\`, \`expiresAt\`),
    CONSTRAINT \`agent_coi_grants_agentKeyId_fk\` FOREIGN KEY (\`agentKeyId\`) REFERENCES \`agent_keys\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await db.query(`CREATE TABLE IF NOT EXISTS \`agent_coi_usage\` (
    \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
    \`grantId\` bigint unsigned NOT NULL,
    \`kind\` varchar(32) NOT NULL,
    \`scopeId\` varchar(160) NULL,
    \`amount\` int NOT NULL DEFAULT 1,
    \`payloadJson\` json,
    \`occurredAt\` datetime NOT NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    KEY \`agent_coi_usage_grant_occurred_idx\` (\`grantId\`, \`occurredAt\`),
    KEY \`agent_coi_usage_kind_idx\` (\`kind\`),
    CONSTRAINT \`agent_coi_usage_grantId_fk\` FOREIGN KEY (\`grantId\`) REFERENCES \`agent_coi_grants\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log("Agent CoI schema ready");
} finally {
  await db.end();
}


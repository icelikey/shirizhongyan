CREATE TABLE `agent_activities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agentKeyId` bigint unsigned NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` varchar(128) NOT NULL,
	`detail` text,
	`payloadJson` json,
	`occurredAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_coi_grants` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agentKeyId` bigint unsigned NOT NULL,
	`grantId` varchar(96) NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`epoch` int NOT NULL DEFAULT 1,
	`scopeJson` json NOT NULL,
	`readScopesJson` json NOT NULL,
	`actionScopesJson` json NOT NULL,
	`publishScopesJson` json NOT NULL,
	`budgetJson` json NOT NULL,
	`status` enum('active','revoked','expired') NOT NULL DEFAULT 'active',
	`expiresAt` datetime NOT NULL,
	`revokedAt` datetime,
	`revokeReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_coi_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_coi_grants_grant_id_idx` UNIQUE(`grantId`)
);
--> statement-breakpoint
CREATE TABLE `agent_coi_usage` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`grantId` bigint unsigned NOT NULL,
	`kind` varchar(32) NOT NULL,
	`scopeId` varchar(160),
	`amount` int NOT NULL DEFAULT 1,
	`payloadJson` json,
	`occurredAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_coi_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_daily_reports` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agentKeyId` bigint unsigned NOT NULL,
	`reportDate` varchar(10) NOT NULL,
	`summary` text NOT NULL,
	`statsJson` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_daily_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_daily_reports_agent_date_idx` UNIQUE(`agentKeyId`,`reportDate`)
);
--> statement-breakpoint
CREATE TABLE `agent_keys` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`name` varchar(64) NOT NULL,
	`keyHash` varchar(64) NOT NULL,
	`prefix` varchar(16) NOT NULL,
	`reportTokenHash` varchar(64),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastUsedAt` datetime,
	CONSTRAINT `agent_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_keys_keyHash_unique` UNIQUE(`keyHash`)
);
--> statement-breakpoint
CREATE TABLE `command_receipts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`agentKeyId` bigint unsigned NOT NULL,
	`commandId` varchar(128) NOT NULL,
	`scopeId` varchar(160) NOT NULL,
	`bindingId` varchar(160),
	`contextRef` varchar(160),
	`payloadHash` varchar(64) NOT NULL,
	`status` enum('pending','committed','rejected') NOT NULL DEFAULT 'pending',
	`responseJson` json,
	`errorCode` varchar(64),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` datetime,
	CONSTRAINT `command_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `command_receipts_agent_command_idx` UNIQUE(`agentKeyId`,`commandId`)
);
--> statement-breakpoint
CREATE TABLE `game_defs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`defId` varchar(24) NOT NULL,
	`name` varchar(48) NOT NULL,
	`template` varchar(24) NOT NULL,
	`params` json NOT NULL,
	`entryFee` json NOT NULL,
	`rewards` json NOT NULL,
	`submitWindowSec` int NOT NULL DEFAULT 30,
	`seats` int NOT NULL DEFAULT 6,
	`creatorUserId` bigint unsigned,
	`plays` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `game_defs_id` PRIMARY KEY(`id`),
	CONSTRAINT `game_defs_defId_idx` UNIQUE(`defId`)
);
--> statement-breakpoint
CREATE TABLE `match_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`rulebookId` varchar(32) NOT NULL,
	`seed` varchar(64) NOT NULL,
	`payloadJson` json NOT NULL,
	`winnerSeat` int,
	`eventCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` datetime,
	CONSTRAINT `match_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_cards` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`cardId` varchar(48) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`count` int NOT NULL DEFAULT 1,
	`source` varchar(16) NOT NULL DEFAULT 'victory',
	`acquiredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_cards_owner_card_idx` UNIQUE(`userId`,`cardId`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`code` varchar(8) NOT NULL,
	`game` varchar(16) NOT NULL DEFAULT 'guess',
	`defId` varchar(24) NOT NULL DEFAULT 'guess-core',
	`status` varchar(16) NOT NULL DEFAULT 'waiting',
	`config` json,
	`stateJson` json,
	`createdByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `rulings` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`rulebookId` varchar(32) NOT NULL,
	`clauseId` varchar(32) NOT NULL,
	`assertion` text NOT NULL,
	`summary` text NOT NULL,
	`upheld` boolean NOT NULL DEFAULT false,
	`matchLogId` bigint unsigned,
	`discovererUserId` bigint unsigned,
	`discovererName` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rulings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `text_world_chapters` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`chapterId` varchar(192) NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`matchId` varchar(160) NOT NULL,
	`matchLogId` bigint unsigned,
	`projection` varchar(16) NOT NULL DEFAULT 'text',
	`eventSeq` int NOT NULL,
	`stateHash` varchar(64) NOT NULL,
	`rulebookVersion` varchar(32) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text NOT NULL,
	`evidenceJson` json NOT NULL,
	`status` enum('fallback','generated') NOT NULL DEFAULT 'fallback',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `text_world_chapters_id` PRIMARY KEY(`id`),
	CONSTRAINT `text_world_chapters_chapter_id_idx` UNIQUE(`chapterId`),
	CONSTRAINT `text_world_chapters_match_cursor_idx` UNIQUE(`worldId`,`matchId`,`projection`,`eventSeq`)
);
--> statement-breakpoint
CREATE TABLE `traveler_profiles` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`nickname` varchar(32) NOT NULL DEFAULT '旅人',
	`fragSpade` int NOT NULL DEFAULT 0,
	`fragHeart` int NOT NULL DEFAULT 0,
	`fragClub` int NOT NULL DEFAULT 0,
	`fragDiamond` int NOT NULL DEFAULT 0,
	`tier` varchar(16) NOT NULL DEFAULT 'huang',
	`zodiacJson` json,
	`companionJson` json,
	`recordsJson` json,
	`echoMemoriesJson` json,
	`unlockedLoreJson` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `traveler_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `traveler_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
CREATE TABLE `world_contributions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`contributionKey` varchar(192) NOT NULL,
	`eventId` varchar(192) NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`epoch` int NOT NULL,
	`participantRef` varchar(128) NOT NULL,
	`participantKind` varchar(16) NOT NULL,
	`gameId` varchar(64) NOT NULL,
	`direction` varchar(16) NOT NULL,
	`weight` int NOT NULL DEFAULT 1,
	`evidenceRefs` json NOT NULL,
	`clueId` varchar(96),
	`committedAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `world_contributions_id` PRIMARY KEY(`id`),
	CONSTRAINT `world_contributions_key_idx` UNIQUE(`contributionKey`),
	CONSTRAINT `world_contributions_event_idx` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `world_epochs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`worldId` varchar(64) NOT NULL,
	`epoch` int NOT NULL,
	`ruleVersion` varchar(64) NOT NULL,
	`direction` varchar(16),
	`snapshotJson` json NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `world_epochs_id` PRIMARY KEY(`id`),
	CONSTRAINT `world_epochs_world_epoch_idx` UNIQUE(`worldId`,`epoch`)
);
--> statement-breakpoint
CREATE TABLE `world_outbox` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`eventId` varchar(192) NOT NULL,
	`scopeId` varchar(160) NOT NULL,
	`aggregateId` varchar(160),
	`eventType` varchar(96) NOT NULL,
	`commandId` varchar(128),
	`payloadJson` json NOT NULL,
	`status` enum('pending','processing','published','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`workerId` varchar(96),
	`leaseUntil` datetime,
	`publishedAt` datetime,
	`lastError` text,
	CONSTRAINT `world_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `world_outbox_event_id_idx` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `agent_activities` ADD CONSTRAINT `agent_activities_agentKeyId_agent_keys_id_fk` FOREIGN KEY (`agentKeyId`) REFERENCES `agent_keys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_coi_grants` ADD CONSTRAINT `agent_coi_grants_agentKeyId_agent_keys_id_fk` FOREIGN KEY (`agentKeyId`) REFERENCES `agent_keys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_coi_usage` ADD CONSTRAINT `agent_coi_usage_grantId_agent_coi_grants_id_fk` FOREIGN KEY (`grantId`) REFERENCES `agent_coi_grants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_daily_reports` ADD CONSTRAINT `agent_daily_reports_agentKeyId_agent_keys_id_fk` FOREIGN KEY (`agentKeyId`) REFERENCES `agent_keys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agent_keys` ADD CONSTRAINT `agent_keys_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `command_receipts` ADD CONSTRAINT `command_receipts_agentKeyId_agent_keys_id_fk` FOREIGN KEY (`agentKeyId`) REFERENCES `agent_keys`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `game_defs` ADD CONSTRAINT `game_defs_creatorUserId_users_id_fk` FOREIGN KEY (`creatorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_cards` ADD CONSTRAINT `player_cards_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rulings` ADD CONSTRAINT `rulings_discovererUserId_users_id_fk` FOREIGN KEY (`discovererUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `traveler_profiles` ADD CONSTRAINT `traveler_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_activities_agent_occurred_idx` ON `agent_activities` (`agentKeyId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `agent_activities_kind_idx` ON `agent_activities` (`kind`);--> statement-breakpoint
CREATE INDEX `agent_coi_grants_agent_status_idx` ON `agent_coi_grants` (`agentKeyId`,`status`);--> statement-breakpoint
CREATE INDEX `agent_coi_grants_expiry_idx` ON `agent_coi_grants` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `agent_coi_usage_grant_occurred_idx` ON `agent_coi_usage` (`grantId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `agent_coi_usage_kind_idx` ON `agent_coi_usage` (`kind`);--> statement-breakpoint
CREATE INDEX `command_receipts_scope_idx` ON `command_receipts` (`scopeId`);--> statement-breakpoint
CREATE INDEX `match_logs_room_idx` ON `match_logs` (`roomCode`);--> statement-breakpoint
CREATE INDEX `rulings_book_clause_idx` ON `rulings` (`rulebookId`,`clauseId`);--> statement-breakpoint
CREATE INDEX `text_world_chapters_match_log_idx` ON `text_world_chapters` (`matchLogId`);--> statement-breakpoint
CREATE INDEX `world_contributions_world_epoch_idx` ON `world_contributions` (`worldId`,`epoch`);--> statement-breakpoint
CREATE INDEX `world_contributions_participant_game_idx` ON `world_contributions` (`worldId`,`epoch`,`participantRef`,`gameId`);--> statement-breakpoint
CREATE INDEX `world_epochs_latest_idx` ON `world_epochs` (`worldId`,`epoch`);--> statement-breakpoint
CREATE INDEX `world_outbox_pending_idx` ON `world_outbox` (`status`,`availableAt`,`leaseUntil`);--> statement-breakpoint
CREATE INDEX `world_outbox_scope_idx` ON `world_outbox` (`scopeId`);
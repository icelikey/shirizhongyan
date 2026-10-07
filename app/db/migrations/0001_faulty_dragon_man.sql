ALTER TABLE `game_defs` MODIFY COLUMN `defId` varchar(48) NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` MODIFY COLUMN `defId` varchar(48) NOT NULL DEFAULT 'guess-core';
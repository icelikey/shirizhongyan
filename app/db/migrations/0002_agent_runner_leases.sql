CREATE TABLE `agent_runner_leases` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `agentKeyId` bigint unsigned NOT NULL,
  `runnerId` varchar(128) NOT NULL,
  `leaseUntil` datetime NOT NULL,
  `lastHeartbeatAt` datetime NOT NULL,
  `releasedAt` datetime DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `agent_runner_leases_agent_key_id_unique` (`agentKeyId`),
  KEY `agent_runner_leases_runner_idx` (`runnerId`, `leaseUntil`),
  CONSTRAINT `agent_runner_leases_agent_key_fk` FOREIGN KEY (`agentKeyId`) REFERENCES `agent_keys` (`id`) ON DELETE CASCADE
);

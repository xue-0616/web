-- Initial schema for asset-migrator-oss.
-- Extracted from `backend-bin/asset-migrator/unipass_asset_migrator` rodata
-- string literals (search terms: `CREATE TABLE IF NOT EXISTS`). Intermediate
-- columns that were truncated in the ELF's rodata dump have been
-- reconstructed from the accompanying `FromRow` serde struct names visible
-- in the binary's symbol table (e.g. `coin_info::CoinPurpose`,
-- `deposit_address::DepositAddressStatus`).

CREATE TABLE IF NOT EXISTS `coin_info`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `chain_id` bigint NOT NULL,
    `chain_name` varchar(100) NOT NULL,
    `coin_name` varchar(100) NOT NULL,
    `token_address` varchar(100) NOT NULL,
    `token_decimal` smallint unsigned NOT NULL DEFAULT 18,
    `coin_purpose` varchar(32) NOT NULL,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `coin_info_UNIQUE` (`chain_id`,`token_address`)
) ENGINE = InnoDB AUTO_INCREMENT = 65535 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `deposit_address`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `chain_name` varchar(100) NOT NULL,
    `address` varchar(100) NOT NULL,
    `wallet_address` binary(20) DEFAULT NULL,
    `status` varchar(32) NOT NULL,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `deposit_address_chain_name_UNIQUE` (`chain_name`,`address`),
    UNIQUE KEY `deposit_address_chain_name_wallet_address_UNIQUE` (`chain_name`,`address`,`wallet_address`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `inbound_transaction`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `chain_name` varchar(100) NOT NULL,
    `coin_name` varchar(100) NOT NULL,
    `block_number` bigint unsigned DEFAULT NULL,
    `tx_hash` binary(32) NOT NULL,
    `from_address` varbinary(20) DEFAULT NULL,
    `to_address` varbinary(20) DEFAULT NULL,
    `amount` decimal(65, 0) DEFAULT NULL,
    `status` varchar(32) NOT NULL,
    `error_reason` TEXT DEFAULT NULL,
    `event_source_id` TEXT DEFAULT NULL,
    `event_source` TEXT DEFAULT NULL,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `inbound_tx_UNIQUE` (`coin_name`, `tx_hash`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `outbound_transaction`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `chain_id` bigint NOT NULL,
    `chain_name` varchar(100) NOT NULL,
    `token_address` varchar(100) NOT NULL,
    `block_number` bigint unsigned DEFAULT NULL,
    `from_address` varbinary(20) DEFAULT NULL,
    `to_address` varbinary(20) DEFAULT NULL,
    `amount` decimal(65, 0) DEFAULT NULL,
    `tx_hash` binary(32) DEFAULT NULL,
    `status` varchar(32) NOT NULL,
    `error_reason` TEXT DEFAULT NULL,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `outbound_tx_UNIQUE` (`chain_id`,`token_address`,`tx_hash`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tx_activity`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `wallet_address` binary(20) DEFAULT NULL,
    `inbound_chain` varchar(100) NOT NULL,
    `inbound_tx_hash` binary(32) NOT NULL,
    `inbound_coin` varchar(100) DEFAULT NULL,
    `inbound_from` varbinary(20) DEFAULT NULL,
    `inbound_amount` decimal(65, 0) DEFAULT NULL,
    `inbound_token_decimal` smallint unsigned DEFAULT NULL,
    `inbound_tx_error_reason` TEXT DEFAULT NULL,
    `outbound_from` TEXT DEFAULT NULL,
    `outbound_amount` decimal(65, 0) DEFAULT NULL,
    `outbound_token_decimal` smallint unsigned DEFAULT NULL,
    `outbound_tx_error_reason` TEXT DEFAULT NULL,
    `outbound_tx_hash` binary(32) DEFAULT NULL,
    `amount` decimal(65, 0) DEFAULT NULL,
    `status` varchar(32) NOT NULL,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `tx_activity_UNIQUE` (`inbound_chain`,`inbound_tx_hash`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `deposit_event`(
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `event_source` varchar(100) NOT NULL,
    `event_source_id` varchar(200) NOT NULL,
    `payload` JSON NOT NULL,
    `processed` TINYINT(1) NOT NULL DEFAULT 0,
    `created_time` datetime NOT NULL,
    `updated_time` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `deposit_event_UNIQUE` (`event_source`,`event_source_id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

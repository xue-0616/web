-- Initial schema — extracted verbatim from the closed-source ELF's rodata,
-- then re-applied with all subsequent ALTERs folded in (see snap_account_transaction
-- fields updated by migrations 20240201..20240401 in the ELF).

CREATE TABLE IF NOT EXISTS `snap_account` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT '@desc primary account id',
    `account_address` binary(20) NOT NULL COMMENT '@desc the account address',
    `provider_type` tinyint unsigned NOT NULL COMMENT '@desc provider type. @values 0: Snap | 1: Google',
    `provider_identifier` varchar(64) NOT NULL COMMENT '@desc provider identifier: snap addr OR google sub',
    `guide_status` tinyint unsigned NOT NULL COMMENT '@desc user guide status. @values 0 not start | 1 finish',
    `register_time` datetime NOT NULL,
    `last_login` datetime NOT NULL,
    `created_at` datetime NOT NULL,
    `updated_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `account_address_uk` (`account_address`),
    UNIQUE KEY `account_provider_uk` (`provider_type`, `provider_identifier`)
) ENGINE = InnoDB AUTO_INCREMENT = 65525 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Schema as of the 4th migration (child_transfer_count dropped, fee_transaction
-- added, transaction renamed to custom_transactions, estimate_used_gas renamed to
-- estimate_fee, fee_amount now unsigned, status now unsigned, etc.).
CREATE TABLE IF NOT EXISTS `snap_account_transaction` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `account_address` binary(20) NOT NULL COMMENT '@desc from wallet address',
    `chain_id` bigint unsigned NOT NULL,
    `nonce` bigint unsigned NOT NULL,
    `used_free_quota` int unsigned NOT NULL,
    `effective_time` datetime NOT NULL COMMENT '@desc free quota effective time',
    `relayer_tx_hash` binary(32) DEFAULT NULL,
    `custom_transactions` json NOT NULL COMMENT '@desc transaction body',
    `fee_transaction` json DEFAULT NULL,
    `estimate_fee` decimal(10, 4) unsigned NOT NULL,
    `fee_token` binary(20) DEFAULT NULL COMMENT '@values null=no-fee | zero=native | else=erc20 addr',
    `fee_decimal` tinyint unsigned DEFAULT NULL,
    `fee_amount` decimal(60, 0) unsigned DEFAULT NULL,
    `free_sig` varbinary(1024) DEFAULT NULL,
    `transaction_hash` binary(32) DEFAULT NULL,
    `used_gas` bigint unsigned DEFAULT NULL,
    `gas_price` decimal(60, 0) unsigned DEFAULT NULL,
    `tank_paid_amount` decimal(10, 3) NOT NULL COMMENT '@desc tank paid USD (negative = earn)',
    `status` tinyint unsigned NOT NULL COMMENT '@values 0 init | 1 signed_free_sig | 2 on_chain | 3 failed',
    `created_at` datetime NOT NULL,
    `updated_at` datetime NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `account_tx_uk` (`account_address`,`chain_id`,`nonce`),
    UNIQUE KEY `relayer_tx_hash_uk` (`relayer_tx_hash`),
    UNIQUE KEY `transaction_hash_uk` (`transaction_hash`),
    KEY `transaction_effective_time_idx` (`effective_time`)
) ENGINE = InnoDB AUTO_INCREMENT = 65535 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

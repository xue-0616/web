import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateDeploymentTokens1712635239798 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1712635239798';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            console.log(`${this.name} start running`);
            await queryRunner.connection.query('CREATE TABLE `deployment_tokens` (' +
                '`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,' +
                "`token_id` BIGINT UNSIGNED NOT NULL COMMENT '@desc token id'," +
                "`decimal` TINYINT UNSIGNED NOT NULL COMMENT '@desc token decimal'," +
                "`total_supply` DECIMAL(60,0) UNSIGNED NOT NULL COMMENT '@desc total supply'," +
                "`amount_per_mint` BIGINT UNSIGNED NOT NULL COMMENT '@desc amount per mint'," +
                "`minted_amount` DECIMAL(60,0) UNSIGNED NOT NULL COMMENT '@desc minted amount'," +
                "`minted_ratio` DECIMAL(9,8) UNSIGNED NOT NULL COMMENT '@desc minted ratio'," +
                "`locked_btc_age` BIGINT UNSIGNED NULL COMMENT '@desc locked btc age, value = locked amount * locked blocks'," +
                "`locked_btc_amounts` VARCHAR(256) NULL COMMENT '@desc allowed locked btc amounts, split by `,` if is multiple, unit: sat.'," +
                "`deployer_address` VARCHAR(80) NOT NULL COMMENT '@desc deployer address'," +
                "`paymaster_address` VARCHAR(80) NOT NULL COMMENT '@desc pay master address'," +
                "`prepare_deployment_tx` VARBINARY(5000) NOT NULL COMMENT '@desc prepare deployment transaction'," +
                "`prepare_deployment_tx_hash` BINARY(32) NOT NULL COMMENT '@desc prepare deployment tx hash'," +
                "`prepare_deployment_ckb_tx_hash` BINARY(32) NOT NULL COMMENT '@desc prepare deployment ckb tx hash'," +
                "`deployment_tx` VARBINARY(5000) NOT NULL COMMENT '@desc deployment transaction'," +
                "`deployment_tx_hash` BINARY(32) NOT NULL COMMENT '@desc deployment tx hash'," +
                "`deployment_ckb_tx_hash` BINARY(32) NOT NULL COMMENT '@desc deployment ckb tx hash'," +
                "`start_block` BIGINT UNSIGNED NOT NULL COMMENT '@desc block height of starting minting'," +
                "`status` TINYINT UNSIGNED NOT NULL COMMENT '@desc deployment tx status\n@values 0 record in db | 1 prepare deployment tx is pending | 2 prepare deployment tx success | 3 deployment tx is pending | 4 deployment tx success'," +
                "`deployed_time` DATETIME NULL COMMENT '@desc deployed time'," +
                "`created_at` DATETIME NOT NULL COMMENT '@desc created time'," +
                "`updated_at` DATETIME NOT NULL COMMENT '@desc updated at'," +
                'PRIMARY KEY (`id`),' +
                'UNIQUE INDEX `prepare_deployment_tx_hash_uk` (`prepare_deployment_tx_hash` ASC) VISIBLE,' +
                'UNIQUE INDEX `prepare_deployment_ckb_tx_hash_uk` (`prepare_deployment_ckb_tx_hash` ASC) VISIBLE,' +
                'UNIQUE INDEX `deployment_tx_hash_uk` (`deployment_tx_hash` ASC) VISIBLE,' +
                'UNIQUE INDEX `deployment_ckb_tx_hash_uk` (`deployment_ckb_tx_hash` ASC) VISIBLE,' +
                'UNIQUE INDEX `token_id_uk` (`token_id` ASC) VISIBLE,' +
                'INDEX `deployed_time_idx` (`deployed_time` ASC) VISIBLE)' +
                'AUTO_INCREMENT = 655300');
        }
    async down(): Promise<void> {
            console.error(`Not support migration down for ${this.name}`);
        }
}

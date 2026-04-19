import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransaction1725951729896 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query(`CREATE TABLE transactions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '@desc transaction id',
            tx_sig BINARY(64) NULL COMMENT '@desc tx sig',
            tx_body BLOB NOT NULL COMMENT '@desc tx body',
            tx_block_height BIGINT UNSIGNED NOT NULL COMMENT '@desc tx recent block height',
            tx_order_type TINYINT UNSIGNED NOT NULL COMMENT '@desc tx order type\n@values 0 create mystery box | 1 grabmystery box | 2 distribute mystery box',
            tx_order_id BIGINT UNSIGNED NOT NULL COMMENT '@desc tx order id',
            slot BIGINT UNSIGNED NULL COMMENT '@desc tx block height',
            slot_index BIGINT UNSIGNED NULL COMMENT '@desc tx id in block',
            status TINYINT UNSIGNED NOT NULL COMMENT '@desc tx status\n@values 0: pending | 1: sent to chain | 2: success | 3: failed',
            error_reason VARCHAR(1024) NULL COMMENT '@desc error reason',
            created_at DATETIME NOT NULL COMMENT '@desc created time',
            updated_at DATETIME NOT NULL COMMENT '@desc updated time',
            PRIMARY KEY (id),
            UNIQUE INDEX tx_sig_uk (tx_sig ASC) VISIBLE,
            UNIQUE INDEX tx_order_uk (tx_order_type ASC, tx_order_id ASC) VISIBLE,
            UNIQUE INDEX slot_uk (slot ASC, slot_index ASC) VISIBLE,
            INDEX tx_status_idx (status ASC) VISIBLE)`);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.query('DROP TABLE transactions');
        }
}

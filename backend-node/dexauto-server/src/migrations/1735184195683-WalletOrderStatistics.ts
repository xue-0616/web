import { MigrationInterface, QueryRunner } from 'typeorm';

export class WalletOrderStatistics1735184195683 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE wallet_order_statistics
        (
            id uuid,
            wallet_id uuid NOT NULL,
            token_addr bytea NOT NULL,
            buy_txs_count bigint NOT NULL,
            sell_txs_count bigint NOT NULL,
            total_txs_count bigint NOT NULL,
            buy_amount_usd numeric NOT NULL,
            sell_amount_usd numeric NOT NULL,
            buy_normalized_amount numeric NOT NULL,
            sell_normalized_amount numeric NOT NULL,
            realized_profit numeric NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT wallet_uk UNIQUE (wallet_id, token_addr)
        )`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS wallet_order_statistics`);
    }
}

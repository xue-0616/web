import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1737704707442 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS order_user_token_idx
            ON trading_orders USING btree
            (user_id ASC NULLS LAST, token_mint ASC NULLS LAST)
            WITH (deduplicate_items=True)
            TABLESPACE pg_default`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS order_user_token_idx`);
    }
}

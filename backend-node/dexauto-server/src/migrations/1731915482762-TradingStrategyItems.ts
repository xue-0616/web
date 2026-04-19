import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingStrategyItems1731915482762 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS trading_strategy_items
        (
            id uuid NOT NULL,
            strategy_id uuid NOT NULL,
            item_type smallint NOT NULL,
            trigger numeric NOT NULL,
            sell_rate numeric NOT NULL,
            is_alive boolean NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT trading_strategy_items_pkey PRIMARY KEY (id)
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS strategy_idx
        ON trading_strategy_items USING btree
        (strategy_id ASC NULLS LAST)
        WITH (deduplicate_items=True)
        TABLESPACE pg_default`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.id IS '@desc trading strategy item id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.strategy_id IS '@desc strategy id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.item_type IS '@desc item type
@values 0 stop loss | 1 take profit'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.trigger IS '@desc trigger'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.sell_rate IS '@desc sell rate when trigger the trigger'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.is_alive IS '@desc is alive'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategy_items.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS trading_strategy_items`);
    }
}

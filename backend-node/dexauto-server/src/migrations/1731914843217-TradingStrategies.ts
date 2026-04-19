import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingStrategies1731914843217 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE trading_strategies
        (
            id uuid,
            user_id uuid NOT NULL,
            name character varying(32) NOT NULL,
            is_alive boolean NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT trading_strategies_pkey PRIMARY KEY (id)
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS user_idx
            ON trading_strategies USING btree
            (user_id ASC NULLS LAST)
            WITH (deduplicate_items=True)
            TABLESPACE pg_default`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.id IS '@desc trading strategy id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.user_id IS '@desc user id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.name IS '@desc strategy name'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.is_alive IS '@desc is the strategy alive'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_strategies.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS trading_strategies`);
    }
}

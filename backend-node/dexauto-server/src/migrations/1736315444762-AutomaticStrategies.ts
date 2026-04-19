import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategies1736315444762 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE automatic_strategies
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            name character varying(32) NOT NULL,
            monitor_addresses jsonb NOT NULL,
            address_subs jsonb NOT NULL,
            triggers jsonb NOT NULL,
            auto_trades jsonb NOT NULL,
            auto_trade_exec_count bigint NOT NULL,
            auto_trade_status smallint NOT NULL,
            is_sys_notify_on boolean NOT NULL,
            notify_exec_count bigint NOT NULL,
            status smallint NOT NULL,
            start_at timestamp without time zone NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT automatic_strategies_pkey PRIMARY KEY (id)
        )`);
        await queryRunner.query(`
        CREATE INDEX automatic_strategy_user_idx
        ON automatic_strategies USING btree
        (user_id ASC NULLS LAST, status)
        WITH (deduplicate_items=True)
    `);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE automatic_strategies`);
    }
}

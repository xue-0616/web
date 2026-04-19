import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategyEvents1736676548077 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE automatic_strategy_events
        (
            id uuid,
            strategy_id uuid NOT NULL,
            token_mint bytea NOT NULL,
            token_symbol character varying(32) NOT NULL,
            token_icon character varying(1024) NOT NULL,
            trigger_index integer NOT NULL,
            trigger_event jsonb NOT NULL,
            token_usd_price numeric NOT NULL,
            notify_id uuid,
            auto_trade_ids uuid[],
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            PRIMARY KEY (id)
        )
    `);
        await queryRunner.query(`
        CREATE INDEX auto_strategy_event_strategy_idx
            ON automatic_strategy_events USING btree
            (strategy_id)
            WITH (deduplicate_items=True)
    `);
        await queryRunner.query(`
        CREATE INDEX auto_strategy_event_token_idx
            ON automatic_strategy_events USING btree
            (token_mint)
            WITH (deduplicate_items=True)
    `);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        DROP TABLE automatic_strategy_events
    `);
    }
}

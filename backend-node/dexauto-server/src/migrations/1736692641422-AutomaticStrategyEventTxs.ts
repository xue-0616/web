import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategyEventTxs1736692641422 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE automatic_strategy_event_txs
        (
            id uuid,
            strategy_id uuid NOT NULL,
            event_id uuid NOT NULL,
            tx_id bytea NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT automatic_strategy_item_tx_uk UNIQUE (strategy_id, tx_id)
        )
    `);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        DROP TABLE automatic_strategy_event_txs
    `);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategyEventTxs1737689270929 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE IF EXISTS automatic_strategy_event_txs ADD COLUMN trigger_index integer`);
        await queryRunner.query(`
        ALTER TABLE IF EXISTS automatic_strategy_event_txs ADD COLUMN token_mint bytea`);
        await queryRunner.query(`
        ALTER TABLE IF EXISTS automatic_strategy_event_txs DROP CONSTRAINT IF EXISTS automatic_strategy_item_tx_uk`);
        await queryRunner.query(`
        ALTER TABLE IF EXISTS automatic_strategy_event_txs
        ADD CONSTRAINT automatic_strategy_item_tx_uk UNIQUE (strategy_id, trigger_index, token_mint, tx_id);
    `);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_event_txs DROP CONSTRAINT IF EXISTS automatic_strategy_item_tx_uk`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_event_txs DROP COLUMN trigger_index`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_event_txs DROP COLUMN token_mint`);
    }
}

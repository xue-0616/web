import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategyEvents1738998578765 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    ADD COLUMN auto_trades jsonb`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    ADD COLUMN auto_trade_status smallint`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    ADD COLUMN auto_trade_reserved_normalized_amount numeric`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    DROP COLUMN auto_trades`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    DROP COLUMN auto_trade_status`);
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    DROP COLUMN auto_trade_reserved_normalized_amount`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategyEvents1739349649339 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    ADD COLUMN auto_trade_reserved_amount bigint`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategy_events
    DROP COLUMN auto_trade_reserved_amount`);
    }
}

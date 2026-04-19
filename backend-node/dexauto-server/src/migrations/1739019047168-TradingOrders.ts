import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1739019047168 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
    RENAME out_amount TO threshold_amount;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
    RENAME out_normalized_amount TO threshold_normalized_amount`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
    RENAME threshold_amount TO out_amount;`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
    RENAME threshold_normalized_amount TO out_normalized_amount`);
    }
}

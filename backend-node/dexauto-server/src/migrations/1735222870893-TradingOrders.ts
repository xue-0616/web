import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1735222870893 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN pool DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN slippage DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN priority_fee DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN bribery_amount DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN is_anti_mev DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN sol_mint DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN token_mint DROP NOT NULL`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN pool SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN slippage SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN priority_fee SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN bribery_amount SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN is_anti_mev SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN sol_mint SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ALTER COLUMN token_mint SET NOT NULL`);
    }
}

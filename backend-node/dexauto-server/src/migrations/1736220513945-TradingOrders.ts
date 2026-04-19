import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1736220513945 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ADD COLUMN confirmed_time timestamp without time zone;`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders DROP COLUMN IF EXISTS confirmed_time;`);
    }
}

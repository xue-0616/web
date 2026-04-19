import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1735882517668 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders ADD COLUMN wallet_id uuid;`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders DROP COLUMN IF EXISTS wallet_id;`);
    }
}

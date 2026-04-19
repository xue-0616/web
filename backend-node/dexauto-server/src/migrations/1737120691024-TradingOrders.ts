import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1737120691024 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
            ADD COLUMN remote_id uuid`);
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
            ADD CONSTRAINT remote_id_uk UNIQUE (remote_id)`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders DROP COLUMN remote_id`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingOrders1739354558792 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders DROP CONSTRAINT IF EXISTS remote_id_uk;`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS trading_orders
            ADD CONSTRAINT remote_id_uk UNIQUE (remote_id);`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingSettings1739511247990 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`
            UPDATE trading_settings 
            SET slippage = 0.3,
                priority_fee = 5000000,
                bribery_amount = 10000000,
                is_mev_enabled = false
        `);
    }
    async down(queryRunner: any): Promise<void> { }
}

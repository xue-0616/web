import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wallets1735625473061 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets RENAME COLUMN total_txs_count TO trading_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN deposit_txs_count bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN withdraw_txs_count bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN transfer_txs_count bigint NOT NULL DEFAULT 0`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets RENAME COLUMN trading_txs_count TO total_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN deposit_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN withdraw_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN transfer_txs_count`);
    }
}

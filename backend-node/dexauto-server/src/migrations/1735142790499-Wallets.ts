import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wallets1735142790499 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN buy_txs_count bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN sell_txs_count bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN total_txs_count bigint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN total_buy_amount_usd numeric NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN total_sell_amount_usd numeric NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN total_deposit_amount_usd numeric NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN total_withdraw_amount_usd numeric NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets ADD COLUMN realized_profit_usd numeric NOT NULL DEFAULT 0`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN buy_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN sell_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN total_txs_count`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN total_buy_amount_usd`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN total_sell_amount_usd`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN total_deposit_amount_usd`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN total_withdraw_amount_usd`);
        await queryRunner.query(`ALTER TABLE IF EXISTS wallets DROP COLUMN realized_profit_usd`);
    }
}

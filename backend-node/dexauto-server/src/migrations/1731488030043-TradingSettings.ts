import { MigrationInterface, QueryRunner } from 'typeorm';

export class TradingSettings1731488030043 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS trading_settings 
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            chain smallint NOT NULL,
            chain_id bigint,
            is_mev_enabled boolean NOT NULL,
            slippage numeric NOT NULL,
            priority_fee bigint NOT NULL,
            bribery_amount bigint NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT trading_settings_pkey PRIMARY KEY (id),
            CONSTRAINT user_uk UNIQUE NULLS NOT DISTINCT (user_id, chain, chain_id)
        )`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.id IS '@desc setting id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.user_id IS '@desc user id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.chain IS '@desc chain\n@values 0 evm | 1 solana'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.chain_id IS '@desc chain id'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.slippage IS '@desc slippage'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.priority_fee IS '@desc priority fee'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.bribery_amount IS '@desc bribery amount'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN trading_settings.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE trading_settings`);
    }
}

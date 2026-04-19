import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wallets1730820838363 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS wallets
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            index smallint NOT NULL,
            chain smallint NOT NULL,
            address bytea NOT NULL,
            op_key bytea NOT NULL,
            alias character varying(32) COLLATE pg_catalog."default",
            is_default boolean NOT NULL,
            is_active boolean NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT wallets_pkey PRIMARY KEY (id),
            CONSTRAINT user_idx_uk UNIQUE (user_id, chain, index),
            CONSTRAINT address_uk UNIQUE (chain, address),
            CONSTRAINT op_key_uk UNIQUE (chain, op_key)
        )`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.id IS '@desc wallet id'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.user_id IS '@desc user id'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.index IS '@desc index of derived wallet, start from 1'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.chain IS '@desc wallet chain\n@values 0 evm | 1 solana'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.address IS '@desc wallet address'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.op_key IS '@desc wallet op key address'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.alias IS '@desc wallet alias'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.is_default IS '@desc is default wallet. one user, one default wallet.'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.is_active IS '@desc is the wallet active'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN wallets.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS wallets`);
    }
}

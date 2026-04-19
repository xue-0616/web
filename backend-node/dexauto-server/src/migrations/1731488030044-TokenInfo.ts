import { MigrationInterface, QueryRunner } from 'typeorm';

export class TokenInfo1731488030044 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS token_info 
        (
            id uuid NOT NULL,
            mint_address varchar NOT NULL,
            symbol varchar,
            name varchar,
            icon varchar,
            supply numeric,
            decimals smallint,
            socials jsonb DEFAULT '{}',
            audit jsonb DEFAULT '{}',
            metadata_uri varchar,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT token_info_pkey PRIMARY KEY (id),
            CONSTRAINT mint_address_uk UNIQUE (mint_address)
        )`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.id IS '@desc token info id'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.mint_address IS '@desc token mint address'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.symbol IS '@desc token symbol'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.name IS '@desc token name'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.icon IS '@desc token icon url'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.supply IS '@desc token total supply'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.decimals IS '@desc token decimals'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.socials IS '@desc social media links in json format'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.audit IS '@desc token audit info in json format'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.metadata_uri IS '@desc token metadata uri'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN token_info.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE token_info`);
    }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class Favorite1733838451589 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS favorite
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            pool_address bytea NOT NULL,
            chain smallint NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            deleted_at timestamp without time zone,
            CONSTRAINT favorite_pkey PRIMARY KEY (id),
            CONSTRAINT user_idx_us UNIQUE (user_id, chain, pool_address)
        )`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.id IS '@desc favorite id'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.user_id IS '@desc user id'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.pool_address IS '@desc pool address'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.chain IS '@desc chain\n@values 0 evm | 1 solana'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.updated_at IS '@desc updated time'`);
        await queryRunner.query(`COMMENT ON COLUMN favorite.deleted_at IS '@desc deleted time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS favorite`);
    }
}

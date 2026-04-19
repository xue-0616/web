import { MigrationInterface, QueryRunner } from 'typeorm';

export class Users1730794762811 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS users
        (
            id uuid NOT NULL,
            bound_chain smallint NOT NULL,
            bound_addr bytea NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT users_pkey PRIMARY KEY (id),
            CONSTRAINT bound_uk UNIQUE (bound_chain, bound_addr)
        )`);
        await queryRunner.query(`COMMENT ON COLUMN users.id IS '@desc user id'`);
        await queryRunner.query(`COMMENT ON COLUMN users.bound_chain IS '@desc bound chain\n@values 0 evm | 1 solana'`);
        await queryRunner.query(`COMMENT ON COLUMN users.bound_addr IS '@desc bound addr'`);
        await queryRunner.query(`COMMENT ON COLUMN users.created_at IS '@desc created time'`);
        await queryRunner.query(`COMMENT ON COLUMN users.updated_at IS '@desc updated time'`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE users`);
    }
}

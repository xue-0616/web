import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifies1735299887961 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS notifies
        (
            id uuid NOT NULL,
            user_id uuid NOT NULL,
            notify_type smallint NOT NULL,
            data json NOT NULL,
            title text NOT NULL,
            body text NOT NULL,
            created_at timestamp without time zone NOT NULL,
            updated_at timestamp without time zone NOT NULL,
            CONSTRAINT notifies_pkey PRIMARY KEY (id)
        )`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS notifies_user_id_idx ON notifies (user_id, notify_type)`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS notifies`);
    }
}

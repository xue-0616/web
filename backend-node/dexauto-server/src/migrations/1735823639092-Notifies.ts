import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifies1735823639092 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS public.notifies DROP COLUMN IF EXISTS title`);
        await queryRunner.query(`ALTER TABLE IF EXISTS public.notifies DROP COLUMN IF EXISTS body`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS public.notifies ADD COLUMN IF EXISTS title text NOT NULL`);
        await queryRunner.query(`ALTER TABLE IF EXISTS public.notifies ADD COLUMN IF EXISTS body text NOT NULL`);
    }
}

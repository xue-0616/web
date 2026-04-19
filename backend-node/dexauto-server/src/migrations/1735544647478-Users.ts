import { MigrationInterface, QueryRunner } from 'typeorm';

export class Users1735544647478 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS users ADD COLUMN language character varying(32)`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS users DROP COLUMN language`);
    }
}

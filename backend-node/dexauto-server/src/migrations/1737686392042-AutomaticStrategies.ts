import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutomaticStrategies1737686392042 implements MigrationInterface {
    async up(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategies
    ADD COLUMN trigger_start_at timestamp without time zone`);
    }
    async down(queryRunner: any): Promise<void> {
        await queryRunner.query(`ALTER TABLE IF EXISTS automatic_strategies
    DROP COLUMN trigger_start_at`);
    }
}

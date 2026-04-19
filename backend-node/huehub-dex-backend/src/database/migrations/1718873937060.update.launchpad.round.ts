import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateLaunchpadRounds1718873937060 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateLaunchpadRounds1718873937060';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('launchpad_rounds', 'uk_launchpad_rounds');
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}

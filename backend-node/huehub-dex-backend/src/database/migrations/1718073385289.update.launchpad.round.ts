import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateLaunchpadRound1718073385289 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateLaunchpadRound1718073385289';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('launchpad_rounds', new TableColumn({
                name: 'whitelist_link',
                type: 'varchar',
                length: '255',
                comment: ' whitelist link',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('launchpad_rounds', 'whitelist_link');
        }
}

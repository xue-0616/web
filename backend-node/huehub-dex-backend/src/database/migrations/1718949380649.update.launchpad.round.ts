import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateLaunchpadRound1718949380649 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateLaunchpadRound1718949380649';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('launchpad_rounds', new TableColumn({
                name: 'round_rate',
                type: 'varchar',
                length: '5',
                comment: 'round rate',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('launchpad_rounds', 'round_rate');
        }
}

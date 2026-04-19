import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeployment1712906602267 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeployment1712906602267';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'start_block', new TableColumn({
                name: 'relative_start_block',
                type: 'BIGINT',
                unsigned: true,
                comment: 'relative block height start mint',
                isNullable: false,
            }));
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'ckb_time_lock_address',
                type: 'varchar',
                length: '80',
                comment: '@desc ckb time lock address',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'relative_start_block', new TableColumn({
                name: 'start_block',
                type: 'BIGINT',
                unsigned: true,
                comment: 'Interval deployment block height block start mint',
                isNullable: false,
            }));
            await queryRunner.dropColumn('deployment_tokens', 'ckb_time_lock_address');
        }
}

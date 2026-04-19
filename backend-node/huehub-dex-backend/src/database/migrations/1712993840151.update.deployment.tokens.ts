import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentToken1712993840151 implements MigrationInterface {
    name!: 'UpdateDeploymentToken1712993840151';
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'deploy_fee_amount',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'deploy_fee_amount',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('deployment_tokens', 'deploy_fee_amount');
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1713016058365 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1713016058365';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'deployed_time', new TableColumn({
                name: 'deployed_time',
                type: 'DATETIME',
                comment: 'deployment ckb tx hash',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'deployed_time', new TableColumn({
                name: 'deployed_time',
                type: 'DATETIME',
                comment: 'deployment ckb tx hash',
                isNullable: false,
            }));
        }
}

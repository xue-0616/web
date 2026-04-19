import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1712833400087 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1712833400087';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('deployment_tokens', 'prepare_deployment_tx');
            await queryRunner.dropColumn('deployment_tokens', 'prepare_deployment_tx_hash');
            await queryRunner.changeColumn('deployment_tokens', 'deployment_tx', new TableColumn({
                name: 'deployment_tx',
                type: 'blob',
                comment: '@desc deployment transaction',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'deployment_tx', new TableColumn({
                name: 'deployment_tx',
                type: 'VARBINARY',
                length: '5000',
                comment: '@desc deployment transaction',
                isNullable: false,
            }));
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'prepare_deployment_tx',
                type: 'VARBINARY',
                length: '5000',
                comment: '@desc prepare deployment transaction',
                isNullable: true,
            }));
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'prepare_deployment_tx_hash',
                type: 'BINARY',
                length: '32',
                comment: '@desc prepare deployment ckb tx hash',
                isNullable: true,
            }));
        }
}

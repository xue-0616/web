import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1713016058278 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1713016058278';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'deployment_ckb_tx_hash', new TableColumn({
                name: 'deployment_ckb_tx_hash',
                type: 'BINARY',
                length: '32',
                comment: 'deployment ckb tx hash',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'deployment_ckb_tx_hash', new TableColumn({
                name: 'deployment_ckb_tx_hash',
                type: 'BINARY',
                length: '32',
                comment: 'deployment ckb tx hash',
                isNullable: false,
            }));
        }
}

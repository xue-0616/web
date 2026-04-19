import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1713014058379 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1713014058379';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'prepare_deployment_ckb_tx_hash', new TableColumn({
                name: 'prepare_deployment_ckb_tx_hash',
                type: 'BINARY',
                length: '32',
                comment: 'prepare deployment ckb tx hash',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'prepare_deployment_ckb_tx_hash', new TableColumn({
                name: 'prepare_deployment_ckb_tx_hash',
                type: 'BINARY',
                length: '32',
                comment: 'prepare deployment ckb tx hash',
                isNullable: false,
            }));
        }
}

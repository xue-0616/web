import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1712892843360 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1712892843360';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'btc_tx_block_height',
                type: 'BIGINT',
                comment: '@desc tx confirmed block height ',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('deployment_tokens', 'btc_tx_block_height');
        }
}

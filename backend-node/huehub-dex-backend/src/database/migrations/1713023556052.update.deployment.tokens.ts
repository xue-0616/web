import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1713023556052 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1713023556052';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'btc_tx_block_height', new TableColumn({
                name: 'btc_tx_block_height',
                type: 'BIGINT',
                unsigned: true,
                comment: ' tx confirmed block height',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'btc_tx_block_height', new TableColumn({
                name: 'btc_tx_block_height',
                type: 'BIGINT',
                comment: ' tx confirmed block height',
                isNullable: true,
            }));
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeploymentTokens1713024933492 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeploymentTokens1713024933492';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('tokens', 'deployment_token_id', new TableColumn({
                name: 'deployment_token_id',
                type: 'bigint',
                unsigned: true,
                comment: ' bind_deploy_token_id',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('tokens', 'deployment_token_id', new TableColumn({
                name: 'deployment_token_id',
                type: 'bigint',
                comment: 'bind_deploy_token_id',
                isNullable: true,
            }));
        }
}

import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class UpdateTokens1712646098183 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1712646098183';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'deployment_token_id',
                type: 'bigint',
                comment: 'bind_deploy_token_id',
                isNullable: true,
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'lowercase_symbol',
                type: 'varchar',
                comment: 'lowercase symbol',
                isNullable: true,
            }));
            await queryRunner.createIndex('tokens', new TableIndex({
                name: 'u_symbol',
                columnNames: [`lowercase_symbol`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('tokens', 'u_symbol');
            await queryRunner.dropColumn('tokens', 'lowercase_symbol');
            await queryRunner.dropColumn('tokens', 'deployment_token_id');
        }
}

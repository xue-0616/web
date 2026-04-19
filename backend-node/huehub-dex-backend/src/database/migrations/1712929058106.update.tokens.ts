import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class UpdateTokens1712929058106 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1712929058106';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'last_sales',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'Transaction volume',
                isNullable: false,
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'last_volume',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'Transaction volume',
                isNullable: false,
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'status',
                type: 'tinyint',
                isNullable: false,
                comment: 'tokens status 0:listing asset,1:pending asset,2:delist asset',
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'deployed_time',
                type: 'bigint',
                unsigned: true,
                comment: 'deployed time',
                isNullable: false,
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'last_holders',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                isNullable: false,
                comment: 'last number of holders',
            }));
            await queryRunner.createIndex('tokens', new TableIndex({
                name: 'u_token_status',
                columnNames: ['status'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('tokens', 'last_volume');
            await queryRunner.dropColumn('tokens', 'last_sales');
            await queryRunner.dropColumn('tokens', 'last_holders');
            await queryRunner.dropColumn('tokens', 'status');
            await queryRunner.dropColumn('tokens', 'deployed_time');
            await queryRunner.dropIndex('tokens', 'u_token_status');
        }
}

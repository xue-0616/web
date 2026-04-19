import { TableColumn, TableIndex } from 'typeorm';

export class UpdateCustomAuthAccountChianId1685932789398 {
    constructor() {
        this.name = 'UpdateCustomAuthAccountChianId1685932789398';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('custom_auth_accounts', new TableColumn({
                name: 'chain_id',
                type: 'bigint',
                isNullable: true,
                comment: '@desc address deploy chain id',
            }));
            await queryRunner.createIndex('custom_auth_accounts', new TableIndex({
                name: 'chain_id_index',
                columnNames: ['chain_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('custom_auth_accounts', 'chain_id');
            await queryRunner.dropIndex('custom_auth_accounts', 'chain_id_index');
        }
}

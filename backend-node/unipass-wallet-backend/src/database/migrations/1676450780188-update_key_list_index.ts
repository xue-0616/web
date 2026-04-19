import { TableColumn, TableIndex } from 'typeorm';

export class UpdateKeyListIndex1676450780188 {
    constructor() {
        this.name = 'UpdateKeyListIndex1676450780188';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('key_list', 'address', new TableColumn({
                name: 'address',
                type: 'binary',
                length: '20',
                isNullable: false,
                comment: '@desc master key address',
            }));
            await queryRunner.dropIndex('key_list', 'INDEX_ACCOUNT_ID');
            await queryRunner.createIndex('key_list', new TableIndex({
                name: 'INDEX_ACCOUNT_ID',
                columnNames: ['account_id', 'address'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'address');
            await queryRunner.dropIndex('key_list', 'INDEX_ACCOUNT_ID');
        }
}

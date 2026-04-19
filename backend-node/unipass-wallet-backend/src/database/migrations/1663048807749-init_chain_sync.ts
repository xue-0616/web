import { Table, TableIndex } from 'typeorm';

export class InitChainSync1663048807749 {
    constructor() {
        this.name = 'InitChainSync1663048807749';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'chain_sync',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc chain_sync tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'int',
                        comment: '@desc linked account id',
                        isNullable: false,
                    },
                    {
                        name: 'meta_nonce',
                        type: 'int',
                        comment: '@desc sync tx meta nonce',
                        isNullable: false,
                    },
                    {
                        name: 'transaction_json',
                        type: 'json',
                        isNullable: false,
                        comment: '@desc sync tx json object',
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }), true);
            await queryRunner.createIndex('chain_sync', new TableIndex({
                name: 'INDEX_ACCOUNT_META_NONCE',
                columnNames: ['account_id', 'meta_nonce'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('chain_sync');
            await queryRunner.dropIndex('chain_sync', 'INDEX_ACCOUNT_META_NONCE');
        }
}

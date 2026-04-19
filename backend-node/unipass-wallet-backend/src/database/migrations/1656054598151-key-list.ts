import { Table, TableIndex } from 'typeorm';

export class KeyList1656054598151 {
    constructor() {
        this.name = 'KeyList1656054598151';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'key_list',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc key_list tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'int',
                        comment: '@desc linked account id',
                        isNullable: false,
                    },
                    {
                        name: 'address',
                        type: 'binary',
                        length: '20',
                        isUnique: true,
                        isNullable: false,
                        comment: '@desc master key address',
                    },
                    {
                        name: 'keystore',
                        type: 'longblob',
                        isNullable: false,
                        comment: '@desc master key key store',
                    },
                    {
                        name: 'password',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: '@desc hash(master key address)',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        comment: '@desc master key used status， 0: pending, 1: committed， 2: failed ',
                        isNullable: true,
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
            await queryRunner.createIndex('key_list', new TableIndex({
                name: 'INDEX_ACCOUNT_ID',
                columnNames: ['account_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('key_list');
            await queryRunner.dropIndex('key_list', 'INDEX_ACCOUNT_ID');
        }
}

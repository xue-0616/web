import { Table, TableIndex } from 'typeorm';

export class InitDeletedAccounts1684291962193 {
    constructor() {
        this.name = 'InitDeletedAccounts1684291962193';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'deleted_accounts',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'binary',
                        length: '20',
                        isNullable: false,
                        comment: '@desc delete source',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        isNullable: true,
                        comment: '@desc 0:used 1:deleted',
                    },
                    {
                        name: 'source',
                        type: 'varchar',
                        length: '32',
                        isNullable: false,
                        comment: '@desc delete source',
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
            await queryRunner.createIndex('deleted_accounts', new TableIndex({
                name: 'INDEX_DELETED',
                columnNames: ['address', 'source'],
                isUnique: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('deleted_accounts');
            await queryRunner.dropIndex('deleted_accounts', 'INDEX_DELETED');
        }
}

import { Table, TableIndex } from 'typeorm';

export class InitCustomAuthAccounts1683801192529 {
    constructor() {
        this.name = 'InitCustomAuthAccounts1683801192529';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'custom_auth_accounts',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc account table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'binary',
                        length: '20',
                        isNullable: true,
                        comment: '@desc account address',
                    },
                    {
                        name: 'sub',
                        type: 'varchar',
                        length: '64',
                        comment: '@desc account uuid',
                        isNullable: false,
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '80',
                        comment: '@desc email address',
                        isNullable: true,
                    },
                    {
                        name: 'user_info',
                        type: 'json',
                        comment: '@desc user info',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        comment: '@desc On-chain status，0: generate 1: pending， 2: committed',
                        isNullable: false,
                    },
                    {
                        name: 'app_id',
                        type: 'varchar',
                        length: '64',
                        comment: '@desc account register app_id',
                        isNullable: false,
                    },
                    {
                        name: 'keyset_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc account keyset hash',
                    },
                    {
                        name: 'init_keyset_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc account keyset hash',
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
            await queryRunner.createIndex('custom_auth_accounts', new TableIndex({
                name: 'custom_auth_uq_index',
                isUnique: true,
                columnNames: ['app_id', 'sub'],
            }));
            await queryRunner.createIndex('custom_auth_accounts', new TableIndex({
                name: 'address_index',
                columnNames: ['address'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('custom_auth_accounts');
            await queryRunner.dropIndex('custom_auth_accounts', 'custom_auth_uq_index');
            await queryRunner.dropIndex('custom_auth_accounts', 'address_index');
        }
}

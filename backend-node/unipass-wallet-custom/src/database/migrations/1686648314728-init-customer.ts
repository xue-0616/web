import { Table, TableIndex } from 'typeorm';

export class InitCustomer1686648314728 {
    constructor() {
        this.name = 'InitCustomer1686648314728';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'customer',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc customer table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'gas_tank_balance',
                        type: 'decimal',
                        precision: 50,
                        scale: 0,
                        default: false,
                        comment: '@desc gas tank balance',
                    },
                    {
                        name: 'customer_info',
                        type: 'json',
                        isNullable: true,
                        comment: '@desc customer Info',
                    },
                    {
                        name: 'sub',
                        type: 'varchar',
                        length: '64',
                        isNullable: false,
                        comment: '@desc raw hash data',
                    },
                    {
                        name: 'provider',
                        type: 'tinyint',
                        isNullable: false,
                        comment: '@desc 0:google 1:other',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: '@desc 0: Under review; 1: In use; 2: Frozen',
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
            await queryRunner.createIndex('customer', new TableIndex({
                name: 'INDEX_SUB_PROVIDER_ID',
                columnNames: ['provider', 'sub'],
                isUnique: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('customer');
            await queryRunner.dropIndex('customer', 'INDEX_SUB_PROVIDER_ID');
        }
}

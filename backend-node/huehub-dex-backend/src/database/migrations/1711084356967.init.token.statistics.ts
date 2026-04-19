import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class TokenStatistics1711084356967 implements MigrationInterface {
    constructor() {
        this.name = 'TokenStatistics1711084356967';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'token_statistics',
                columns: [
                    {
                        name: 'token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind token id',
                    },
                    {
                        name: 'sales',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Number of transactions',
                    },
                    {
                        name: 'holders',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'number of holders',
                    },
                    {
                        name: 'volume',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        comment: 'Transaction volume',
                        isNullable: false,
                    },
                    {
                        name: 'floor_price',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        comment: 'The floor price refers to the current lowest price for the inscription order.',
                        isNullable: false,
                    },
                    {
                        name: 'btc_usd_price',
                        type: 'decimal',
                        length: '20,4',
                        comment: 'The current USD price corresponding to btc.',
                        isNullable: false,
                    },
                    {
                        name: 'market_cap',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        comment: 'Current market capitalization.',
                        isNullable: false,
                    },
                    {
                        name: 'time',
                        type: 'bigint',
                        comment: 'Current recording time stamp.',
                        isNullable: false,
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                ],
            }), true);
            await queryRunner.createIndex('token_statistics', new TableIndex({
                name: 'primary_key',
                columnNames: ['time', `token_id`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('token_statistics');
            await queryRunner.dropIndex('token_statistics', 'primary_key');
        }
}

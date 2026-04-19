import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class Statistics1715344936836 implements MigrationInterface {
    constructor() {
        this.name = 'Statistics1715344936836';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'statistics',
                columns: [
                    {
                        name: 'collection_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind collection id',
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
                        name: 'btc_usd_price',
                        type: 'decimal',
                        length: '20,4',
                        comment: 'The current USD price corresponding to btc.',
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
            await queryRunner.createPrimaryKey('statistics', ['time', `collection_id`]);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('statistics');
        }
}

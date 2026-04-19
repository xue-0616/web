import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitOrders1711088695090 implements MigrationInterface {
    constructor() {
        this.name = 'InitOrders1711088695090';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'orders',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'items table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'buyer_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'Buyer address',
                    },
                    {
                        name: 'btc_tx',
                        type: 'VARBINARY',
                        length: '5000',
                        isNullable: false,
                        comment: 'btc sig tx',
                    },
                    {
                        name: 'ckb_tx',
                        type: 'VARBINARY',
                        length: '5000',
                        isNullable: false,
                        comment: 'ckb tx',
                    },
                    {
                        name: 'btc_tx_hash',
                        type: 'BINARY',
                        length: '32',
                        isNullable: true,
                        comment: 'btc tx hash',
                    },
                    {
                        name: 'ckb_tx_hash',
                        type: 'BINARY',
                        length: '32',
                        isNullable: true,
                        comment: 'ckb tx hash',
                    },
                    {
                        name: 'ckb_tx_fee',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: true,
                        comment: 'ckb tx fee',
                    },
                    {
                        name: 'btc_tx_fee',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: true,
                        comment: 'btc tx fee',
                    },
                    {
                        name: 'order_fee',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'order fee',
                    },
                    {
                        name: 'type',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'order type 0:buy order 1:cancel order',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'order status 0:init,1:btc_pending, 2:ckb_pending,3:btc_complete,4:btc_failed,5:ckb_complete,6:ckb_failed',
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
            await queryRunner.createIndex('orders', new TableIndex({
                name: 'u_order_key',
                columnNames: ['btc_tx_hash'],
                isUnique: true,
            }));
            await queryRunner.createIndex('orders', new TableIndex({
                name: 'buyer_address',
                columnNames: ['buyer_address', 'type'],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('orders');
            await queryRunner.dropIndex('orders', 'buyer_address');
            await queryRunner.dropIndex('orders', 'u_order_key');
        }
}

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class Items1715344908060 implements MigrationInterface {
    constructor() {
        this.name = 'Items1715344908060';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'items',
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
                        name: 'collection_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind collection id',
                    },
                    {
                        name: 'dobs_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind dobs id',
                    },
                    {
                        name: 'order_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: true,
                        comment: 'bind token id',
                    },
                    {
                        name: 'seller_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'Seller address',
                    },
                    {
                        name: 'buyer_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: true,
                        comment: 'Buyer address',
                    },
                    {
                        name: 'tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'Sell utxo txid',
                    },
                    {
                        name: 'btc_value',
                        type: 'int',
                        isNullable: false,
                        comment: 'Sell utxo value',
                    },
                    {
                        name: 'index',
                        type: 'int',
                        isNullable: false,
                        comment: 'Sell utxo index',
                    },
                    {
                        name: 'price',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Sell btc amount',
                    },
                    {
                        name: 'is_cancel',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: true,
                        comment: 'item is cancel',
                    },
                    {
                        name: 'psbt_sig',
                        type: 'blob',
                        isNullable: false,
                        comment: 'Sell psbt sig hash',
                    },
                    {
                        name: 'unsigned_psbt',
                        type: 'blob',
                        isNullable: false,
                        comment: 'Sell unsigned psbt',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'items status 0:init,1:pending,2:complete,3:cancel',
                    },
                    {
                        name: 'pening_time',
                        type: 'bigint',
                        isNullable: true,
                        comment: 'item pending time',
                    },
                    {
                        name: 'complete_time',
                        type: 'bigint',
                        isNullable: true,
                        comment: 'item complete time',
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
            await queryRunner.createIndex('items', new TableIndex({
                name: 'order_key',
                columnNames: ['order_id'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'u_utxo_key',
                columnNames: ['tx_hash', 'index'],
                isUnique: true,
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'k_seller',
                columnNames: ['seller_address'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'k_order',
                columnNames: ['order_id'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'k_dobs',
                columnNames: ['dobs_id'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'k_items_time',
                columnNames: ['created_at', 'collection_id'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('items', 'k_items_time');
            await queryRunner.dropIndex('items', 'k_dobs');
            await queryRunner.dropIndex('items', 'k_order');
            await queryRunner.dropIndex('items', 'k_seller');
            await queryRunner.dropIndex('items', 'u_utxo_key');
            await queryRunner.dropTable('items');
        }
}

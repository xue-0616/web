import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitItems1711086635479 implements MigrationInterface {
    constructor() {
        this.name = 'InitItems1711086635479';
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
                        name: 'token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind token id',
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
                        name: 'price_amount',
                        type: 'decimal',
                        length: '20,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Sell btc amount',
                    },
                    {
                        name: 'token_amount',
                        type: 'decimal',
                        length: '20,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Sell amount',
                    },
                    {
                        name: 'tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'Sell sudt txid',
                    },
                    {
                        name: 'index',
                        type: 'int',
                        isNullable: false,
                        comment: 'Sell udt index',
                    },
                    {
                        name: 'unsigned_psbt',
                        type: 'VARBINARY',
                        length: '1024',
                        isNullable: false,
                        comment: 'Sell unsigned psbt',
                    },
                    {
                        name: 'psbt_sig',
                        type: 'VARBINARY',
                        length: '255',
                        isNullable: false,
                        comment: 'Sell psbt sig hash',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'items status 0:init,1:pending,2:complete,3:cancel',
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
                name: 'u_token_key',
                columnNames: ['tx_hash', 'index'],
                isUnique: true,
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'seller_key',
                columnNames: ['seller_address'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'buyer_key',
                columnNames: ['buyer_address'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('items');
            await queryRunner.dropIndex('items', 'u_token_key');
            await queryRunner.dropIndex('items', 'buyer_key');
            await queryRunner.dropIndex('items', 'seller_key');
            await queryRunner.dropIndex('items', 'order_key');
        }
}

import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UpdateItemIndex1723102489882 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItemIndex1723102489882';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('items', 'buyer_key');
            await queryRunner.dropIndex('items', 'u_price_per_token');
            await queryRunner.createIndex('items', new TableIndex({
                name: 'idx_ti_st_is_pr',
                columnNames: ['token_id', 'status', 'is_cancel', 'price_per_token'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createIndex('items', new TableIndex({
                name: 'buyer_key',
                columnNames: ['buyer_address'],
            }));
            await queryRunner.createIndex('items', new TableIndex({
                name: 'u_price_per_token',
                columnNames: ['price_per_token'],
            }));
            await queryRunner.dropIndex('items', 'idx_ti_st_is_pr');
        }
}

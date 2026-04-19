import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UpdateItemsIndex1712061989590 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItemsIndex1712061989590';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createIndex('items', new TableIndex({
                name: 'u_price_per_token',
                columnNames: ['price_per_token'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('items', 'u_price_per_token');
        }
}

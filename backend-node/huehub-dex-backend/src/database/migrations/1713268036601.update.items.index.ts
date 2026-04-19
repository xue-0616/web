import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UpdateItemsIndex1713268036601 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItemsIndex1713268036601';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createIndex('items', new TableIndex({
                name: 'u_items_time',
                columnNames: ['created_at', 'token_id'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('items', 'u_items_time');
        }
}

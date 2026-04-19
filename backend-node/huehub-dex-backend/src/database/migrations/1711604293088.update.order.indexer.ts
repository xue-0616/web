import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class UpdateOrderIndexer1711604293088 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateOrderIndexer1711604293088';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('orders', 'buyer_address');
            await queryRunner.createIndex('orders', new TableIndex({
                name: 'u_status',
                columnNames: ['status'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createIndex('orders', new TableIndex({
                name: 'buyer_address',
                columnNames: ['buyer_address', 'type'],
                isUnique: true,
            }));
            await queryRunner.dropIndex('orders', 'u_status');
        }
}

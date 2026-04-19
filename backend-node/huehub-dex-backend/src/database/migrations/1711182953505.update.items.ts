import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateItems1711182953505 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItems1711182953505';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('items', new TableColumn({
                name: 'price_per_token',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'btc price per token.',
                isNullable: false,
            }));
            await queryRunner.changeColumn('items', 'price_amount', new TableColumn({
                name: 'price',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                isNullable: false,
                comment: 'Sell btc amount',
            }));
            await queryRunner.changeColumn('items', 'token_amount', new TableColumn({
                name: 'token_amount',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                isNullable: false,
                comment: 'Sell token amount',
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('items', 'price_per_token');
            await queryRunner.changeColumn('items', 'price', new TableColumn({
                name: 'price_amount',
                type: 'decimal',
                length: '20,0',
                unsigned: true,
                isNullable: false,
                comment: 'Sell btc amount',
            }));
            await queryRunner.changeColumn('items', 'token_amount', new TableColumn({
                name: 'token_amount',
                type: 'decimal',
                length: '20,0',
                unsigned: true,
                isNullable: false,
                comment: 'Sell token amount',
            }));
        }
}

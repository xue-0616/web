import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTokenStatistic1711709975123 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokenStatistic1711709975123';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('token_statistics', 'floor_price', new TableColumn({
                name: 'floor_price',
                type: 'decimal',
                length: '50,8',
                unsigned: true,
                comment: 'btc price floor price_per_token.',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('token_statistics', 'floor_price', new TableColumn({
                name: 'floor_price',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'btc price per token.',
                isNullable: false,
            }));
        }
}

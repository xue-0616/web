import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTokenStatistic1711764681091 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokenStatistic1711764681091';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('token_statistics', 'market_cap', new TableColumn({
                name: 'market_cap',
                type: 'decimal',
                length: '50,8',
                unsigned: true,
                comment: 'Current market capitalization.',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('token_statistics', 'market_cap', new TableColumn({
                name: 'market_cap',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'Current market capitalization.',
                isNullable: false,
            }));
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTokens1713517707802 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1713517707802';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'floor_price',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'token floor price',
                isNullable: false,
            }));
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'market_cap',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'token market cap',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('tokens', 'floor_price');
            await queryRunner.dropColumn('tokens', 'market_cap');
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateItems1711709945993 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItems1711709945993';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('items', 'psbt_sig', new TableColumn({
                name: 'psbt_sig',
                type: 'blob',
                isNullable: false,
                comment: 'Sell psbt sig hash',
            }));
            await queryRunner.changeColumn('items', 'price_per_token', new TableColumn({
                name: 'price_per_token',
                type: 'decimal',
                length: '50,8',
                unsigned: true,
                comment: 'btc price per token.',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('items', 'psbt_sig', new TableColumn({
                name: 'psbt_sig',
                type: 'VARBINARY',
                length: '255',
                isNullable: false,
                comment: 'Sell psbt sig hash',
            }));
            await queryRunner.changeColumn('items', 'price_per_token', new TableColumn({
                name: 'price_per_token',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'btc price per token.',
                isNullable: false,
            }));
        }
}

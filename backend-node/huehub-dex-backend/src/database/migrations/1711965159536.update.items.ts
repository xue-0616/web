import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateItems1711965159536 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItems1711965159536';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('items', new TableColumn({
                name: 'btc_value',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'Btc value.',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('items', 'btc_value');
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTokens1713930070924 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1713930070924';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('tokens', 'floor_price', new TableColumn({
                name: 'floor_price',
                type: 'decimal',
                length: '50,8',
                unsigned: true,
                comment: 'token floor price',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}

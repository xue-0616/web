import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateBlinkShortCode1724811209576 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateBlinkShortCode1724811209576';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('blink_short_code', new TableColumn({
                name: 'domain',
                type: 'varchar',
                isNullable: true,
                comment: 'blink bind domain',
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('blink_short_code', 'domain');
        }
}

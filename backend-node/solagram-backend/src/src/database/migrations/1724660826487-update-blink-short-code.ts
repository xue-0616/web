import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class UpdateBlinkShortCode1724660826487 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateBlinkShortCode1724660826487';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('blink_short_code', 'short_code', new TableColumn({
                name: 'short_code',
                type: 'varchar',
                length: '64',
                isUnique: true,
                isNullable: false,
                comment: 'sort_code bind short code',
            }));
            await queryRunner.addColumn('blink_short_code', new TableColumn({
                name: 'id',
                type: 'bigint',
                unsigned: true,
                isPrimary: true,
                isGenerated: true,
                comment: 'blink_short_code table primary key',
                generationStrategy: 'increment',
            }));
            await queryRunner.createIndex('blink_short_code', new TableIndex({
                name: 'k_blink',
                columnNames: [`blink`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('blink_short_code', 'id');
            await queryRunner.changeColumn('blink_short_code', 'short_code', new TableColumn({
                name: 'short_code',
                type: 'varchar',
                length: '64',
                isUnique: true,
                isPrimary: true,
                isNullable: false,
                comment: 'sort_code bind short code',
            }));
            await queryRunner.dropIndex('blink_short_code', 'k_blink');
        }
}

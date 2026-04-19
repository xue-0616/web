import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateBlinkShortCode1724666285944 implements MigrationInterface {
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('blink_short_code', 'short_code', new TableColumn({
                name: 'short_code',
                type: 'varchar',
                length: '64',
                isUnique: true,
                isNullable: true,
                comment: 'sort_code bind short code',
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('blink_short_code', 'short_code', new TableColumn({
                name: 'short_code',
                type: 'varchar',
                length: '64',
                isUnique: true,
                isNullable: false,
                comment: 'sort_code bind short code',
            }));
        }
}

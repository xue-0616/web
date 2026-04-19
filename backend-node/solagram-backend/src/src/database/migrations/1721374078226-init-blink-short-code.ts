import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitBlinkShortCode1721374078226 implements MigrationInterface {
    constructor() {
        this.name = 'InitBlinkShortCode1721374078226';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'blink_short_code',
                columns: [
                    {
                        name: 'short_code',
                        type: 'varchar',
                        length: '64',
                        isUnique: true,
                        isPrimary: true,
                        isNullable: false,
                        comment: 'sort_code bind short code',
                    },
                    {
                        name: 'blink',
                        type: 'varchar',
                        length: '512',
                        isNullable: false,
                        comment: 'blink url',
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                ],
            }), true);
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('blink_short_code');
        }
}

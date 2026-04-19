import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitTgUser1724823919530 implements MigrationInterface {
    constructor() {
        this.name = 'InitTgUser1724823919530';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'tg_users',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'tg_users table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'user_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        isUnique: true,
                        comment: 'tg id for the user',
                    },
                    {
                        name: 'first_name',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'first name',
                    },
                    {
                        name: 'last_name',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'last name',
                    },
                    {
                        name: 'username',
                        type: 'varchar',
                        length: '160',
                        isNullable: true,
                        comment: 'username',
                    },
                    {
                        name: 'is_bot',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'user is bot: 0 - false, 1 - bot',
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
            await queryRunner.createIndex('tg_users', new TableIndex({
                name: 'k_username',
                columnNames: [`username`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('tg_users', 'k_username');
            await queryRunner.dropTable('tg_users');
        }
}

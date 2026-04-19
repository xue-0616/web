import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitTgUser1721374078226 implements MigrationInterface {
    name = 'InitTgUser1721374078226';

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
                    comment: 'tg_user table primary key',
                    generationStrategy: 'increment',
                },
                {
                    name: 'user_id',
                    type: 'bigint',
                    unsigned: true,
                    isNullable: false,
                    comment: 'tg id for the user',
                },
                {
                    name: 'access_hash',
                    type: 'varchar',
                    length: '80',
                    isNullable: false,
                    comment: 'tg access hash for the user',
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
                    name: 'invite_code',
                    type: 'varchar',
                    length: '8',
                    isNullable: false,
                    comment: 'invitation code',
                },
                {
                    name: 'points',
                    type: 'int',
                    unsigned: true,
                    isNullable: true,
                    default: 0,
                    comment: 'Current points',
                },
                {
                    name: 'inviter_user_id',
                    type: 'bigint',
                    unsigned: true,
                    isNullable: true,
                    comment: 'The user_id of the invited user to register',
                },
                {
                    name: 'invited_time',
                    type: 'bigint',
                    unsigned: true,
                    isNullable: true,
                    comment: 'invitation code submit time',
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
            name: 'uk_tg_user',
            columnNames: [`user_id`, `access_hash`],
            isUnique: true,
        }));
        await queryRunner.createIndex('tg_users', new TableIndex({
            name: 'uk_invited_code',
            columnNames: [`invite_code`],
            isUnique: true,
        }));
        await queryRunner.createIndex('tg_users', new TableIndex({
            name: 'k_invited_user',
            columnNames: [`inviter_user_id`, `invited_time`],
        }));
    }
    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex('tg_users', 'uk_tg_user');
        await queryRunner.dropIndex('tg_users', 'uk_invited_code');
        await queryRunner.dropIndex('tg_users', 'k_invited_user');
        await queryRunner.dropTable('tg_users');
    }
}

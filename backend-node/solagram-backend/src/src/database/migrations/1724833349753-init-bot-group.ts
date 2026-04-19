import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitBotGroups1724833349753 implements MigrationInterface {
    constructor() {
        this.name = 'InitBotGroups1724833349753';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'bot_groups',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'bot_groups table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'chat_id',
                        type: 'bigint',
                        isNullable: false,
                        comment: 'tg id for the group chat id',
                    },
                    {
                        name: 'group_title',
                        type: 'VARCHAR',
                        length: '80',
                        isNullable: false,
                        comment: 'the title of group',
                    },
                    {
                        name: 'bot_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: true,
                        comment: 'Id of the bot',
                    },
                    {
                        name: 'bot_username',
                        type: 'VARCHAR',
                        length: '30',
                        isNullable: true,
                        comment: 'Username of the bot',
                    },
                    {
                        name: 'status',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bot join in group status 0:leave 1:active',
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
            await queryRunner.createIndex('bot_groups', new TableIndex({
                name: 'k_status',
                columnNames: [`status`],
            }));
            await queryRunner.createIndex('bot_groups', new TableIndex({
                name: 'uk_bot_group',
                columnNames: [`chat_id`, `bot_id`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('bot_groups', 'k_status');
            await queryRunner.dropIndex('bot_groups', 'uk_bot_group');
            await queryRunner.dropTable('bot_groups');
        }
}

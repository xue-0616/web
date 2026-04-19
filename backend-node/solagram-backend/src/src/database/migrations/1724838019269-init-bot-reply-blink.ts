import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitBotReplyBlink1724838019269 implements MigrationInterface {
    constructor() {
        this.name = 'InitBotReplyBlink1724838019269';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'bot_reply_blink',
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
                        name: 'message_id',
                        type: 'bigint',
                        isNullable: false,
                        comment: 'reply message_id',
                    },
                    {
                        name: 'blink_id',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'bind id of blink_short_code table',
                    },
                    {
                        name: 'user_id',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'tg id for the user',
                    },
                    {
                        name: 'bot_id',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'reply bot tg id',
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
            await queryRunner.createIndex('bot_reply_blink', new TableIndex({
                name: 'uk_reply',
                columnNames: [`chat_id`, `message_id`],
                isUnique: true,
            }));
            await queryRunner.createIndex('bot_reply_blink', new TableIndex({
                name: 'k_blink',
                columnNames: [`blink_id`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('bot_reply_blink', 'k_blink');
            await queryRunner.dropIndex('bot_reply_blink', 'uk_reply');
            await queryRunner.dropTable('bot_reply_blink');
        }
}

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitOpenMiniApp1724841123564 implements MigrationInterface {
    constructor() {
        this.name = 'InitOpenMiniApp1724841123564';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'open_app_actions',
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
                        name: 'user_id',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'tg id for the user',
                    },
                    {
                        name: 'reply_id',
                        type: 'bigint',
                        isNullable: true,
                        comment: 'bind reply id message id',
                    },
                    {
                        name: 'blink_id',
                        type: 'bigint',
                        isNullable: true,
                        unsigned: true,
                        comment: 'bind id of blink_short_code table',
                    },
                    {
                        name: 'action',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'mini app open action:0-showHome, 1 - connect, 2 - signTransaction',
                    },
                    {
                        name: 'source',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'mini app open source : 0 - bot, 1 - blink mini app',
                    },
                    {
                        name: 'app_type',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'mini app open type:0- BlinkMiniApp, 1 - WalletMiniAPp',
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
            await queryRunner.createIndex('open_app_actions', new TableIndex({
                name: 'uk_actions',
                columnNames: [`app_type`, `action`, `user_id`, `source`, `reply_id`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('open_app_actions', 'k_blink');
            await queryRunner.dropTable('open_app_actions');
        }
}

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitUserFollows1724830325453 implements MigrationInterface {
    constructor() {
        this.name = 'InitUserFollows1724830325453';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'user_follows',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'user_follows table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'type',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Follow type: 0 - SolagramPortalBot, 1 - Solagrm Wallet',
                    },
                    {
                        name: 'user_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Follow bot user ID',
                    },
                    {
                        name: 'bot_username',
                        type: 'VARCHAR',
                        length: '30',
                        isNullable: true,
                        comment: 'Username of the bot',
                    },
                    {
                        name: 'bot_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: true,
                        comment: 'id of the bot',
                    },
                    {
                        name: 'status',
                        type: 'TINYINT',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Follow status: 0 - Cancel Follow, 2 -  Follow',
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
            await queryRunner.createIndex('user_follows', new TableIndex({
                name: 'k_status',
                columnNames: [`status`],
            }));
            await queryRunner.createIndex('user_follows', new TableIndex({
                name: 'uk_user',
                columnNames: [`type`, `user_id`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('user_follows', 'k_status');
            await queryRunner.dropIndex('user_follows', 'uk_user');
            await queryRunner.dropTable('user_follows');
        }
}

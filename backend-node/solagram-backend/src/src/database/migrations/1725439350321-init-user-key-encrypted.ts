import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitUserKeyEncrypts1725439350321 implements MigrationInterface {
    constructor() {
        this.name = 'InitUserKeyEncrypts1725439350321';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'user_key_encrypts',
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
                        comment: 'bind tg user id',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        comment: 'key used status 0: old key, 1: current key',
                        isNullable: false,
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                        length: '44',
                        isUnique: true,
                        isNullable: false,
                        comment: 'Base-58 encoded Solana public address, typically 32 to 44 characters in length',
                    },
                    {
                        name: 'key_encrypted',
                        type: 'varchar',
                        length: '1024',
                        isNullable: false,
                        comment: 'mnemonic phrase encrypted store',
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
            await queryRunner.createIndex('user_key_encrypts', new TableIndex({
                name: 'k_user',
                columnNames: [`user_id`, `status`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('user_key_encrypts', 'k_user');
            await queryRunner.dropTable('user_key_encrypts');
        }
}

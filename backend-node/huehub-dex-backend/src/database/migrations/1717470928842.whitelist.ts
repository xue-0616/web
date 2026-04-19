import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class Whitelist1717470928842 implements MigrationInterface {
    constructor() {
        this.name = 'Whitelist1717470928842';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'whitelist',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'whitelist table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'launchpad_token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind launchpad_token_id table id',
                    },
                    {
                        name: 'launchpad_round_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind launchpad rounds table id',
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                        isNullable: false,
                        length: '80',
                        comment: 'whitelist bind address',
                    },
                    {
                        name: 'amount_per_mint',
                        type: 'decimal',
                        length: '60,0',
                        isNullable: false,
                        comment: 'amount per mint',
                    },
                    {
                        name: 'claimed',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'whitelist claimed status 0:false,1:true',
                    },
                    {
                        name: 'mint_count',
                        type: 'int',
                        isNullable: true,
                        unsigned: true,
                        comment: 'whitelist mint count',
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        isNullable: false,
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        isNullable: false,
                        default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                    },
                ],
            }));
            await queryRunner.createIndex('whitelist', new TableIndex({
                name: 'uk_address',
                isUnique: true,
                columnNames: [`address`, `launchpad_token_id`, `launchpad_round_id`],
            }));
            await queryRunner.createIndex('whitelist', new TableIndex({
                name: 'key_claimed',
                columnNames: [
                    `address`,
                    `launchpad_token_id`,
                    `launchpad_round_id`,
                    `claimed`,
                ],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('launchpad_rounds', 'key_claimed');
            await queryRunner.dropIndex('launchpad_rounds', 'uk_address');
            await queryRunner.dropTable('whitelist');
        }
}

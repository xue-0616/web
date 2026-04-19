import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class LaunchpadTokens1717503585225 implements MigrationInterface {
    constructor() {
        this.name = 'LaunchpadTokens1717503585225';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'launchpad_tokens',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'launchpad_tokens table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'total_supply',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: ' total supply ',
                    },
                    {
                        name: 'total_issued',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        isNullable: false,
                        comment: 'total issued',
                    },
                    {
                        name: 'xudt_args',
                        type: 'varbinary',
                        length: '64',
                        comment: 'ckb xudt type args',
                        isNullable: false,
                    },
                    {
                        name: 'xudt_type_hash',
                        type: 'binary',
                        length: '32',
                        comment: 'xudt type hash',
                        isNullable: false,
                    },
                    {
                        name: 'symbol',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'token symbol',
                    },
                    {
                        name: 'project_name',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'project name',
                    },
                    {
                        name: 'decimal',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'token decimal',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'launchpad status 0:pending,1: complete',
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
            await queryRunner.createIndex('launchpad_tokens', new TableIndex({
                name: 'uk_type_hash_key',
                isUnique: true,
                columnNames: [`xudt_type_hash`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('launchpad_rounds', 'uk_type_hash_key');
            await queryRunner.dropTable('launchpad_tokens');
        }
}

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitTokens1711083995566 implements MigrationInterface {
    constructor() {
        this.name = 'InitTokens1711083995566';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'tokens',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'tokens table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'token name',
                    },
                    {
                        name: 'symbol',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'token symbol',
                    },
                    {
                        name: 'decimals',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'token ',
                    },
                    {
                        name: 'icon_url',
                        type: 'varchar',
                        length: '255',
                        comment: 'rgb++ token icon',
                        isNullable: true,
                    },
                    {
                        name: 'xudt_code_hash',
                        type: 'binary',
                        length: '32',
                        comment: 'ckb xudt type code hash',
                        isNullable: false,
                    },
                    {
                        name: 'xudt_args',
                        type: 'binary',
                        length: '32',
                        comment: 'ckb xudt type args',
                        isNullable: false,
                    },
                    {
                        name: 'total_supply',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        comment: 'ckb xudt type args',
                        isNullable: false,
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
            await queryRunner.createIndex('tokens', new TableIndex({
                name: 'u_token_key',
                columnNames: ['xudt_code_hash', `xudt_args`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('tokens');
            await queryRunner.dropIndex('tokens', 'u_token_key');
        }
}

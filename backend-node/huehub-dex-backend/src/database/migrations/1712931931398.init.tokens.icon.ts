import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class InitTokensIcon1712931931398 implements MigrationInterface {
    constructor() {
        this.name = 'InitTokensIcon1712931931398';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'tokens_icon',
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
                        name: 'token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        isUnique: true,
                        comment: 'bind token id',
                    },
                    {
                        name: 'image_data',
                        type: 'text',
                        comment: 'rgb++ token icon data',
                        isNullable: true,
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
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('tokens_icon');
        }
}

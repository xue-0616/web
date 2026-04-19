import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CkbBlock1715344946192 implements MigrationInterface {
    constructor() {
        this.name = 'CkbBlock1715344946192';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'ckb_block',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'Primary key for the block table',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'cur_block_number',
                        type: 'bigint',
                        unsigned: true,
                        comment: 'Current block number processed by the indexer',
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
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropTable('ckb_block');
        }
}

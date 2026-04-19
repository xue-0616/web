import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class DobsCells1715344958254 implements MigrationInterface {
    constructor() {
        this.name = 'DobsCells1715344958254';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'dobs',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'Primary key for the dobs table',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'cluster_type_args',
                        type: 'varbinary',
                        length: '64',
                        isNullable: false,
                        comment: 'spore bind cluster_id',
                    },
                    {
                        name: 'block_number',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Block number containing the transaction',
                    },
                    {
                        name: 'tx_hash',
                        type: 'varbinary',
                        length: '64',
                        isNullable: false,
                        comment: 'Timestamp of the block',
                    },
                    {
                        name: 'cell_index',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'Index of the cell in the transaction',
                    },
                    {
                        name: 'owner',
                        type: 'varbinary',
                        length: '64',
                        isNullable: false,
                        comment: 'Current owner of the Spore asset，ckb address',
                    },
                    {
                        name: 'type_script_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'spore cell type script hash',
                    },
                    {
                        name: 'type_code_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'spore cell type script code hash',
                    },
                    {
                        name: 'type_args',
                        type: 'varbinary',
                        length: '64',
                        isNullable: false,
                        comment: 'spore cell type script args',
                    },
                    {
                        name: 'lock_script_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'spore cell lock script hash',
                    },
                    {
                        name: 'lock_code_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'spore cell lock code hash',
                    },
                    {
                        name: 'lock_args',
                        type: 'varbinary',
                        length: '64',
                        isNullable: false,
                        comment: 'spore cell lock argss',
                    },
                    {
                        name: 'data',
                        type: 'blob',
                        isNullable: false,
                        comment: 'cell data',
                    },
                    {
                        name: 'capacity',
                        type: 'VARCHAR',
                        length: '64',
                        isNullable: false,
                        comment: 'ckb capacity',
                    },
                    {
                        name: 'spore_token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'spore token id',
                    },
                    {
                        name: 'spore_content_type',
                        type: 'varchar',
                        length: '80',
                        isNullable: true,
                        comment: 'spore content type，prev.type',
                    },
                    {
                        name: 'spore_prev_bgcolor',
                        type: 'varchar',
                        length: '10',
                        isNullable: true,
                        comment: 'spore icon bg color ',
                    },
                    {
                        name: 'spore_hex_icon',
                        type: 'blob',
                        isNullable: true,
                        comment: 'spore icon hex data',
                    },
                    {
                        name: 'btc_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: 'utxo txid',
                    },
                    {
                        name: 'btc_index',
                        type: 'int',
                        unsigned: true,
                        comment: 'utxo index',
                    },
                    {
                        name: 'btc_value',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                        comment: 'utxo btc value',
                    },
                    {
                        name: 'btc_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: true,
                        comment: 'spore icon hex data',
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
            await queryRunner.createIndex('dobs', new TableIndex({
                name: 'uk_cell',
                columnNames: ['type_args'],
                isUnique: true,
            }));
            await queryRunner.createIndex('dobs', new TableIndex({
                name: 'k_block_number',
                columnNames: ['block_number'],
            }));
            await queryRunner.createIndex('dobs', new TableIndex({
                name: 'k_btc_address',
                columnNames: ['btc_address'],
            }));
            await queryRunner.createIndex('dobs', new TableIndex({
                name: 'k_cluster',
                columnNames: ['cluster_type_args', 'spore_token_id'],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('dobs', 'k_cluster');
            await queryRunner.dropIndex('dobs', 'k_btc_address');
            await queryRunner.dropIndex('dobs', 'k_block_number');
            await queryRunner.dropIndex('dobs', 'uk_cell');
            await queryRunner.dropTable('dobs');
        }
}

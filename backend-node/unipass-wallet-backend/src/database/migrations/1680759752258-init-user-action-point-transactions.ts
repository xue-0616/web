import { Table, TableIndex } from 'typeorm';

export class InitUserActionPointTransactions1680759752258 {
    constructor() {
        this.name = 'InitUserActionPointTransactions1680759752258';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'user_action_point_transactions',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'bigint',
                        unsigned: true,
                        comment: '@desc account id',
                        isNullable: false,
                    },
                    {
                        name: 'history_id',
                        type: 'bigint',
                        unsigned: true,
                        isUnique: true,
                        comment: '@desc history id',
                        isNullable: false,
                    },
                    {
                        name: 'relayer_id',
                        type: 'bigint',
                        unsigned: true,
                        comment: '@desc relayer id',
                        isNullable: false,
                    },
                    {
                        name: 'transaction',
                        type: 'json',
                        isNullable: false,
                        comment: '@desc user send tx info',
                    },
                    {
                        name: 'action_point',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: '@desc send tx need ap number',
                    },
                    {
                        name: 'relayer_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        comment: '@desc relayer tx hash',
                    },
                    {
                        name: 'chain_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc chain tx hash',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: '@desc status\n@values 0 pending ｜ 1 complete',
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }), true);
            await queryRunner.createIndex('user_action_point_transactions', new TableIndex({
                name: 'txs_uid_ind',
                columnNames: ['account_id'],
            }));
            await queryRunner.createIndex('user_action_point_transactions', new TableIndex({
                name: 'txs_status_ind',
                columnNames: ['status'],
            }));
            await queryRunner.createIndex('user_action_point_transactions', new TableIndex({
                name: 'txs_relayer_id_ind',
                columnNames: ['relayer_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('user_action_point_transactions');
            await queryRunner.dropIndex('user_action_point_transactions', 'txs_uid_ind');
            await queryRunner.dropIndex('user_action_point_transactions', 'txs_status_ind');
            await queryRunner.dropIndex('user_action_point_transactions', 'txs_relayer_id_ind');
        }
}

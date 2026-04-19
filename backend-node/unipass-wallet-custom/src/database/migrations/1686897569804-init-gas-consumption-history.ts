import { Table, TableIndex } from 'typeorm';

export class InitGasConsumptionHistory1686897569804 {
    constructor() {
        this.name = 'InitGasConsumptionHistory1686897569804';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'gas_consumption_history',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc customer table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: '@desc 0:generate; 1:pending; 2:On-chain Complete;3 On-chain Failed; 4: Notification Completed,5 Notification Failed',
                    },
                    {
                        name: 'transaction',
                        type: 'json',
                        isNullable: false,
                        comment: '@desc customer Info',
                    },
                    {
                        name: 'nonce',
                        type: 'int',
                        isNullable: false,
                        comment: '@desc tx nonce',
                    },
                    {
                        name: 'chain_id',
                        type: 'int',
                        isNullable: false,
                        comment: '@desc chain id',
                    },
                    {
                        name: 'app_id',
                        type: 'varchar',
                        length: '64',
                        isNullable: false,
                        comment: '@desc app_id',
                    },
                    {
                        name: 'user_address',
                        type: 'binary',
                        length: '20',
                        isNullable: false,
                        comment: '@desc user_address',
                    },
                    {
                        name: 'policy_id',
                        type: 'bigint',
                        isNullable: true,
                        comment: '@desc policy_id',
                    },
                    {
                        name: 'policy_type',
                        type: 'tinyint',
                        isNullable: false,
                        comment: '@desc 0: Under review; 0:contractPolicies; 1:custom policy',
                    },
                    {
                        name: 'chain_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc chain_tx_hash',
                    },
                    {
                        name: 'relayer_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        isUnique: true,
                        comment: '@desc relayer_tx_hash',
                    },
                    {
                        name: 'user_paid_gas',
                        type: 'decimal',
                        precision: 50,
                        scale: 18,
                        isNullable: true,
                    },
                    {
                        name: 'user_paid_token',
                        type: 'binary',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'user_paid_fee',
                        type: 'decimal',
                        precision: 50,
                        scale: 19,
                        isNullable: true,
                    },
                    {
                        name: 'user_paid_token_rate',
                        type: 'decimal',
                        precision: 20,
                        scale: 19,
                        isNullable: true,
                    },
                    {
                        name: 'tank_paid_gas',
                        type: 'decimal',
                        precision: 50,
                        scale: 18,
                        isNullable: true,
                    },
                    {
                        name: 'tank_paid_token',
                        type: 'binary',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'tank_paid_fee',
                        type: 'decimal',
                        precision: 50,
                        scale: 18,
                        isNullable: true,
                    },
                    {
                        name: 'tank_paid_token_rate',
                        type: 'decimal',
                        precision: 20,
                        scale: 19,
                        isNullable: true,
                    },
                    {
                        name: 'consumed_gas_used',
                        type: 'decimal',
                        precision: 20,
                        scale: 0,
                        isNullable: true,
                    },
                    {
                        name: 'consumed_gas_price',
                        type: 'decimal',
                        precision: 50,
                        scale: 0,
                        isNullable: true,
                    },
                    {
                        name: 'consumed_fee',
                        type: 'decimal',
                        precision: 50,
                        scale: 18,
                        isNullable: true,
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
            await queryRunner.createIndex('gas_consumption_history', new TableIndex({
                name: 'INDEX_APP_ID_STATUS',
                columnNames: ['status', 'app_id'],
            }));
            await queryRunner.createIndex('gas_consumption_history', new TableIndex({
                name: 'INDEX_APP_ID_CHAIN_ID',
                columnNames: ['chain_id', 'app_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('gas_consumption_history');
            await queryRunner.dropIndex('gas_consumption_history', 'INDEX_APP_ID_CHAIN_ID');
            await queryRunner.dropIndex('gas_consumption_history', 'INDEX_APP_ID_STATUS');
        }
}

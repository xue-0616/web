import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class MintHistory1717503587649 implements MigrationInterface {
    constructor() {
        this.name = 'MintHistory1717503587649';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'mint_history',
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
                        isNullable: true,
                        comment: 'bind launchpad_token table id',
                    },
                    {
                        name: 'launchpad_round_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: true,
                        comment: 'bind launchpad_rounds table id',
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'mint address',
                    },
                    {
                        name: 'btc_tx',
                        type: 'blob',
                        isNullable: false,
                        comment: 'mint tx btc psbt',
                    },
                    {
                        name: 'paymaster_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: '@desc pay master address',
                    },
                    {
                        name: 'service_fee_amount',
                        type: 'decimal',
                        length: '60,0',
                        isNullable: false,
                        comment: 'mint service fee amount ',
                    },
                    {
                        name: 'btc_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: false,
                        isUnique: true,
                        comment: ' mint btc tx hash ',
                    },
                    {
                        name: 'issue_btc_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: 'issue btc tx hash ',
                    },
                    {
                        name: 'issue_ckb_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: 'issue btc tx hash ',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        comment: 'mint tx status 0 mint pending 1:mint complete 2:mint failed 3:isuue_pending 4:isuue complete, 5 issue_failed',
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
            await queryRunner.createIndex('mint_history', new TableIndex({
                name: 'key_mint_history',
                columnNames: [
                    `launchpad_token_id`,
                    `launchpad_round_id`,
                    `status`,
                    `address`,
                ],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('launchpad_rounds', 'key_mint_history');
            await queryRunner.dropTable('mint_history');
        }
}

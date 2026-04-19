import { Table, TableIndex } from 'typeorm';

export class InitRecovery1656054454064 {
    constructor() {
        this.name = 'InitRecovery1656054454064';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'recovery',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc recovery tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'int',
                        comment: '@desc linked account id',
                        isNullable: false,
                    },
                    {
                        name: 'recovery_time',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: true,
                        comment: '@desc start recovery time',
                    },
                    {
                        name: 'start_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc start recovery tx hash',
                    },
                    {
                        name: 'cancel_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc cancel recovery tx hash',
                    },
                    {
                        name: 'complete_tx_hash',
                        type: 'binary',
                        length: '32',
                        isNullable: true,
                        comment: '@desc complete recovery tx hash',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        comment: '@desc recovery status， 0: pending,1: recovering, 2: committed, 3:cancel',
                        isNullable: false,
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
            await queryRunner.createIndex('recovery', new TableIndex({
                name: 'INDEX_ACCOUNT_ID',
                columnNames: ['account_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('recovery');
            await queryRunner.dropIndex('recovery', 'INDEX_ACCOUNT_ID');
        }
}

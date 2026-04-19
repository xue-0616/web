import { Table, TableIndex } from 'typeorm';

export class InitUserActionPointHistory1680759737022 {
    constructor() {
        this.name = 'InitUserActionPointHistory1680759737022';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'user_action_point_history',
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
                        name: 'action_point_diff',
                        type: 'bigint',
                        isNullable: false,
                        comment: '@desc AP increasing or decreasing an amount of money',
                    },
                    {
                        name: 'change_type',
                        type: 'tinyint',
                        isNullable: false,
                        comment: '@desc balance change type\n@values 0 admin add ｜ 1 ap tx ｜ other',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: '@desc status\n@values 0 ing ｜ 1 success ｜ 2 fail',
                    },
                    {
                        name: 'change_msg',
                        type: 'varchar',
                        length: '256',
                        isNullable: true,
                        comment: '@desc AP balance change message',
                    },
                    {
                        name: 'change_time',
                        type: 'timestamp',
                        isNullable: true,
                        comment: '@desc AP balance change time',
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        isNullable: false,
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        isNullable: false,
                    },
                ],
            }), true);
            await queryRunner.createIndex('user_action_point_history', new TableIndex({
                name: 'history_user_ind',
                columnNames: ['account_id', 'status'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('user_action_point_history');
            await queryRunner.dropIndex('user_action_point_history', 'history_user_ind');
        }
}

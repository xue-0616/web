import { Table } from 'typeorm';

export class InitUserActionPoint1680759603706 {
    constructor() {
        this.name = 'InitUserActionPoint1680759603706';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'user_action_point',
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
                        isUnique: true,
                        type: 'bigint',
                        unsigned: true,
                        comment: '@desc account id',
                        isNullable: false,
                    },
                    {
                        name: 'avail_action_point',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        default: 0,
                        comment: '@desc avail action point',
                    },
                    {
                        name: 'lock_action_point',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        default: 0,
                        comment: '@desc lock action point',
                    },
                    {
                        name: 'discount',
                        type: 'tinyint',
                        unsigned: true,
                        default: 1,
                        isNullable: false,
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
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('user_action_point');
        }
}

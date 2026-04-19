import { Table } from 'typeorm';

export class InitActionPointRelayer1680759763539 {
    constructor() {
        this.name = 'InitActionPointRelayer1680759763539';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'action_point_relayer',
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
                        name: 'relayer_auth_addr',
                        type: 'binary',
                        length: '20',
                        comment: '@desc relayer auth addr',
                        isNullable: false,
                    },
                    {
                        name: 'relayer_url',
                        type: 'varchar',
                        length: '256',
                        isNullable: true,
                        comment: '@desc AP increasing or decreasing an amount of money',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: '@desc status\n@values 0 close ｜ 1 open',
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
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('action_point_relayer');
        }
}

import { Table } from 'typeorm';

export class InitAccount1656054383510 {
    constructor() {
        this.name = 'InitAccount1656054383510';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'accounts',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc account tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'binary',
                        length: '20',
                        isUnique: true,
                        isNullable: false,
                        comment: '@desc master key address',
                    },
                    {
                        name: 'email',
                        type: 'varchar',
                        length: '80',
                        comment: '@desc register email',
                        isUnique: true,
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        default: 0,
                        comment: '@desc On-chain status， 0: pending, 1: committed， 2: failed ',
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
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('accounts');
        }
}

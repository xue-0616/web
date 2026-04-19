import { Table, TableIndex } from 'typeorm';

export class InitLoginRecords1666157327958 {
    constructor() {
        this.name = 'InitLoginRecords1666157327958';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'login_records',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc login_records table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'int',
                        comment: '@desc linked account id',
                        isNullable: false,
                    },
                    {
                        name: 'date',
                        type: 'varchar',
                        length: '8',
                        comment: '@desc login account time YYYYmmdd ',
                        isNullable: false,
                    },
                    {
                        name: 'times',
                        type: 'smallint',
                        default: 0,
                        comment: '@desc one day login times ',
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
            await queryRunner.createIndex('login_records', new TableIndex({
                name: 'INDEX_ACCOUNT_DAY_LOGIN',
                columnNames: ['account_id', 'date'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('login_records');
            await queryRunner.dropIndex('login_records', 'INDEX_ACCOUNT_DAY_LOGIN');
        }
}

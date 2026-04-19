import { Table, TableIndex } from 'typeorm';

export class InitAuthenticators1656311267081 {
    constructor() {
        this.name = 'initAuthenticators1656311267081';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'authenticators',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc authenticators tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'account_id',
                        type: 'int',
                        comment: '@desc linked account id',
                        isNullable: false,
                    },
                    {
                        name: 'value',
                        type: 'json',
                        isNullable: true,
                        comment: '@desc 2fa value: email/phone/ga/webauth',
                    },
                    {
                        name: 'type',
                        type: 'tinyint',
                        default: 0,
                        isNullable: true,
                        comment: '@desc 2fa value type: 0:email,1:phone,2:ga,3: webauth',
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
            await queryRunner.createIndex('authenticators', new TableIndex({
                name: 'INDEX_ACCOUNT_ID',
                columnNames: ['account_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('authenticators');
            await queryRunner.dropIndex('authenticators', 'INDEX_ACCOUNT_ID');
        }
}

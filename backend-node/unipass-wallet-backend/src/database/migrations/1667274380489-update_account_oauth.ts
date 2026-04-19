import { TableColumn, TableIndex } from 'typeorm';

export class UpdateAccountOauth1667274380489 {
    constructor() {
        this.name = 'UpdateAccountOauth1667274380489';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('accounts', 'email', new TableColumn({
                name: 'email',
                type: 'varchar',
                length: '80',
                comment: '@desc register email',
                isUnique: false,
                isNullable: false,
            }));
            await queryRunner.changeColumn('accounts', 'email_in_lower_case', new TableColumn({
                name: 'email_in_lower_case',
                type: 'varchar',
                length: '80',
                isUnique: false,
                isNullable: false,
            }));
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'sub',
                type: 'varchar',
                length: '60',
                comment: '@desc google or aws uuid',
                isNullable: false,
            }));
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'provider',
                type: 'tinyint',
                comment: '@desc 0 google 1 aws:email 2 aws:apple 3 aws:twitter',
                isNullable: false,
            }));
            await queryRunner.createIndex('accounts', new TableIndex({
                name: 'INDEX_EMAIL_PROVIDER',
                columnNames: ['email', 'provider'],
                isUnique: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('accounts', 'sub');
            await queryRunner.dropColumn('accounts', 'provider');
            await queryRunner.dropIndex('accounts', 'INDEX_EMAIL_PROVIDER');
            await queryRunner.changeColumn('accounts', 'email', new TableColumn({
                name: 'email',
                type: 'varchar',
                length: '80',
                comment: '@desc register email',
                isUnique: true,
                isNullable: false,
            }));
            await queryRunner.changeColumn('accounts', 'email_in_lower_case', new TableColumn({
                name: 'email_in_lower_case',
                type: 'varchar',
                length: '80',
                isUnique: true,
                isNullable: false,
            }));
        }
}

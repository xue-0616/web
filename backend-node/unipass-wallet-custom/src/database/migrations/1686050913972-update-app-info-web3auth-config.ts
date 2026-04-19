import { TableColumn, TableIndex } from 'typeorm';

export class UpdateAppInfoWeb3authConfig1686050913972 {
    constructor() {
        this.name = 'UpdateAppInfoWeb3authConfig1686050913972';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'web3auth_env',
                type: 'varchar',
                length: '10',
                isNullable: true,
            }));
            await queryRunner.changeColumn('custom_auth_app_infos', 'app_name', new TableColumn({
                name: 'app_name',
                type: 'varchar',
                length: '66',
                comment: '@desc app name  like sparkle',
                isNullable: false,
                isUnique: false,
            }));
            await queryRunner.createIndex('custom_auth_app_infos', new TableIndex({
                name: 'app_name_index',
                columnNames: ['app_name'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('custom_auth_app_infos', 'web3auth_env');
            await queryRunner.dropColumn('custom_auth_app_infos', 'app_name');
            await queryRunner.dropIndex('custom_auth_app_infos', 'app_name_index');
        }
}

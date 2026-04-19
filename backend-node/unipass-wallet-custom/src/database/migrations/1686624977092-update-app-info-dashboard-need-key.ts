import { TableColumn, TableIndex } from 'typeorm';

export class UpdateAppInfoDashboardNeedKey1686624977092 {
    constructor() {
        this.name = 'UpdateAppInfoDashboardNeedKey1686624977092';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'customer_id',
                type: 'int',
                isNullable: false,
                default: 0,
                comment: 'customer table id',
            }));
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'callback_url',
                type: 'varchar',
                length: '2048',
                isNullable: true,
                comment: 'app callback url',
            }));
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'unipass_callback_auth',
                type: 'varchar',
                length: '2048',
                isNullable: true,
                comment: 'unipass callback auth public key',
            }));
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'enable_custom_policy',
                type: 'tinyint',
                isNullable: false,
                default: 0,
                comment: 'enable custom policy',
            }));
            await queryRunner.addColumn('custom_auth_app_infos', new TableColumn({
                name: 'custom_policy_public_key',
                type: 'varchar',
                length: '2048',
                isNullable: true,
                comment: 'enable custom policy sig public key',
            }));
            await queryRunner.createIndex('custom_auth_app_infos', new TableIndex({
                name: 'app_customer_index',
                columnNames: ['customer_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('custom_auth_app_infos', 'customer_id');
            await queryRunner.dropColumn('custom_auth_app_infos', 'callback_url');
            await queryRunner.dropColumn('custom_auth_app_infos', 'unipass_callback_auth');
            await queryRunner.dropColumn('custom_auth_app_infos', 'custom_policy_public_key');
            await queryRunner.dropColumn('custom_auth_app_infos', 'enable_custom_policy');
            await queryRunner.dropIndex('custom_auth_app_infos', 'app_customer_index');
        }
}

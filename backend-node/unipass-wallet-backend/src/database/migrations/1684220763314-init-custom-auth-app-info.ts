import { Table } from 'typeorm';

export class InitCustomAuthAppInfo1684220763314 {
    constructor() {
        this.name = 'InitCustomAuthAppInfo1684220763314';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'custom_auth_app_infos',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc custom_auth_app_infos table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'app_id',
                        type: 'varchar',
                        length: '64',
                        comment: '@desc account uuid',
                        isNullable: false,
                        isUnique: true,
                    },
                    {
                        name: 'app_name',
                        type: 'varchar',
                        length: '66',
                        comment: '@desc app name  like sparkle',
                        isNullable: false,
                        isUnique: true,
                    },
                    {
                        name: 'verifier_name',
                        type: 'varchar',
                        length: '66',
                        comment: '@desc web3auth verify name',
                        isNullable: true,
                    },
                    {
                        name: 'web3auth_client_id',
                        type: 'varchar',
                        length: '88',
                        comment: '@desc web3auth client id',
                        isNullable: true,
                    },
                    {
                        name: 'app_info',
                        type: 'json',
                        comment: '@desc app_info',
                        isNullable: true,
                    },
                    {
                        name: 'jwt_verifier_id_key',
                        type: 'varchar',
                        length: '32',
                        comment: '@desc jwt verifier id',
                        isNullable: false,
                    },
                    {
                        name: 'jwt_pubkey',
                        type: 'json',
                        comment: '@desc jwt_pubkey',
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
            await queryRunner.dropTable('custom_auth_app_infos');
        }
}

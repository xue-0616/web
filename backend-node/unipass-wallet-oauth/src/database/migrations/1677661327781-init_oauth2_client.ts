import { Table, TableIndex } from 'typeorm';

// Recovered from dist/1677661327781-init_oauth2_client.js.map (source: ../../../src/database/migrations/1677661327781-init_oauth2_client.ts)

export class InitOauth2Client1677661327781 {
    name = 'InitOauth2Client1677661327781';
    async up(queryRunner: any) {
        await queryRunner.createTable(new Table({
            name: 'oauth2_client',
            columns: [
                {
                    name: 'client_id',
                    type: 'varchar',
                    length: '128',
                    isPrimary: true,
                    isNullable: false,
                },
                {
                    name: 'client_secret',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'resource_ids',
                    type: 'varchar',
                    length: '256',
                    isNullable: true,
                },
                {
                    name: 'scope',
                    type: 'varchar',
                    length: '256',
                    default: '"openid profile email"',
                    comment: '@desc openid profile email',
                    isNullable: true,
                },
                {
                    name: 'authorized_grant_types',
                    type: 'varchar',
                    length: '256',
                    default: '"authorization_code"',
                    comment: '@desc authorized_grant_types',
                    isNullable: true,
                },
                {
                    name: 'web_server_redirect_uri',
                    type: 'varchar',
                    length: '256',
                    isNullable: true,
                },
                {
                    name: 'access_token_validity',
                    type: 'int',
                    length: '11',
                    default: '30',
                    comment: '@desc unit m',
                    isNullable: true,
                },
                {
                    name: 'email_template',
                    type: 'varchar',
                    length: '100',
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
        await queryRunner.createIndex('oauth2_client', new TableIndex({
            name: 'INDEX_OAUTH_CLIENT',
            columnNames: ['resource_ids'],
        }));
    }
    async down(queryRunner: any) {
        await queryRunner.dropTable('oauth2_client');
        await queryRunner.dropIndex('oauth2_client', 'INDEX_OAUTH_CLIENT');
    }
}

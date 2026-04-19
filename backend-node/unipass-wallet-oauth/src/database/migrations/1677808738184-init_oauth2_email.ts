import { Table, TableIndex } from 'typeorm';

// Recovered from dist/1677808738184-init_oauth2_email.js.map (source: ../../../src/database/migrations/1677808738184-init_oauth2_email.ts)

export class InitOauth2Email1677808738184 {
    name = 'InitOauth2Email1677808738184';
    async up(queryRunner: any) {
        await queryRunner.createTable(new Table({
            name: 'oauth2_email',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    comment: '@desc chain_sync tabel primary key',
                    generationStrategy: 'increment',
                },
                {
                    name: 'sub',
                    type: 'varchar',
                    length: '40',
                    isNullable: false,
                },
                {
                    name: 'client_id',
                    type: 'varchar',
                    length: '128',
                    isNullable: false,
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '80',
                    isNullable: false,
                },
                {
                    name: 'email_verified',
                    type: 'tinyint',
                    default: '0',
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
        await queryRunner.createIndex('oauth2_email', new TableIndex({
            name: 'INDEX_OAUTH_CLIENT',
            columnNames: ['client_id', 'email'],
        }));
    }
    async down(queryRunner: any) {
        await queryRunner.dropTable('oauth2_email');
        await queryRunner.dropIndex('oauth2_email', 'INDEX_OAUTH_CLIENT');
    }
}

import { Table, TableIndex } from 'typeorm';

export class InitNftToken1675223175356 {
    constructor() {
        this.name = 'InitNftToken1675223175356';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'nft_token',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc authenticators table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                        length: '42',
                        comment: '@desc nft contract address',
                        isNullable: false,
                    },
                    {
                        name: 'token_id',
                        type: 'varchar',
                        length: '150',
                        isNullable: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '150',
                        isNullable: true,
                    },
                    {
                        name: 'image_url',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'image_original_url',
                        type: 'varchar',
                        length: '500',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }), true);
            await queryRunner.createIndex('nft_token', new TableIndex({
                name: 'INDEX_NFT',
                columnNames: ['address', 'token_id'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('nft_token');
            await queryRunner.dropIndex('nft_token', 'INDEX_NFT');
        }
}

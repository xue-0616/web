import { Table, TableIndex } from 'typeorm';

export class InitNftCollection1675223065785 {
    constructor() {
        this.name = 'InitNftCollection1675223065785';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'nft_collection',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'varchar',
                        length: '42',
                        isNullable: false,
                    },
                    {
                        name: 'image_url',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '150',
                        isNullable: true,
                    },
                    {
                        name: 'slug',
                        type: 'varchar',
                        length: '150',
                        isNullable: true,
                    },
                    {
                        name: 'symbol',
                        type: 'varchar',
                        length: '150',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }), true);
            await queryRunner.createIndex('nft_collection', new TableIndex({
                name: 'INDEX_NFT_COLLECTION',
                columnNames: ['address'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropTable('nft_collection');
            await queryRunner.dropIndex('nft_collection', 'INDEX_NFT_COLLECTION');
        }
}

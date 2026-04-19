import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class Collections1715344899575 implements MigrationInterface {
    constructor() {
        this.name = 'Collections1715344899575';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'collections',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'collections table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '80',
                        isNullable: false,
                        comment: 'token name',
                    },
                    {
                        name: 'description',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                        comment: 'nft description',
                    },
                    {
                        name: 'creator',
                        type: 'varbinary',
                        length: '128',
                        isNullable: false,
                        comment: 'nft description',
                    },
                    {
                        name: 'icon_url',
                        type: 'varchar',
                        length: '255',
                        comment: 'rgb++ token icon',
                        isNullable: true,
                    },
                    {
                        name: 'cluster_type_args',
                        type: 'varbinary',
                        length: '64',
                        comment: 'ckb cluster type args,cluster id',
                        isNullable: false,
                    },
                    {
                        name: 'cluster_type_hash',
                        type: 'binary',
                        length: '32',
                        comment: 'cluster type hash，sn',
                        isNullable: false,
                    },
                    {
                        name: 'decimals',
                        type: 'tinyint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'cluster decimals ',
                        default: 1,
                    },
                    {
                        name: 'total_supply',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'ckb xudt type args',
                        isNullable: false,
                    },
                    {
                        name: 'last_sales',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'last seals',
                        isNullable: false,
                    },
                    {
                        name: 'last_volume',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'last 24H volume',
                        isNullable: false,
                    },
                    {
                        name: 'last_holders',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'last number of holders',
                        isNullable: false,
                    },
                    {
                        name: 'market_cap',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'nft last market cap',
                        isNullable: false,
                    },
                    {
                        name: 'floor_price',
                        type: 'decimal',
                        length: '60,0',
                        unsigned: true,
                        default: 0,
                        comment: 'nft last floor price',
                        isNullable: false,
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        unsigned: true,
                        comment: 'nfts status 0:listing asset,1:pending asset,2:delist asset',
                        isNullable: false,
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        isNullable: false,
                    },
                ],
            }), true);
            await queryRunner.createIndex('collections', new TableIndex({
                name: 'uk_type_hash',
                columnNames: [`cluster_type_hash`],
                isUnique: true,
            }));
            await queryRunner.createIndex('collections', new TableIndex({
                name: 'k_cluster_id',
                columnNames: [`cluster_type_args`],
            }));
            await queryRunner.createIndex('collections', new TableIndex({
                name: 'k_status',
                columnNames: [`status`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('collections', 'k_status');
            await queryRunner.dropIndex('collections', 'k_cluster_id');
            await queryRunner.dropIndex('collections', 'uk_type_hash');
            await queryRunner.dropTable('collections');
        }
}

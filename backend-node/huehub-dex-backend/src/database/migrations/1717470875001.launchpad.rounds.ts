import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class LaunchpadRounds1717470875001 implements MigrationInterface {
    constructor() {
        this.name = 'LaunchpadRounds1717470875001';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.createTable(new Table({
                name: 'launchpad_rounds',
                columns: [
                    {
                        name: 'id',
                        type: 'bigint',
                        unsigned: true,
                        isPrimary: true,
                        isGenerated: true,
                        comment: 'launchpad_rounds table primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'launchpad_token_id',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'bind launchpad_token id',
                    },
                    {
                        name: 'round_name',
                        type: 'varchar',
                        length: '30',
                        isNullable: false,
                        comment: 'rounds name',
                    },
                    {
                        name: 'round_index',
                        type: 'int',
                        unsigned: true,
                        isNullable: false,
                        comment: 'rounds rounds index',
                    },
                    {
                        name: 'start_time',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'rounds start mint time',
                    },
                    {
                        name: 'end_time',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'rounds end mint time',
                    },
                    {
                        name: 'round_supply',
                        type: 'bigint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'round total supply amount',
                    },
                    {
                        name: 'eligibility_criteria',
                        type: 'json',
                        isNullable: true,
                        comment: 'rounds eligibility criteria',
                    },
                    {
                        name: 'round_type',
                        type: 'tinyint',
                        isNullable: false,
                        unsigned: true,
                        comment: 'rounds type 0:alpha rounds,1:beta rounds,2:public mint 3:airdrop 4:excess draw 5:weighted allocation',
                    },
                    {
                        name: 'address_mint_limit',
                        type: 'int',
                        unsigned: true,
                        isNullable: false,
                        comment: 'address mint limit',
                    },
                    {
                        name: 'minted_amount',
                        type: 'bigint',
                        unsigned: true,
                        isNullable: false,
                        comment: 'mint limit',
                    },
                    {
                        name: 'amount_per_mint',
                        type: 'decimal',
                        length: '60,0',
                        isNullable: false,
                        comment: 'amount per mint',
                    },
                    {
                        name: 'status',
                        type: 'tinyint',
                        isNullable: false,
                        unsigned: true,
                        comment: '@desc mint status 0 has not started,1 in progress 1:complete',
                    },
                    {
                        name: 'issue_time',
                        type: 'bigint',
                        isNullable: true,
                        unsigned: true,
                        comment: 'rounds issue time',
                    },
                    {
                        name: 'payment_amount',
                        type: 'decimal',
                        length: '60,0',
                        isNullable: true,
                        comment: 'mint payment amount',
                    },
                    {
                        name: 'payment_address',
                        type: 'varchar',
                        length: '80',
                        isNullable: true,
                        comment: 'mint payment address',
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        isNullable: false,
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        isNullable: false,
                        default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                    },
                ],
            }));
            await queryRunner.createIndex('launchpad_rounds', new TableIndex({
                name: 'uk_launchpad_rounds',
                isUnique: true,
                columnNames: [`launchpad_token_id`, `round_type`],
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropIndex('launchpad_rounds', 'uk_launchpad_rounds');
            await queryRunner.dropTable('launchpad_rounds');
        }
}

import { Table } from 'typeorm';

export class InitOriHash1656054543541 {
    constructor() {
        this.name = 'initOriHash1656054383510';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createTable(new Table({
                name: 'ori_hash',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        comment: '@desc ori_hash tabel primary key',
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'raw',
                        type: 'varchar',
                        length: '250',
                        isNullable: false,
                        comment: '@desc hash raw data',
                    },
                    {
                        name: 'alg',
                        type: 'tinyint',
                        default: 0,
                        isNullable: false,
                        comment: '@desc hash type: 0:sha256，1:keccak256，2:personalHash ...',
                    },
                    {
                        name: 'hash',
                        type: 'binary',
                        length: '66',
                        isUnique: true,
                        isNullable: false,
                        comment: '@desc raw hash data',
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
            await queryRunner.dropTable('ori_hash');
        }
}

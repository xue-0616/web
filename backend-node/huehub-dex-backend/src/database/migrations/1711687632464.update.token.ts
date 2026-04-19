import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class CreateTable1711687632464 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateToken1711687632464';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'xudt_type_hash',
                type: 'binary',
                length: '32',
                comment: 'xudt type hash',
                isNullable: true,
            }));
            await queryRunner.createIndex('tokens', new TableIndex({
                name: 'u_type_hash_key',
                columnNames: [`xudt_type_hash`],
                isUnique: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('tokens', 'xudt_type_hash');
            await queryRunner.dropIndex('tokens', 'u_type_hash_key');
        }
}

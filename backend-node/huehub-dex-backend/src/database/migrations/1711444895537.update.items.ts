import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateTable1711444895537 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateItems1711444895537';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('items', new TableColumn({
                name: 'is_cancel',
                type: 'tinyint',
                unsigned: true,
                comment: 'item is cancel',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.dropColumn('items', 'is_cancel');
        }
}

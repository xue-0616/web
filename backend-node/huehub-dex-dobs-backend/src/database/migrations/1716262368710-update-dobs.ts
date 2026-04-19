import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDobs1716262368710 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDobs1716262368710';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('dobs', 'spore_hex_icon', new TableColumn({
                name: 'spore_icon_url',
                type: 'varchar',
                length: '255',
                isNullable: true,
                comment: 'spore icon url',
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('dobs', 'spore_hex_icon', new TableColumn({
                name: 'spore_hex_icon',
                type: 'blob',
                isNullable: true,
                comment: 'spore icon hex data',
            }));
        }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeployTokens1712925471623 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeployTokens1712925471623';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'minted_amount', new TableColumn({
                name: 'minted_amount',
                type: 'bigint',
                unsigned: true,
                comment: 'minted_amount',
                isNullable: false,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('deployment_tokens', 'minted_amount', new TableColumn({
                name: 'minted_amount',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'minted_amount',
                isNullable: false,
            }));
        }
}

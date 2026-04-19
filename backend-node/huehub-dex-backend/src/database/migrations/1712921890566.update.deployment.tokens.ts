import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateDeployment1712921890566 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateDeployment1712921890566';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('deployment_tokens', new TableColumn({
                name: 'amount_per_mint_new',
                type: 'decimal',
                length: '60,0',
                unsigned: true,
                comment: 'amount_per_mint',
                isNullable: false,
            }));
            await queryRunner.query(`UPDATE deployment_tokens SET amount_per_mint_new = amount_per_mint;`);
            await queryRunner.dropColumn('deployment_tokens', 'amount_per_mint');
            await queryRunner.renameColumn('deployment_tokens', 'amount_per_mint_new', 'amount_per_mint');
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}

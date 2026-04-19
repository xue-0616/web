import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateTokens1713843094343 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateTokens1713843094343';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('tokens', new TableColumn({
                name: 'xudt_args_new',
                type: 'VARBINARY',
                length: '64',
                comment: 'ckb xudt type args',
                isNullable: false,
            }));
            await queryRunner.dropIndex('tokens', 'u_token_key');
            await queryRunner.query(`UPDATE tokens SET xudt_args_new = xudt_args;`);
            await queryRunner.dropColumn('tokens', 'xudt_args');
            await queryRunner.renameColumn('tokens', 'xudt_args_new', 'xudt_args');
        }
    async down(queryRunner: QueryRunner): Promise<void> { }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateLaunchpadTokens1718678483441 implements MigrationInterface {
    constructor() {
        this.name = 'UpdateLaunchpadTokens1718678483441';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('launchpad_tokens', 'xudt_args', new TableColumn({
                name: 'xudt_args',
                type: 'varbinary',
                length: '64',
                comment: 'ckb xudt type args',
                isNullable: true,
            }));
            await queryRunner.changeColumn('launchpad_tokens', 'xudt_type_hash', new TableColumn({
                name: 'xudt_type_hash',
                type: 'binary',
                length: '32',
                comment: 'xudt type hash',
                isNullable: true,
            }));
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.changeColumn('launchpad_tokens', 'xudt_args', new TableColumn({
                name: 'xudt_args',
                type: 'varbinary',
                length: '64',
                comment: 'ckb xudt type args',
                isNullable: false,
            }));
            await queryRunner.changeColumn('launchpad_tokens', 'xudt_type_hash', new TableColumn({
                name: 'xudt_type_hash',
                type: 'binary',
                length: '32',
                comment: 'xudt type hash',
                isNullable: false,
            }));
        }
}

import { TableColumn } from 'typeorm';

export class UpdateAccountEmail1657593946440 {
    constructor() {
        this.name = 'UpdateAccountEmail1657593946440';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'email_in_lower_case',
                type: 'varchar',
                isNullable: true,
                isUnique: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('accounts', 'email_in_lower_case');
        }
}

import { TableColumn } from 'typeorm';

export class UpdateAuthenticators1659526666680 {
    constructor() {
        this.name = 'UpdateAuthenticators1659526666680';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('authenticators', new TableColumn({
                name: 'status',
                type: 'tinyint',
                comment: '@desc  2fa open status type: 0:close,1:open',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('authenticators', 'status');
        }
}

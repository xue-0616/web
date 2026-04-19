import { TableColumn } from 'typeorm';

export class UpdateKeyListWeb3AuthAddress1684240491241 {
    constructor() {
        this.name = 'UpdateKeyListWeb3AuthAddress1684240491241';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('key_list', new TableColumn({
                name: 'web3_auth_address',
                type: 'binary',
                length: '20',
                comment: '@desc  web3 auth bind key',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'web3_auth_address');
        }
}

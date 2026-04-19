import { TableColumn } from 'typeorm';

export class UpdateKeyListKeyType1674974953726 {
    constructor() {
        this.name = 'UpdateKeyListKeyType1674974953726';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('key_list', new TableColumn({
                name: 'key_type',
                type: 'tinyint',
                default: 0,
                comment: '@desc  keyset type, 0: MPC key, 1:snaps key，2 Metamask key',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'key_type');
        }
}

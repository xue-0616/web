import { TableColumn } from 'typeorm';

export class UpdateKeyListUuid1660553402069 {
    constructor() {
        this.name = 'UpdateKeyListUuid1660553402069';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('key_list', new TableColumn({
                name: 'uuid',
                type: 'varchar',
                length: '40',
                comment: '@desc local key uuid',
                isNullable: false,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'uuid');
        }
}

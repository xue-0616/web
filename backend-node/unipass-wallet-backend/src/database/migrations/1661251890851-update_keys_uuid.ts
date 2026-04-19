import { TableColumn } from 'typeorm';

export class UpdateKeysUuid1661251890851 {
    constructor() {
        this.name = 'UpdateKeysUuid1661251890851';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('key_list', 'uuid', new TableColumn({
                name: 'uuid',
                type: 'varchar',
                length: '40',
                comment: '@desc local key uuid',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'uuid');
        }
}

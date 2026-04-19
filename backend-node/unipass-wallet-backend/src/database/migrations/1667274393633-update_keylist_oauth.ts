import { TableColumn } from 'typeorm';

export class UpdateKeylistOauth1667274393633 {
    constructor() {
        this.name = 'UpdateKeylistOauth1667274393633';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'password');
        }
    async down(queryRunner: any) {
            await queryRunner.addColumn('key_list', new TableColumn({
                name: 'password',
                type: 'binary',
                length: '32',
                isNullable: false,
                comment: '@desc hash(master key address)',
            }));
        }
}

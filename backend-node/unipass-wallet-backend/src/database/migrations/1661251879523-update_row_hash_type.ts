import { TableColumn } from 'typeorm';

export class UpdateRowHashType1661251879523 {
    constructor() {
        this.name = 'UpdateRowHashType1661251879523';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('ori_hash', 'raw', new TableColumn({
                name: 'raw',
                type: 'json',
                isNullable: false,
                comment: '@desc hash raw data',
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('ori_hash', 'raw');
        }
}

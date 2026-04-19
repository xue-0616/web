import { TableColumn } from 'typeorm';

export class UpdateOriHash1667801119851 {
    constructor() {
        this.name = 'UpdateOriHash1667801119851';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('ori_hash', 'hash', new TableColumn({
                name: 'hash',
                type: 'binary',
                length: '32',
                isUnique: true,
                isNullable: false,
                comment: '@desc raw hash data',
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.changeColumn('ori_hash', 'hash', new TableColumn({
                name: 'hash',
                type: 'binary',
                length: '66',
                isUnique: true,
                isNullable: false,
                comment: '@desc raw hash data',
            }));
        }
}

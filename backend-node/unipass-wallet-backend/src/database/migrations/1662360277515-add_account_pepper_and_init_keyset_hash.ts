import { TableColumn } from 'typeorm';

export class AaddAccountPepperAndInitKeysetHash1662360277515 {
    constructor() {
        this.name = 'AddAccountPepperAndInitKeysetHash1662360277515';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'pepper',
                type: 'varchar',
                length: '66',
                isNullable: true,
            }));
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'init_keyset_hash',
                type: 'binary',
                length: '66',
                isUnique: false,
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('accounts', 'pepper');
            await queryRunner.dropColumn('accounts', 'init_keyset_hash');
        }
}

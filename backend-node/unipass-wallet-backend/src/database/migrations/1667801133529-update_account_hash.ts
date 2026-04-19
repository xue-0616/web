import { TableColumn } from 'typeorm';

export class UpdateAccountHash1667801133529 {
    constructor() {
        this.name = 'UpdateAccountHash1667801133529';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('accounts', 'pending_keyset_hash', new TableColumn({
                name: 'pending_keyset_hash',
                type: 'binary',
                length: '32',
                isUnique: false,
                isNullable: true,
            }));
            await queryRunner.changeColumn('accounts', 'keyset_hash', new TableColumn({
                name: 'keyset_hash',
                type: 'binary',
                length: '32',
                isUnique: false,
                isNullable: true,
            }));
            await queryRunner.changeColumn('accounts', 'init_keyset_hash', new TableColumn({
                name: 'init_keyset_hash',
                type: 'binary',
                length: '32',
                isUnique: false,
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.changeColumn('accounts', 'hash', new TableColumn({
                name: 'pending_keyset_hash',
                type: 'binary',
                length: '66',
                isUnique: true,
                isNullable: false,
                comment: '@desc raw hash data',
            }));
            await queryRunner.changeColumn('accounts', 'hash', new TableColumn({
                name: 'keyset_hash',
                type: 'binary',
                length: '66',
                isUnique: true,
                isNullable: false,
                comment: '@desc raw hash data',
            }));
            await queryRunner.changeColumn('accounts', 'hash', new TableColumn({
                name: 'init_keyset_hash',
                type: 'binary',
                length: '66',
                isUnique: true,
                isNullable: false,
                comment: '@desc raw hash data',
            }));
        }
}

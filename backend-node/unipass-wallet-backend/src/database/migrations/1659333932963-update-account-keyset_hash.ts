import { TableColumn } from 'typeorm';

export class UpdateAccountKeysetHash1659333932963 {
    constructor() {
        this.name = 'UpdateAccountKeysetHash1659333932963';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'keyset_hash',
                type: 'binary',
                length: '66',
                isNullable: true,
            }));
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'pending_keyset_hash',
                type: 'binary',
                length: '66',
                isUnique: false,
                isNullable: true,
            }));
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'pending_created_at',
                type: 'timestamp',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('accounts', 'keyset_hash');
            await queryRunner.dropColumn('accounts', 'pending_keyset_hash');
        }
}

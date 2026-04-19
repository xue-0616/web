import { TableColumn } from 'typeorm';

export class UpdateAccountSource1665554603438 {
    constructor() {
        this.name = 'UpdateAccountSource1665554603438';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('accounts', new TableColumn({
                name: 'source',
                type: 'varchar',
                length: '32',
                default: '"unipass"',
                comment: '@desc account signup source',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('accounts', 'source');
        }
}

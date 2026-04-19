import { TableColumn } from 'typeorm';

export class UpdateGasConsumptionHistoryFeeTransaction1688366205447 {
    constructor() {
        this.name = 'UpdateGasConsumptionHistoryFeeTransaction1688366205447';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'fee_transaction',
                type: 'json',
                isNullable: true,
                comment: '@desc fee tx',
            }));
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'error_reason',
                type: 'varchar',
                length: '255',
                isNullable: true,
                comment: '@desc tx fail reason',
            }));
            await queryRunner.changeColumn('gas_consumption_history', 'transaction', new TableColumn({
                name: 'custom_transactions',
                type: 'json',
                isNullable: false,
                comment: '@desc customer tx',
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('gas_consumption_history', 'fee_transaction');
            await queryRunner.dropColumn('gas_consumption_history', 'error_reason');
            await queryRunner.changeColumn('gas_consumption_history', 'custom_transactions', new TableColumn({
                name: 'transaction',
                type: 'json',
                isNullable: false,
                comment: '@desc customer tx',
            }));
        }
}

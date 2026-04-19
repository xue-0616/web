import { TableColumn } from 'typeorm';

export class UpdateConsumptionHistoryFeeInfo1688455376796 {
    constructor() {
        this.name = 'UpdateConsumptionHistoryFeeInfo1688455376796';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'native_token_usd_price',
                type: 'decimal',
                precision: 20,
                scale: 4,
                isNullable: true,
                comment: '@desc native token price',
            }));
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'user_paid_token_usd_price',
                type: 'decimal',
                precision: 20,
                scale: 4,
                isNullable: true,
                comment: '@desc user paid token price',
            }));
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'tank_paid_token_usd_price',
                type: 'decimal',
                precision: 20,
                scale: 4,
                isNullable: true,
                comment: '@desc tank token price',
            }));
            await queryRunner.dropColumn('gas_consumption_history', 'user_paid_token_rate');
            await queryRunner.dropColumn('gas_consumption_history', 'tank_paid_token_rate');
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('gas_consumption_history', 'native_token_usd_price');
            await queryRunner.dropColumn('gas_consumption_history', 'user_paid_token_usd_price');
            await queryRunner.dropColumn('gas_consumption_history', 'tank_paid_token_usd_price');
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'user_paid_token_rate',
                type: 'decimal',
                precision: 20,
                scale: 19,
                isNullable: true,
            }));
            await queryRunner.addColumn('gas_consumption_history', new TableColumn({
                name: 'tank_paid_token_rate',
                type: 'decimal',
                precision: 20,
                scale: 19,
                isNullable: true,
            }));
        }
}

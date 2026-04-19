import { TableColumn } from 'typeorm';

export class UpdateUserActionPointDecimal1681891114733 {
    constructor() {
        this.name = 'UpdateUserActionPointDecimal1681891114733';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.addColumn('user_action_point', new TableColumn({
                name: 'decimal',
                type: 'tinyint',
                unsigned: true,
                default: 0,
                isNullable: false,
                comment: '@desc ap decimal',
            }));
            await queryRunner.changeColumn('user_action_point', 'discount', new TableColumn({
                name: 'discount',
                type: 'tinyint',
                unsigned: true,
                default: 100,
                isNullable: false,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('user_action_point', 'decimal');
            await queryRunner.changeColumn('user_action_point', 'discount', new TableColumn({
                name: 'discount',
                type: 'tinyint',
                unsigned: true,
                default: 1,
                isNullable: false,
            }));
        }
}

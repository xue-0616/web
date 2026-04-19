import { TableColumn } from 'typeorm';

export class UpdateKeysPassword1657611181688 {
    constructor() {
        this.name = 'UpdateKeysPassword1657611181688';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.changeColumn('key_list', 'password', new TableColumn({
                name: 'password',
                type: 'varchar',
                length: '200',
                isNullable: true,
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropColumn('key_list', 'password');
        }
}

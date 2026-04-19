import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdatePsbt1712219173476 implements MigrationInterface {
    constructor() {
        this.name = 'UpdatePsbt1712219173476';
    }
    name: string;
    async up(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.addColumn('items', new TableColumn({
                name: 'unsigned_psbt_new',
                type: 'blob',
                isNullable: false,
                comment: 'Sell unsigned psbt',
            }));
            await queryRunner.query(`UPDATE items SET unsigned_psbt_new = unsigned_psbt;`);
            await queryRunner.dropColumn('items', 'unsigned_psbt');
            await queryRunner.renameColumn('items', 'unsigned_psbt_new', 'unsigned_psbt');
            await queryRunner.addColumn('orders', new TableColumn({
                name: 'btc_tx_new',
                type: 'blob',
                isNullable: false,
                comment: 'btc sig tx',
            }));
            await queryRunner.query(`UPDATE orders SET btc_tx_new = btc_tx;`);
            await queryRunner.dropColumn('orders', 'btc_tx');
            await queryRunner.renameColumn('orders', 'btc_tx_new', 'btc_tx');
        }
    async down(queryRunner: QueryRunner): Promise<void> {
            await queryRunner.renameColumn('items', 'unsigned_psbt', 'unsigned_psbt_old');
            await queryRunner.addColumn('items', new TableColumn({
                name: 'unsigned_psbt',
                type: 'VARBINARY',
                length: '1024',
                isNullable: false,
                comment: 'Sell unsigned psbt',
            }));
            await queryRunner.query(`UPDATE items SET unsigned_psbt = unsigned_psbt_old;`);
            await queryRunner.dropColumn('items', 'unsigned_psbt_old');
            await queryRunner.renameColumn('orders', 'btc_tx', 'btc_tx_old');
            await queryRunner.addColumn('orders', new TableColumn({
                name: 'btc_tx',
                type: 'VARBINARY',
                length: '5000',
                isNullable: false,
                comment: 'btc sig tx',
            }));
            await queryRunner.query(`UPDATE orders SET btc_tx = btc_tx_old;`);
            await queryRunner.dropColumn('orders', 'btc_tx_old');
        }
}

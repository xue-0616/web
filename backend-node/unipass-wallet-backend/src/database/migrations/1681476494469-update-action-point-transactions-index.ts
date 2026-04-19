import { TableIndex } from 'typeorm';

export class UpdateActionPointTransactionsIndex1681476494469 {
    constructor() {
        this.name = 'UpdateActionPointTransactionsIndex1681476494469';
    }
    name: any;
    async up(queryRunner: any) {
            await queryRunner.createIndex('user_action_point_transactions', new TableIndex({
                name: 'txs_relayer_hash_ind',
                columnNames: ['relayer_tx_hash'],
            }));
        }
    async down(queryRunner: any) {
            await queryRunner.dropIndex('user_action_point_transactions', 'txs_relayer_hash_ind');
        }
}

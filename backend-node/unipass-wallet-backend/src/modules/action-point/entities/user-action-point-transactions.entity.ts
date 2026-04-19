import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './base.time';
import { bufferTransformer } from '../../../shared/utils';

export enum IApTransactionStatus {
    PENDING = 0,
    COMPLETE = 1,
    FAIL = 2,
}

@Entity({ name: 'user_action_point_transactions' })
export class UserActionPointTransactionsEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    accountId: any;
    @Column()
    historyId: any;
    @Column()
    relayerId: any;
    @Column()
    transaction: any;
    @Column()
    actionPoint: any;
    @Column({
        transformer: bufferTransformer,
    })
    relayerTxHash: any;
    @Column()
    status: any;
    @Column({
        transformer: bufferTransformer,
    })
    chainTxHash: any;
}

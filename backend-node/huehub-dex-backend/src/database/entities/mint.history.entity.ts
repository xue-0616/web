import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import { LaunchpadTokenEntity } from './launchpad.tokens.entity';
import { LaunchpadRoundEntity } from './launchpad.rounds.entity';
import Decimal from 'decimal.js';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

export enum IssueStatus {
    MintInit = 0,
    MintPending = 1,
    MintComplete = 2,
    MintFailed = 3,
    IssuePending = 4,
    IssueComplete = 5,
    IssueFailed = 6,
}

@Entity({ name: 'mint_history' })
export class MintHistoryEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    launchpadTokenId: number;
    @Column()
    launchpadRoundId: number;
    @Column()
    address: string;
    @Column({
        transformer: bufferTransformer,
    })
    btcTx: string;
    @Column()
    paymasterAddress: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    serviceFeeAmount: Decimal;
    @Column({
        transformer: bufferTransformer,
    })
    btcTxHash: string;
    @Column({
        transformer: bufferTransformer,
    })
    issueBtcTxHash: string;
    @Column({
        transformer: bufferTransformer,
    })
    issueCkbTxHash: string;
    @Column()
    status: IssueStatus;
    @ManyToOne(() => LaunchpadTokenEntity)
    launchpadToken: LaunchpadTokenEntity;
    @ManyToOne(() => LaunchpadRoundEntity)
    launchpadRound: LaunchpadRoundEntity;
}

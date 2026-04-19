import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { multipleAmountTransformer } from '../../common/utils/multiple.amount.transformer';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { jsonBufferTransformer } from '../../common/utils/json.buffer.transformer';
import { btcBufferTransformer } from '../../common/utils/btc.transformer';

export enum DeploymentTokenStatus {
    Init = 0,
    DeployTokenPending = 1,
    DeployTokenBtcSuccess = 2,
    DeployTokenBtcFail = 3,
    DeployTokenSuccess = 4,
    DeployTokenSuccessFail = 5,
}

@Entity({ name: 'deployment_tokens' })
export class DeploymentTokenEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    tokenId!: number;
    @Column()
    decimal!: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
        precision: 60,
        scale: 0,
    })
    totalSupply!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
        precision: 60,
        scale: 0,
    })
    amountPerMint!: Decimal;
    @Column()
    ckbTimeLockAddress!: string;
    @Column()
    mintedAmount!: Decimal;
    @Column({ nullable: true })
    ckbPrepareTxHash!: string;
    @Column({
        type: 'decimal',
        precision: 9,
        scale: 8,
        transformer: decimalTransformer,
    })
    mintedRatio!: Decimal;
    @Column()
    lockedBtcAge!: number;
    @Column({
        type: 'varchar',
        length: 256,
        transformer: multipleAmountTransformer,
    })
    lockedBtcAmounts!: number[];
    @Column()
    deployerAddress!: string;
    @Column()
    paymasterAddress!: string;
    @Column({
        type: 'binary',
        length: 32,
        transformer: bufferTransformer,
    })
    prepareDeploymentCkbTxHash!: string;
    @Column({
        transformer: jsonBufferTransformer,
    })
    deploymentTx!: string;
    @Column({
        type: 'binary',
        length: 32,
        transformer: btcBufferTransformer,
    })
    deploymentTxHash!: string;
    @Column({
        type: 'binary',
        length: 32,
        transformer: bufferTransformer,
    })
    deploymentCkbTxHash!: string;
    @Column()
    relativeStartBlock!: number;
    @Column({
        type: 'decimal',
        precision: 9,
        scale: 8,
        transformer: decimalTransformer,
    })
    deployFeeAmount!: Decimal;
    @Column()
    btcTxBlockHeight!: number;
    @Column()
    status!: DeploymentTokenStatus;
    @Column()
    deployedTime!: Date;
    @OneToOne(() => TokenEntity, (token) => token.deploymentToken)
    token!: TokenEntity;
}

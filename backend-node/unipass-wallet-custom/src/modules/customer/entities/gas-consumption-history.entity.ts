import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from '../../custom-auth/entities';
import { bufferTransformer } from '../../../shared/utils';

export enum ConsumptionStatus {
    Init = 0,
    Pending = 1,
    OnChainComplete = 2,
    OnChainFailed = 3,
    NotificationCompleted = 4,
    NotificationFailed = 5,
}

export enum PolicyType {
    ContractPolicy = 0,
    CustomPolicy = 1,
    NoPolicy = 2,
}

@Entity({ name: 'gas_consumption_history' })
export class GasConsumptionHistoryEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    status: any;
    @Column()
    policyType: any;
    @Column()
    nonce: any;
    @Column({
        transformer: bufferTransformer,
    })
    relayerTxHash: any;
    @Column({
        type: 'json',
    })
    customTransactions: any;
    @Column({
        type: 'json',
    })
    feeTransaction: any;
    @Column()
    chainId: any;
    @Column()
    appId: any;
    @Column()
    errorReason: any;
    @Column({
        transformer: bufferTransformer,
    })
    userAddress: any;
    @Column()
    policyId: any;
    @Column({
        transformer: bufferTransformer,
    })
    chainTxHash: any;
    @Column({
        type: 'decimal',
    })
    userPaidGas: any;
    @Column({
        transformer: bufferTransformer,
    })
    userPaidToken: any;
    @Column({
        type: 'decimal',
    })
    userPaidFee: any;
    @Column({
        type: 'decimal',
    })
    userPaidTokenUsdPrice: any;
    @Column({
        type: 'decimal',
    })
    nativeTokenUsdPrice: any;
    @Column({
        type: 'decimal',
    })
    tankPaidGas: any;
    @Column({
        transformer: bufferTransformer,
    })
    tankPaidToken: any;
    @Column({
        type: 'decimal',
    })
    tankPaidFee: any;
    @Column({
        type: 'decimal',
    })
    tankPaidTokenUsdPrice: any;
    @Column({
        type: 'decimal',
    })
    consumedGasUsed: any;
    @Column({
        type: 'decimal',
    })
    consumedGasPrice: any;
    @Column({
        type: 'decimal',
    })
    consumedFee: any;
}

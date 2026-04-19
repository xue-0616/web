import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { ItemEntity } from './item.entity';
import { MyBaseEntity } from './base.entity';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

export enum OrderStatus {
    init = 0,
    btcPending = 1,
    btcComplete = 2,
    btcFailed = 3,
    ckbComplete = 4,
    ckbFailed = 5,
}

export enum OrderType {
    Buy = 0,
    Unlist = 1,
}

@Entity({ name: 'orders' })
export class OrderEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    buyerAddress!: string;
    @Column({
        transformer: bufferTransformer,
    })
    btcTx!: string;
    @Column({
        transformer: bufferTransformer,
    })
    ckbTx!: string;
    @Column({
        transformer: bufferTransformer,
    })
    btcTxHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    ckbTxHash!: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    btcTxFee!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    orderFee!: Decimal;
    @Column()
    type!: OrderType;
    @Column()
    status!: OrderStatus;
    @OneToMany(() => ItemEntity, (item) => item.order)
    items!: ItemEntity[];
}

import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderEntity } from './order.entity';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { TokenEntity } from './token.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { jsonBufferTransformer } from '../../common/utils/json.buffer.transformer';

export enum ItemStatus {
    Init = 0,
    Pending = 1,
    Complete = 2,
    Invalid = 3,
}

@Entity({ name: 'items' })
export class ItemEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    isCancel!: boolean | null;
    @Column()
    tokenId!: number;
    @Column()
    orderId!: number | null;
    @Column()
    sellerAddress!: string;
    @Column()
    buyerAddress!: string | null;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    price!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    btcValue!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    tokenAmount!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    pricePerToken!: Decimal;
    @Column({
        transformer: bufferTransformer,
    })
    txHash!: string;
    @Column()
    index!: number;
    @Column({
        transformer: jsonBufferTransformer,
    })
    unsignedPsbt!: string;
    @Column({
        transformer: jsonBufferTransformer,
    })
    psbtSig!: string;
    @Column()
    status!: ItemStatus;
    @ManyToOne(() => OrderEntity)
    order!: OrderEntity;
    @ManyToOne(() => TokenEntity)
    token!: TokenEntity;
}

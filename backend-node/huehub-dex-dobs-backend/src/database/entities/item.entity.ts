import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrderEntity } from './order.entity';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { CollectionEntity } from './collection.entity';
import { DobsEntity } from './dobs.entity';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

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
    collectionId!: number;
    @Column()
    dobsId!: number;
    @Column()
    orderId!: number | null;
    @Column()
    sellerAddress!: string;
    @Column()
    buyerAddress!: string | null;
    @Column({
        transformer: bufferTransformer,
    })
    txHash!: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    btcValue!: Decimal;
    @Column()
    index!: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    price!: Decimal;
    @Column()
    isCancel!: boolean | null;
    @Column({
        transformer: bufferTransformer,
    })
    psbtSig!: string;
    @Column({
        transformer: bufferTransformer,
    })
    unsignedPsbt!: string;
    @Column()
    status!: ItemStatus;
    @Column()
    peningTime!: number | null;
    @Column()
    completeTime!: number | null;
    @ManyToOne(() => OrderEntity)
    order!: OrderEntity;
    @ManyToOne(() => CollectionEntity)
    collection!: CollectionEntity;
    @ManyToOne(() => DobsEntity)
    dobs!: DobsEntity;
}

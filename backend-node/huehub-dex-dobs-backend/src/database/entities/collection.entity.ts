import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { utf8bufferTransformer } from '../../common/utils/utf8.buffer.transformer';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

export enum DobsStatus {
    Listing = 0,
    Pending = 1,
    Delist = 2,
}

@Entity({ name: 'collections' })
export class CollectionEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    name!: string;
    @Column()
    description!: string;
    @Column({
        transformer: utf8bufferTransformer,
    })
    creator!: string;
    @Column()
    iconUrl!: string;
    @Column({
        transformer: bufferTransformer,
    })
    clusterTypeArgs!: string;
    @Column({
        transformer: bufferTransformer,
    })
    clusterTypeHash!: string;
    @Column()
    decimals!: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    totalSupply!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    lastSales!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    lastVolume!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    lastHolders!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    marketCap!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    floorPrice!: Decimal;
    @Column()
    status!: DobsStatus;
}

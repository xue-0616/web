import { Column, Entity, ManyToOne, PrimaryColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { CollectionEntity } from './collection.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

@Entity({ name: 'statistics' })
export class StatisticEntity extends MyBaseEntity {
    @PrimaryColumn()
    collectionId!: number;
    @PrimaryColumn()
    time!: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    sales!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    holders!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    volume!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    btcUsdPrice!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    floorPrice!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    marketCap!: Decimal;
    @ManyToOne(() => CollectionEntity)
    collection!: CollectionEntity;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { TokenEntity } from './token.entity';
import { MyBaseEntity } from './base.entity';
import { DeploymentTokenEntity } from './deployment.token.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

@Entity({ name: 'token_statistics' })
export class TokenStatisticEntity extends MyBaseEntity {
    @PrimaryColumn()
    tokenId!: number;
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
    floorPrice!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    btcUsdPrice!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    volume!: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    marketCap!: Decimal;
    @ManyToOne(() => TokenEntity)
    token!: TokenEntity;
    @ManyToOne(() => DeploymentTokenEntity)
    @JoinColumn({ name: 'token_id' })
    deployToken!: DeploymentTokenEntity;
}

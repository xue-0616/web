import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import Decimal from 'decimal.js';
import { MyBaseEntity } from './base.entity';
import { DeploymentTokenEntity } from './deployment.token.entity';
import { TokenIconEntity } from './tokens.icon.entity';
import { bufferTransformer } from '../../common/utils/buffer.transformer';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

export enum TokenStatus {
    Listing = 0,
    Pending = 1,
    Delist = 2,
}

@Entity({ name: 'tokens' })
export class TokenEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    name!: string;
    @Column()
    symbol!: string;
    @Column()
    lowercaseSymbol!: string;
    @Column()
    iconUrl!: string;
    @Column({
        transformer: bufferTransformer,
    })
    xudtCodeHash!: string;
    @Column({
        transformer: bufferTransformer,
    })
    xudtArgs!: string;
    @Column({
        transformer: bufferTransformer,
    })
    xudtTypeHash!: string;
    @Column()
    decimals!: number;
    @Column()
    deploymentTokenId!: number;
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
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    lastVolume!: Decimal;
    @Column()
    status!: TokenStatus;
    @OneToOne(() => DeploymentTokenEntity, (deploymentToken) => deploymentToken.tokenId)
    @JoinColumn()
    deploymentToken!: DeploymentTokenEntity;
    @OneToOne(() => TokenIconEntity)
    @JoinColumn({ name: 'id' })
    tokenIconData!: TokenIconEntity;
    @Column()
    deployedTime!: number;
}

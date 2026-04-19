import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import { LaunchpadTokenEntity } from './launchpad.tokens.entity';
import decimal, { Decimal } from 'decimal.js';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

export enum LaunchpadRoundStatus {
    NotStart = 0,
    InProgress = 1,
    Complete = 2,
}

export enum RoundType {
    Whitelist = 0,
    PublicMint = 1,
}

@Entity({ name: 'launchpad_rounds' })
export class LaunchpadRoundEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    launchpadTokenId: number;
    @Column()
    roundName: string;
    @Column()
    roundIndex: number;
    @Column()
    startTime: number;
    @Column()
    endTime: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    roundSupply: Decimal;
    @Column()
    eligibilityCriteria: string;
    @Column()
    roundType: RoundType;
    @Column()
    addressMintLimit: number;
    @Column()
    roundRate: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    mintedAmount: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    paymentAmount: Decimal;
    @Column()
    paymentAddress: string;
    @Column()
    whitelistLink: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    amountPerMint: decimal;
    @Column()
    status: LaunchpadRoundStatus;
    @Column()
    issueTime: number;
    @ManyToOne(() => LaunchpadTokenEntity)
    launchpadToken: LaunchpadTokenEntity;
}

import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import Decimal from 'decimal.js';
import { LaunchpadRoundEntity } from './launchpad.rounds.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { bufferTransformer } from '../../common/utils/buffer.transformer';

export enum LaunchpadTokenStatus {
    Init = 0,
    Pending = 1,
    Complete = 2,
}

@Entity({ name: 'launchpad_tokens' })
export class LaunchpadTokenEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    totalSupply: Decimal;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    totalIssued: Decimal;
    @Column({
        transformer: bufferTransformer,
    })
    xudtArgs: string;
    @Column({
        transformer: bufferTransformer,
    })
    xudtTypeHash: string;
    @Column()
    projectName: string;
    @Column()
    symbol: string;
    @Column()
    decimal: number;
    @Column()
    status: LaunchpadTokenStatus;
    @OneToMany(() => LaunchpadRoundEntity, (round) => round.launchpadToken)
    rounds: LaunchpadRoundEntity[];
}

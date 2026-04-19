import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import Decimal from 'decimal.js';
import { LaunchpadTokenEntity } from './launchpad.tokens.entity';
import { LaunchpadRoundEntity } from './launchpad.rounds.entity';
import { decimalTransformer } from '../../common/utils/decimal.transformer';

@Entity({ name: 'whitelist' })
export class WhitelistEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id: number;
    @Column()
    launchpadTokenId: number;
    @Column()
    launchpadRoundId: number;
    @Column()
    address: string;
    @Column({
        type: 'decimal',
        transformer: decimalTransformer,
    })
    amountPerMint: Decimal;
    @Column()
    claimed: boolean;
    @Column()
    mintCount: number;
    @ManyToOne(() => LaunchpadTokenEntity)
    launchpadToken: LaunchpadTokenEntity;
    @ManyToOne(() => LaunchpadRoundEntity)
    launchpadRound: LaunchpadRoundEntity;
}

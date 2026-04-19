import { Entity, Column, Index } from 'typeorm';
import { Chain } from '../../../common/genericChain';

export enum ChainIdDao {
    Ethereum = "1",
}
@Index('user_uk', ['chain', 'chainId', 'userId'], { unique: true })
@Index('trading_settings_pkey', ['id'], { unique: true })
@Entity('trading_settings', { schema: 'public' })
export class TradingSetting {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'smallint', name: 'chain', enum: Chain })
  chain!: Chain;

  @Column({
        type: 'bigint',
        name: 'chain_id',
        nullable: true,
        enum: ChainIdDao,
    })
  chainId!: ChainIdDao | null;

  @Column('boolean', { name: 'is_mev_enabled' })
  isMevEnabled!: boolean;

  @Column('numeric', { name: 'slippage' })
  slippage!: string;

  @Column('bigint', { name: 'priority_fee' })
  priorityFee!: string;

  @Column('bigint', { name: 'bribery_amount' })
  briberyAmount!: string;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}

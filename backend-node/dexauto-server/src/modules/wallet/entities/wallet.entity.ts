import { Entity, Column, Index } from 'typeorm';
import { Chain } from '../../../common/genericChain';

@Index('address_uk', ['address', 'chain'], { unique: true })
@Index('user_idx_uk', ['chain', 'index', 'userId'], { unique: true })
@Index('wallets_pkey', ['id'], { unique: true })
@Entity('wallets', { schema: 'public' })
export class Wallet {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('smallint', { name: 'index' })
  index!: number;

  @Column({ type: 'smallint', name: 'chain', enum: Chain })
  chain!: Chain;

  @Column('bytea', { name: 'address' })
  address!: Buffer;

  @Column('bytea', { name: 'op_key' })
  opKey!: Buffer;

  @Column('character varying', { name: 'alias', nullable: true, length: 32 })
  alias!: string | null;

  @Column('boolean', { name: 'is_default' })
  isDefault!: boolean;

  @Column('boolean', { name: 'is_active' })
  isActive!: boolean;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

  @Column('bigint', { name: 'buy_txs_count' })
  buyTxsCount!: string;

  @Column('bigint', { name: 'sell_txs_count' })
  sellTxsCount!: string;

  @Column('bigint', { name: 'trading_txs_count' })
  tradingTxCount!: string;

  @Column('numeric', { name: 'total_buy_amount_usd' })
  totalBuyAmountUsd!: string;

  @Column('numeric', { name: 'total_sell_amount_usd' })
  totalSellAmountUsd!: string;

  @Column('bigint', { name: 'deposit_txs_count' })
  depositTxsCount!: string;

  @Column('bigint', { name: 'withdraw_txs_count' })
  withdrawTxsCount!: string;

  @Column('bigint', { name: 'transfer_txs_count' })
  transferTxsCount!: string;

  @Column('numeric', { name: 'total_deposit_amount_usd' })
  totalDepositAmountUsd!: string;

  @Column('numeric', { name: 'total_withdraw_amount_usd' })
  totalWithdrawAmountUsd!: string;

  @Column('numeric', { name: 'realized_profit_usd' })
  realizedProfitUsd!: string;

}

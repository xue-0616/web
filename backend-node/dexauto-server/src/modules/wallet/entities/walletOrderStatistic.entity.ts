import { Entity, Column, Index } from 'typeorm';

@Index('wallet_order_statistics_pkey', ['id'], { unique: true })
@Index('wallet_uk', ['tokenAddr', 'walletId'], { unique: true })
@Entity('wallet_order_statistics', { schema: 'public' })
export class WalletOrderStatistic {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'wallet_id' })
  walletId!: string;

  @Column('bytea', { name: 'token_addr' })
  tokenAddr!: Buffer;

  @Column('numeric', { name: 'buy_amount_usd' })
  buyAmountUsd!: string;

  @Column('numeric', { name: 'buy_normalized_amount' })
  buyNormalizedAmount!: string;

  @Column('numeric', { name: 'sell_amount_usd' })
  sellAmountUsd!: string;

  @Column('numeric', { name: 'sell_normalized_amount' })
  sellNormalizedAmount!: string;

  @Column('numeric', { name: 'buy_txs_count' })
  buyTxsCount!: string;

  @Column('numeric', { name: 'sell_txs_count' })
  sellTxsCount!: string;

  @Column('numeric', { name: 'total_txs_count' })
  totalTxsCount!: string;

  @Column('numeric', { name: 'realized_profit' })
  realizedProfit!: string;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}

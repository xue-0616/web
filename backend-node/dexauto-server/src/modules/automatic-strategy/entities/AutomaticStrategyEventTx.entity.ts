import { Entity, Column, Index } from 'typeorm';

@Index('automatic_strategy_event_txs_pkey', ['id'], { unique: true })
@Index('automatic_strategy_item_tx_uk', ['strategyId', 'triggerIndex', 'tokenMint', 'txId'], {
        unique: true,
    })
@Entity('automatic_strategy_event_txs', { schema: 'public' })
export class AutomaticStrategyEventTx {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'strategy_id' })
  strategyId!: string;

  @Column('uuid', { name: 'event_id' })
  eventId!: string;

  @Column('bytea', { name: 'tx_id' })
  txId!: Buffer;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

  @Column('integer', { name: 'trigger_index', nullable: true })
  triggerIndex!: number | null;

  @Column('bytea', { name: 'token_mint', nullable: true })
  tokenMint!: Buffer | null;

}

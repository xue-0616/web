import { Entity, Column, Index } from 'typeorm';
import { AutoTradeSellType, MonitorAddress, TriggerItem } from '../../automatic-strategy/entities/AutomaticStrategy.entity';

export enum AutomaticTradeStatus {
    None = 0,
    Pending = 1,
    Completed = 2,
    NotStarted = 3,
}

export interface AutomaticStrategyEventData {
    triggerItems: TriggerItem[];
    monitorAddress: MonitorAddress;
    tokenMint: string;
    tokenSymbol: string;
    tokenIcon: string;
    [key: string]: any;
}

export interface AutoTradeEvent {
    walletId: string;
    walletAddress: string;
    solNormalizedAmount: string;
    tradingOrderId?: string;
    status?: AutomaticTradeStatus;
    [key: string]: any;
}
@Index('automatic_strategy_events_pkey', ['id'], { unique: true })
@Index('auto_strategy_event_strategy_idx', ['strategyId'], {})
@Index('auto_strategy_event_token_idx', ['tokenMint'], {})
@Entity('automatic_strategy_events', { schema: 'public' })
export class AutomaticStrategyEvent {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'strategy_id' })
  strategyId!: string;

  @Column('bytea', { name: 'token_mint' })
  tokenMint!: string;

  @Column('character varying', { name: 'token_symbol', length: 32 })
  tokenSymbol!: string;

  @Column('character varying', { name: 'token_icon', length: 1024 })
  tokenIcon!: string;

  @Column('integer', { name: 'trigger_index' })
  triggerIndex!: number;

  @Column('jsonb', { name: 'trigger_event' })
  triggerEvent!: AutomaticStrategyEventData;

  @Column('numeric', { name: 'token_usd_price' })
  tokenUsdPrice!: string;

  @Column('uuid', { name: 'notify_id', nullable: true })
  notifyId!: string | null;

  @Column('uuid', { name: 'auto_trade_ids', array: true, nullable: true })
  autoTradeIds!: string[] | null;

  @Column('jsonb', { name: 'auto_trades', nullable: true })
  autoTrades!: AutoTradeEvent[] | null;

  @Column({
        type: 'smallint',
        name: 'auto_trade_status',
        nullable: true,
        enum: AutomaticTradeStatus,
        enumName: 'AutomaticTradeStatus',
    })
  autoTradeStatus!: AutomaticTradeStatus | null;

  @Column('bigint', {
        name: 'auto_trade_reserved_amount',
        nullable: true,
    })
  autoTradeReservedAmount!: string | null;

  @Column('numeric', {
        name: 'auto_trade_reserved_normalized_amount',
        nullable: true,
    })
  autoTradeReservedNormalizedAmount!: string | null;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}

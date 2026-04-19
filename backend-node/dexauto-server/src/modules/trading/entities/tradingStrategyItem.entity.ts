import { Entity, Column, Index } from 'typeorm';

export enum TradingStrategyItemType {
    StopLoss = 0,
    TakeProfit = 1,
}
@Index('trading_strategy_items_pkey', ['id'], { unique: true })
@Index('strategy_idx', ['strategyId'], {})
@Entity('trading_strategy_items', { schema: 'public' })
export class TradingStrategyItem {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'strategy_id' })
  strategyId!: string;

  @Column({
        type: 'smallint',
        name: 'item_type',
        enum: TradingStrategyItemType,
        enumName: 'TradingStrategyItemType',
    })
  itemType!: TradingStrategyItemType;

  @Column('numeric', { name: 'trigger' })
  trigger!: string;

  @Column('numeric', { name: 'sell_rate' })
  sellRate!: string;

  @Column('boolean', { name: 'is_alive' })
  isAlive!: boolean;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}

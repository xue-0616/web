import { Entity, Column, Index } from 'typeorm';

@Index('trading_strategies_pkey', ['id'], { unique: true })
@Index('user_idx', ['userId'], {})
@Entity('trading_strategies', { schema: 'public' })
export class TradingStrategy {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('character varying', { name: 'name', length: 32 })
  name!: string;

  @Column('boolean', { name: 'is_alive' })
  isAlive!: boolean;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

}

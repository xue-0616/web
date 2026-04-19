import { Entity, Column, Index } from 'typeorm';
import { Chain } from '../../../common/genericChain';

@Index('bound_uk', ['boundAddr', 'boundChain'], { unique: true })
@Index('users_pkey', ['id'], { unique: true })
@Entity('users', { schema: 'public' })
export class User {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column({ type: 'smallint', name: 'bound_chain', enum: Chain })
  boundChain!: Chain;

  @Column('bytea', { name: 'bound_addr' })
  boundAddr!: Buffer;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

  @Column('character varying', {
        name: 'language',
        length: 32,
        nullable: true,
    })
  language!: string | null;

}

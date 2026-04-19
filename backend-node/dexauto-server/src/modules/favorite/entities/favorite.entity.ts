import { Entity, Column, Index, DeleteDateColumn } from 'typeorm';

@Index('favorite_pkey', ['id'], { unique: true })
@Index('user_idx', ['userId'], {})
@Entity('favorite', { schema: 'public' })
export class Favorite {
  @Column('uuid', { primary: true, name: 'id' })
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('bytea', { name: 'pool_address' })
  poolAddress!: Buffer;

  @Column('smallint', { name: 'chain' })
  chain!: number;

  @Column('timestamp without time zone', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamp without time zone', { name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({
        nullable: true,
        name: 'deleted_at',
    })
  deletedAt!: Date | null;

}

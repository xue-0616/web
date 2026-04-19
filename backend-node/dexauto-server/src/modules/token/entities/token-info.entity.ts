import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

type TokenSocials = Record<string, any>;

@Entity('token_info')
export class TokenInfo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'mint_address', unique: true })
  mintAddress!: string;

  @Column({ nullable: true })
  symbol!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true })
  icon!: string;

  @Column({ type: 'decimal', nullable: true })
  supply!: string;

  @Column({ type: 'smallint', nullable: true })
  decimals!: number;

  @Column({ type: 'jsonb', default: {} })
  socials!: TokenSocials;

  @Column({ type: 'jsonb', default: {} })
  audit!: Record<string, any>;

  @Column({ name: 'metadata_uri', type: 'varchar', nullable: true })
  metaDataUri!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

}

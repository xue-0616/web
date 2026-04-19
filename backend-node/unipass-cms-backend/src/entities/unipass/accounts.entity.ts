import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { bufferTransformer } from '../utils/buffer.transformer';

export enum AccountStatus {
    generateKey = 0,
    pending = 1,
    committed = 2,
    failed = 3,
}

export enum ProviderType {
    google = 0,
    auth0 = 1,
}

@Entity({ name: 'accounts', schema: 'unipassSchema' })
@Index(['email', 'provider'], { unique: true })
export class AccountsEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
        transformer: bufferTransformer,
    })
  address!: string;

  @Column()
  email!: string;

  @Column()
  source!: string;

  @Column()
  pepper!: string;

  @Column({
        name: 'init_keyset_hash',
        transformer: bufferTransformer,
    })
  initKeysetHash!: string;

  @Column({
        name: 'keyset_hash',
        transformer: bufferTransformer,
    })
  keysetHash!: string;

  @Column({
        name: 'pending_keyset_hash',
        transformer: bufferTransformer,
    })
  pendingKeysetHash!: string;

  @Column()
  status!: AccountStatus;

  @Column()
  sub!: string;

  @Column()
  provider!: ProviderType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

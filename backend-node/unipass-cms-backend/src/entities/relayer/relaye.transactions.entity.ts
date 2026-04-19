import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

export enum TxStatus {
  Pending = 0,
  SUCCESS = 1,
  FAIL = 2,
  Discard = 3,
}

export interface ITransaction {
  to?: string;
  data?: string;
  value?: string;
  [key: string]: any;
}

const bufferTransformer: ValueTransformer = {
  to: (value?: string | null) => {
    if (value === null || value === undefined) {
      return value;
    }
    const normalized = value.startsWith('0x') ? value.slice(2) : value;
    return Buffer.from(normalized, 'hex');
  },
  from: (value?: Buffer | string | null) => {
    if (value === null || value === undefined) {
      return value;
    }
    if (Buffer.isBuffer(value)) {
      return value.toString('hex');
    }
    return value;
  },
};

@Entity({ name: 'relayer_transactions', schema: 'relayerSchema' })
export class RelayerTransactionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint', name: 'chain_id' })
  chainId!: string;

  @Column({ name: 'tx_hash', transformer: bufferTransformer })
  chainTxHash!: string;

  @Column({ type: 'json' })
  transaction!: ITransaction;

  @Column({ transformer: bufferTransformer })
  submitter!: string;

  @Column({ name: 'gas_limit' })
  gasLimit!: string;

  @Column({ name: 'gas_price' })
  gasPrice!: string;

  @Column({ type: 'int' })
  status!: TxStatus;

  @Column()
  discount!: string;

  @Column({ name: 'fee_token', transformer: bufferTransformer, nullable: true })
  feeToken!: string;

  @Column({ name: 'wallet_address', transformer: bufferTransformer, nullable: true })
  walletAddress!: string;

  @CreateDateColumn({ name: 'gmt_created', type: 'datetime' })
  gmtCreated!: Date;

  @UpdateDateColumn({ name: 'gmt_updated', type: 'datetime' })
  gmtUpdated!: Date;

  @Column({ name: 'date', type: 'datetime', nullable: true })
  date?: Date;
}

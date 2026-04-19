import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TransactionType {
    CreateMysteryBox = 0,
    GrabMysteryBox = 1,
    DistributeMysteryBox = 2,
}

export enum TransactionStatus {
    Pending = 0,
    SentToChain = 1,
    Success = 2,
    Failed = 3,
}

@Index('slot_uk', ['slot', 'slotIndex'], { unique: true })
@Index('tx_order_uk', ['txOrderType', 'txOrderId'], { unique: true })
@Index('tx_sig_uk', ['txSig'], { unique: true })
@Index('tx_status_idx', ['status'], {})
@Entity('transactions')
export class TransactionEntity {
    @PrimaryGeneratedColumn({
        type: 'bigint',
        name: 'id',
        comment: '@desc transaction id',
        unsigned: true,
    })
    id!: bigint;
    @Column('binary', {
        name: 'tx_sig',
        nullable: true,
        unique: true,
        comment: '@desc tx sig',
        length: 64,
    })
    txSig!: Buffer | null;
    @Column('blob', { name: 'tx_body', comment: '@desc tx body' })
    txBody!: Buffer;
    @Column('bigint', {
        name: 'tx_block_height',
        comment: '@desc tx recent block height',
        unsigned: true,
    })
    txBlockHeight!: bigint;
    @Column('tinyint', {
        name: 'tx_order_type',
        comment: '@desc tx order type\n@values 0 create mystery box | 1 grabmystery box | 2 distribute mystery box',
        unsigned: true,
    })
    txOrderType!: TransactionType;
    @Column('bigint', {
        name: 'tx_order_id',
        comment: '@desc tx order id',
        unsigned: true,
    })
    txOrderId!: bigint;
    @Column('bigint', {
        name: 'slot',
        nullable: true,
        comment: '@desc tx slot',
        unsigned: true,
    })
    slot!: bigint | null;
    @Column('bigint', {
        name: 'slot_index',
        nullable: true,
        comment: '@desc tx slot index',
        unsigned: true,
    })
    slotIndex!: bigint | null;
    @Column('tinyint', {
        name: 'status',
        comment: '@desc tx status\n@values 0: pending | 1: sent to chain | 2: success | 3: failed',
        unsigned: true,
    })
    status!: TransactionStatus;
    @Column('varchar', {
        name: 'error_reason',
        nullable: true,
        comment: '@desc error reason',
        length: 1024,
    })
    errorReason!: string | null;
    @Column('datetime', { name: 'created_at', comment: '@desc created time' })
    createdAt!: Date;
    @Column('datetime', { name: 'updated_at', comment: '@desc updated time' })
    updatedAt!: Date;
}

import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';
import { MysteryBoxEntity } from './mystery-boxs.entity';

export enum GrabTransactionStatus {
    INIT = 0,
    PENDING = 1,
    FAILED = 2,
    CONFIRMED = 3,
    REFUND_INIT = 4,
    REFUND_PENDING = 5,
    REFUND_CONFIRMED = 6,
    REFUND_FAILED = 7,
    DISTRIBUTE_INIT = 8,
    DISTRIBUTE_PENDING = 9,
    DISTRIBUTE_CONFIRMED = 10,
    DISTRIBUTE_FAILED = 11,
}

@Entity('grab_mystery_boxs')
export class GrabMysteryBoxEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: bigint;
    @Column('bigint')
    boxId!: bigint;
    @Column()
    senderAddress!: string;
    @Column()
    status!: GrabTransactionStatus;
    @Column('bigint')
    amount!: string;
    @Column('bigint')
    transactionId!: bigint;
    @Column()
    isBomb!: boolean;
    @Column('bigint')
    lotteryDrawAmount!: string;
    @Column('bigint')
    lotteryDrawTransactionId!: bigint;
    @ManyToOne(() => MysteryBoxEntity, (mysteryBox) => mysteryBox.grabMysteryBoxs)
    @JoinColumn({ name: 'box_id' })
    mysteryBox!: MysteryBoxEntity;
}

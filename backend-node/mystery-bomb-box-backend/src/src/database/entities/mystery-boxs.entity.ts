import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GrabMysteryBoxEntity } from './grab-mystery-boxs.entity';
import { MyBaseEntity } from './base.entity';

export enum MysteryBoxStatus {
    INIT = 0,
    INIT_PENDING = 1,
    INIT_FAILED = 2,
    GRABBING = 3,
    GRAB_ENDED = 4,
    DISTRIBUTE_INIT = 5,
    DISTRIBUTE_PENDING = 6,
    DISTRIBUTE_CONFIRMED = 7,
    DISTRIBUTE_FAILED = 8,
}

@Entity('mystery_boxs')
export class MysteryBoxEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: bigint;
    @Column()
    senderAddress!: string;
    @Column()
    status!: MysteryBoxStatus;
    @Column('bigint')
    amount!: string;
    @Column()
    bombNumber!: number;
    @Column('bigint')
    openCount!: bigint;
    @Column('bigint')
    openLimit!: bigint;
    @Column('bigint')
    transactionId!: bigint;
    @Column('bigint')
    lotteryDrawTransactionId!: bigint;
    @Column('bigint')
    lotteryDrawAmount!: string;
    @Column()
    grabStartTime!: number;
    @Column()
    grabEndTime!: number;
    @OneToMany(() => GrabMysteryBoxEntity, (grabMysteryBox) => grabMysteryBox.mysteryBox)
    grabMysteryBoxs!: GrabMysteryBoxEntity[];
}

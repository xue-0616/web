import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'gas_income_expense', schema: 'statisticsSchema' })
export class GasIncomeExpenseEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    relayerId!: number;

    @Column()
    chainId!: number;

    @Column()
    gmtUpdated!: Date;

    @Column()
    source!: string;

    @Column()
    topic!: string;

    @Column()
    interact!: string;

    @Column()
    txHash!: string;

    @Column()
    submitter!: string;

    @Column()
    to!: string;

    @Column()
    feeToken!: string;

    @Column()
    feeIncome!: string;

    @Column()
    transaction!: string;

    @Column()
    gasSpent!: string;

    @Column()
    gasPrice!: string;

    @Column()
    gasLimit!: string;
}

import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'login_records' })
export class LoginRecordsEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'account_id' })
  @Index()
  accountId!: number;

  @Column()
  @Index()
  date!: string;

  @Column()
  times!: number;

  @UpdateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

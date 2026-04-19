import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'login_records' })
export class LoginRecordsEntity {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    @Index()
    accountId: any;
    @Column()
    @Index()
    date: any;
    @Column()
    times: any;
    @CreateDateColumn()
    createdAt: any;
    @UpdateDateColumn()
    updatedAt: any;
}

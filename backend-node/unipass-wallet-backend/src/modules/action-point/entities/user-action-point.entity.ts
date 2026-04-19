import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './base.time';

@Entity({ name: 'user_action_point' })
export class UserActionPointEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Index()
    @Column()
    accountId: any;
    @Column()
    availActionPoint: any;
    @Column()
    decimal: any;
    @Column()
    lockActionPoint: any;
    @Column()
    discount: any;
}

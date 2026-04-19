import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTime } from './base.time';

export enum UserActionPointStatus {
    PENDING = 0,
    SUCCESS = 1,
    FAIL = 2,
}

export enum UserActionPointChangeType {
    ADMIN_ADD = 0,
    TX_SEND = 1,
}

@Entity({ name: 'user_action_point_history' })
export class UserActionPointHistoryEntity extends BaseTime {
    @PrimaryGeneratedColumn()
    id: any;
    @Column()
    accountId: any;
    @Column()
    actionPointDiff: any;
    @Column()
    changeType: any;
    @Column()
    status: any;
    @Column()
    changeTime: any;
    @Column()
    changeMsg: any;
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MyBaseEntity } from './base.entity';

export enum FollowType {
    Bot = 0,
    WalletApp = 1,
    MiniApp = 2,
}

export enum FollowStatus {
    CancelFollow = 0,
    Following = 1,
}

@Entity({ name: 'user_follows' })
export class UserFollowsEntity extends MyBaseEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column()
    userId!: number;
    @Column()
    type!: FollowType;
    @Column()
    status!: FollowStatus;
    @Column()
    botUsername!: string;
    @Column()
    botId!: number;
}
